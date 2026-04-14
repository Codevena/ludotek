import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { createConnection } from "@/lib/connection";

// POST /api/sync/apply — execute all pending changes on devices
export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  // Atomically claim all pending items to prevent concurrent apply races
  await prisma.syncQueue.updateMany({
    where: { status: "pending" },
    data: { status: "in_progress" },
  });

  const pending = await prisma.syncQueue.findMany({
    where: { status: "in_progress" },
    include: { device: true, game: true },
    orderBy: { createdAt: "asc" },
  });

  if (pending.length === 0) {
    return NextResponse.json({ applied: 0, failed: 0, results: [] });
  }

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

            // Update originalFile in the game record
            const newFilename = item.newPath.split("/").pop() || item.newPath;
            await prisma.game.update({
              where: { id: item.gameId },
              data: { originalFile: newFilename },
            });

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
