import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { createConnection } from "@/lib/connection";
import { decrypt } from "@/lib/encryption";
import { deleteGameFiles } from "@/lib/image-cache";

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
        password: decrypt(device.password),
        ftps: device.ftps,
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

            // Record the new filename after the rename. Derive the relative path
            // prefix (e.g. "roms/" for subdir platforms) from THIS device's own
            // recorded filename, not the shared Game.originalFile — otherwise a
            // multi-device game would reuse another device's prefix (SCANNING-3).
            const newBasename = item.newPath.split("/").pop() || item.newPath;
            const link = await prisma.gameDevice.findUnique({
              where: {
                gameId_deviceId: { gameId: item.gameId, deviceId: item.deviceId },
              },
              select: { id: true, originalFile: true },
            });
            const devLastSlash = link?.originalFile
              ? link.originalFile.lastIndexOf("/")
              : -1;
            const dirPrefix =
              devLastSlash >= 0 ? link!.originalFile!.slice(0, devLastSlash + 1) : "";
            const newFilename = dirPrefix + newBasename;

            // Always update this device's per-device filename (safe for multi-device).
            if (link) {
              await prisma.gameDevice.update({
                where: { id: link.id },
                data: { originalFile: newFilename },
              });
            }

            // Update the shared representative Game.originalFile (the unique key)
            // only for single-device games — updating it for a multi-device game
            // could corrupt path reconstruction for the other devices.
            const deviceCount = await prisma.gameDevice.count({
              where: { gameId: item.gameId },
            });
            if (deviceCount <= 1) {
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
          try {
            await prisma.syncQueue.update({
              where: { id: item.id },
              data: { status: "failed", error: errorMsg },
            });
          } catch (updateErr) {
            // The row may have been removed by a concurrent wipe (Game/Device
            // delete cascades to SyncQueue → P2025). The remote op already ran;
            // record the failure and keep going instead of crashing the run.
            console.warn(`Could not mark syncQueue item ${item.id} as failed:`, updateErr);
          }
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
    const orphanIds = orphanedGames.map((g) => g.id);
    // Remove cached image files before deleting the records (see IMAGECACHE-2)
    await deleteGameFiles(orphanIds);
    await prisma.game.deleteMany({ where: { id: { in: orphanIds } } });

    // Refresh platform game counts so platforms emptied by this sync drop out
    // of the sidebar (which filters gameCount > 0) without needing a rescan.
    const platformCounts = await prisma.game.groupBy({ by: ["platform"], _count: true });
    await prisma.platform.updateMany({ data: { gameCount: 0 } });
    for (const pc of platformCounts) {
      await prisma.platform.updateMany({
        where: { id: pc.platform },
        data: { gameCount: pc._count },
      });
    }
  }

  return NextResponse.json({
    applied,
    failed,
    orphansRemoved: orphanedGames.length,
    results,
  });
}
