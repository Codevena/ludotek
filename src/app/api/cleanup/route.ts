import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { cleanFilename } from "@/lib/filename-cleaner";
import { deleteGameFiles } from "@/lib/image-cache";
import { withDeviceFiles, assertDeviceJobsOwned } from "@/lib/device-jobs";
import { filePlanFailure } from "@/lib/file-plan-api";

export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  try {
    return await withDeviceFiles([], request, async (jobs) => {
      const result = await prisma.$transaction(async (tx) => {
        await assertDeviceJobsOwned(jobs, tx); jobs.signal.throwIfAborted();
        // Re-clean all titles from originalFile (fixes missing extensions like .sms)
        const allGames = await tx.game.findMany({
          select: { id: true, title: true, originalFile: true, platform: true },
          orderBy: { id: "asc" },
        });

        let titlesCleaned = 0;
        for (const game of allGames) {
          // Extract basename for subdir-backed platforms (e.g. "roms/Halo.iso" → "Halo.iso")
          const rawName = game.originalFile.includes("/")
            ? game.originalFile.split("/").pop()!
            : game.originalFile;
          const cleanedTitle = cleanFilename(rawName);
          if (cleanedTitle && cleanedTitle !== game.title) {
            await tx.game.update({
              where: { id: game.id },
              data: { title: cleanedTitle },
            });
            titlesCleaned++;
          }
        }

        // Re-fetch games after title cleanup for deduplication
        const updatedGames = await tx.game.findMany({
          select: { id: true, title: true, platform: true, originalFile: true },
          orderBy: { id: "asc" },
        });

        // Find and remove title+platform duplicates
        // Prefer .m3u entries (canonical multi-disc representation) over per-disc entries
        const seen = new Map<string, { id: number; isM3u: boolean }>();
        const dupeIds: number[] = [];
        const loserToWinner = new Map<number, number>();

        for (const game of updatedGames) {
          const key = `${game.title}|${game.platform}`;
          const isM3u = game.originalFile.toLowerCase().endsWith(".m3u");
          const existing = seen.get(key);
          if (existing) {
            if (isM3u && !existing.isM3u) {
              // New entry is .m3u, old is not — replace, mark old as dupe
              dupeIds.push(existing.id);
              loserToWinner.set(existing.id, game.id);
              seen.set(key, { id: game.id, isM3u });
            } else {
              dupeIds.push(game.id);
              loserToWinner.set(game.id, existing.id);
            }
          } else {
            seen.set(key, { id: game.id, isM3u });
          }
        }

        let dupesDeleted = 0;
        if (dupeIds.length > 0) {
          // Resolve transitive chains (A→B→C becomes A→C, B→C)
          const resolveWinner = (id: number): number => {
            let current = id;
            while (loserToWinner.has(current)) current = loserToWinner.get(current)!;
            return current;
          };

          // Transfer device links from losers to winners before deleting
          const loserLinks = await tx.gameDevice.findMany({
            where: { gameId: { in: dupeIds } },
          });
          for (const link of loserLinks) {
            const winnerId = resolveWinner(link.gameId);
            if (winnerId !== undefined) {
              await tx.gameDevice.upsert({
                where: { gameId_deviceId: { gameId: winnerId, deviceId: link.deviceId } },
                // Keep the winner's filename if it already has this device (the winner
                // is the canonical entry, e.g. an .m3u over a disc); otherwise carry
                // the loser's per-device filename onto the new link.
                update: {},
                create: { gameId: winnerId, deviceId: link.deviceId, originalFile: link.originalFile },
              });
            }
          }
          for (const loserId of dupeIds) {
            await tx.deviceFile.updateMany({ where: { gameId: loserId }, data: { gameId: resolveWinner(loserId) } });
          }
          // The same writer transaction transfers every physical association before
          // duplicate deletion can SET NULL the surviving ROM manifest entries.
          const result = await tx.game.deleteMany({
            where: { id: { in: dupeIds } },
          });
          dupesDeleted = result.count;
        }

        // Update platform counts
        const platformCounts = await tx.game.groupBy({
          by: ["platform"],
          _count: true,
        });
        await tx.platform.updateMany({ data: { gameCount: 0 } });
        for (const pc of platformCounts) {
          await tx.platform.updateMany({
            where: { id: pc.platform },
            data: { gameCount: pc._count },
          });
        }

        return {
          success: true,
          titlesCleaned,
          duplicatesRemoved: dupesDeleted,
          totalGamesNow: await tx.game.count(), dupeIds,
        };
      }, { maxWait: 5000, timeout: 60000 });
      await jobs.assertActive();
      await deleteGameFiles(result.dupeIds);
      return NextResponse.json({ success: result.success, titlesCleaned: result.titlesCleaned, duplicatesRemoved: result.duplicatesRemoved, totalGamesNow: result.totalGamesNow });
    });
  } catch (error) { return filePlanFailure(error); }
}
