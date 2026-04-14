import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { createConnection } from "@/lib/connection";

// POST /api/sync/apply — execute all pending changes on devices
export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  // Recover stale in_progress items from previous crashed apply runs
  await prisma.syncQueue.updateMany({
    where: {
      status: "in_progress",
      createdAt: { lt: new Date(Date.now() - 5 * 60 * 1000) },
    },
    data: { status: "failed", error: "Interrupted by previous apply run" },
  });

  // Atomically claim all pending and failed items to prevent concurrent apply races
  // Failed items are included for retry as per spec
  const claimed = await prisma.syncQueue.updateMany({
    where: { status: { in: ["pending", "failed"] } },
    data: { status: "in_progress", error: null },
  });

  if (claimed.count === 0) {
    return NextResponse.json({ applied: 0, failed: 0, orphansRemoved: 0, results: [] });
  }

  const pending = await prisma.syncQueue.findMany({
    where: { status: "in_progress" },
    include: { device: true, game: true },
    orderBy: { createdAt: "asc" },
  });

  // Group by device so we open one connection per device
  const byDevice = new Map<number, typeof pending>();
  for (const item of pending) {
    const list = byDevice.get(item.deviceId) || [];
    list.push(item);
    byDevice.set(item.deviceId, list);
  }

  let applied = 0;
  let failed = 0;
  const results: { id: number; status: string; error?: string }[] = [];

  for (const [, items] of Array.from(byDevice.entries())) {
    const device = items[0].device;
    let conn;
    try {
      conn = await createConnection({
        protocol: device.protocol as "ssh" | "ftp" | "local",
        host: device.host,
        port: device.port,
        user: device.user,
        password: device.password,
      });
    } catch (err) {
      // Mark all items for this device as failed
      for (const item of items) {
        const errorMsg = `Connection failed: ${err instanceof Error ? err.message : "Unknown error"}`;
        await prisma.syncQueue.update({
          where: { id: item.id },
          data: { status: "failed", error: errorMsg },
        });
        results.push({ id: item.id, status: "failed", error: errorMsg });
        failed++;
      }
      continue;
    }

    try {
      for (const item of items) {
        try {
          if (item.type === "delete") {
            try {
              await conn.remove(item.filePath);
            } catch (err) {
              // File already gone = success (idempotent)
              const msg = err instanceof Error ? err.message : "";
              if (!msg.includes("No such file") && !msg.includes("ENOENT")) {
                throw err;
              }
            }

            // Remove GameDevice link
            await prisma.gameDevice.deleteMany({
              where: { gameId: item.gameId, deviceId: item.deviceId },
            });

            await prisma.syncQueue.update({
              where: { id: item.id },
              data: { status: "applied" },
            });
            applied++;
            results.push({ id: item.id, status: "applied" });
          } else if (item.type === "rename" && item.newPath) {
            try {
              await conn.rename(item.filePath, item.newPath);
            } catch (err) {
              // If old file is gone, verify destination exists before treating as success
              const msg = err instanceof Error ? err.message : "";
              if (!msg.includes("No such file") && !msg.includes("ENOENT")) {
                throw err;
              }
              // Verify the destination file actually exists
              try {
                await conn.stat(item.newPath);
              } catch {
                throw new Error(
                  `Rename failed: source file not found and destination does not exist`,
                );
              }
            }

            // Update originalFile only if this game is on a single device
            // Multi-device games keep originalFile unchanged to avoid corrupting
            // path reconstruction for other devices
            const deviceCount = await prisma.gameDevice.count({
              where: { gameId: item.gameId },
            });
            if (deviceCount <= 1) {
              // Preserve the relative path prefix (e.g. "roms/" for subdir platforms)
              const currentGame = await prisma.game.findUnique({
                where: { id: item.gameId },
                select: { originalFile: true },
              });
              const newBasename = item.newPath.split("/").pop() || item.newPath;
              let newFilename = newBasename;
              if (currentGame) {
                const lastSlash = currentGame.originalFile.lastIndexOf("/");
                const dirPrefix = lastSlash >= 0 ? currentGame.originalFile.slice(0, lastSlash + 1) : "";
                newFilename = dirPrefix + newBasename;
              }
              try {
                await prisma.game.update({
                  where: { id: item.gameId },
                  data: { originalFile: newFilename },
                });
              } catch (dbErr) {
                // Unique constraint violation (P2002) — file renamed on disk
                // but DB can't update. Log but still mark as applied since
                // the device-side operation succeeded.
                console.warn(
                  `Could not update originalFile for game ${item.gameId}: ${dbErr instanceof Error ? dbErr.message : "Unknown"}`,
                );
              }
            }

            await prisma.syncQueue.update({
              where: { id: item.id },
              data: { status: "applied" },
            });
            applied++;
            results.push({ id: item.id, status: "applied" });
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : "Unknown error";
          await prisma.syncQueue.update({
            where: { id: item.id },
            data: { status: "failed", error: errorMsg },
          });
          results.push({ id: item.id, status: "failed", error: errorMsg });
          failed++;
        }
      }
    } finally {
      conn.disconnect();
    }
  }

  // After deletes: clean up orphaned games (zero remaining device links)
  const orphanedGames = await prisma.game.findMany({
    where: { devices: { none: {} } },
    select: { id: true },
  });
  if (orphanedGames.length > 0) {
    await prisma.game.deleteMany({
      where: { id: { in: orphanedGames.map((g) => g.id) } },
    });
  }

  return NextResponse.json({
    applied,
    failed,
    orphansRemoved: orphanedGames.length,
    results,
  });
}
