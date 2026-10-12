import { prisma } from "@/lib/prisma";
import { scanDevice } from "@/lib/scanner";
import { setScanProgress, clearScanProgress } from "@/lib/scan-progress";
import { decrypt } from "@/lib/encryption";
import { deleteGameFiles } from "@/lib/image-cache";
import { persistDeviceManifest } from "@/lib/device-manifest";
import { acquireDeviceFiles, assertDeviceJobsOwned, type DeviceJobs } from "@/lib/device-jobs";

interface DeviceScanResult {
  device: string;
  total: number;
  new: number;
  updated: number;
  error?: string;
}

/** Claim all affected devices before reporting that the background scan started. */
export async function startScanInBackground(deviceId?: number): Promise<void> {
  const devices = await prisma.device.findMany({ where: deviceId ? { id: deviceId } : undefined, select: { id: true } });
  if (devices.length === 0) throw new Error("No devices configured");
  // The accepted background job survives completion of the HTTP response.
  const jobs = await acquireDeviceFiles(devices.map((device) => device.id), new Request("http://ludotek.internal/scan"));
  void runScanInBackground(deviceId, jobs).catch((error) => console.error("Scan crashed:", error));
}

export async function runScanInBackground(deviceId?: number, suppliedJobs?: DeviceJobs): Promise<void> {
  let jobs = suppliedJobs;
  // Set scanning=true immediately to prevent TOCTOU race on concurrent requests
  setScanProgress({
    scanning: true,
    progress: 0,
    status: "Initializing...",
    gamesFound: 0,
    newGames: 0,
    updatedGames: 0,
    totalPaths: 0,
    completedPaths: 0,
    deviceName: "",
  });

  try {
    const devices = deviceId
      ? await prisma.device.findMany({ where: { id: deviceId } })
      : await prisma.device.findMany();

    if (devices.length === 0) {
      setScanProgress({
        scanning: false,
        progress: 100,
        status: "No devices configured",
        gamesFound: 0,
        newGames: 0,
        updatedGames: 0,
        totalPaths: 0,
        completedPaths: 0,
        deviceName: "",
        error: "No devices configured. Add a device in Settings before scanning.",
      });
      return;
    }

    jobs ??= await acquireDeviceFiles(devices.map((device) => device.id), new Request("http://ludotek.internal/scan"));
    await jobs.assertActive();

    // Count total scan paths across all devices
    let totalPaths = 0;
    const deviceConfigs: {
      device: (typeof devices)[0];
      scanPaths: { path: string; type: "rom" | "steam" }[];
      blacklist: string[];
    }[] = [];

    for (const device of devices) {
      let scanPaths: { path: string; type: "rom" | "steam" }[];
      let blacklist: string[];
      try {
        scanPaths = JSON.parse(device.scanPaths);
        blacklist = JSON.parse(device.blacklist);
      } catch {
        console.error(`Device ${device.name} has invalid JSON config, skipping`);
        continue;
      }
      totalPaths += scanPaths.length;
      deviceConfigs.push({ device, scanPaths, blacklist });
    }

    let completedPaths = 0;
    let totalGamesFound = 0;
    let totalNew = 0;
    let totalUpdated = 0;
    const deviceResults: DeviceScanResult[] = [];

    setScanProgress({
      scanning: true,
      progress: 0,
      status: "Starting scan...",
      gamesFound: 0,
      newGames: 0,
      updatedGames: 0,
      totalPaths,
      completedPaths: 0,
      deviceName: devices.length === 1 ? devices[0].name : `${devices.length} devices`,
    });

    for (const { device, scanPaths, blacklist } of deviceConfigs) {
      await jobs.assertActive();
      try {
        const { games, reliable, files } = await scanDevice(
          {
            id: device.id,
            protocol: device.protocol as "ssh" | "ftp" | "local",
            host: device.host,
            port: device.port,
            user: device.user,
            password: decrypt(device.password),
            ftps: device.ftps,
            scanPaths,
            blacklist,
          },
          (pathLabel) => {
            const dirName = pathLabel.split("/").filter(Boolean).pop() || pathLabel;
            setScanProgress({
              scanning: true,
              progress: totalPaths > 0 ? Math.round((completedPaths / totalPaths) * 100) : 0,
              status: `Scanning ${dirName}...`,
              gamesFound: totalGamesFound,
              newGames: totalNew,
              updatedGames: totalUpdated,
              totalPaths,
              completedPaths,
              deviceName: device.name,
            });
            completedPaths++;
          },
          { signal: jobs.signal, assertActive: () => jobs!.assertActive() },
        );

        let newCount = 0;
        let updatedCount = 0;
        const scannedGameIds: number[] = [];
        const gameIds = new Map<string, number>();

        for (const game of games) {
          await jobs.assertActive();
          await prisma.$transaction(async (tx) => {
            await assertDeviceJobsOwned(jobs!, tx);
            jobs!.signal.throwIfAborted();
            const physical = files.find((file) => file.type === "file" && file.gameKey === `${game.title}|${game.platform}` && file.relativePath === game.originalFile);
            const confirmed = physical ? await tx.deviceFile.findFirst({
              where: { deviceId: device.id, path: physical.path, kind: "file", gameId: { not: null }, size: BigInt(physical.size), modifiedAt: physical.modifiedAt ?? null },
              select: { game: true },
            }) : null;
            // Journal-renamed paths retain the existing catalog identity and
            // metadata; shared representative filenames need not be changed.
            let existing = confirmed?.game ?? await tx.game.findUnique({
              where: {
                originalFile_platform: {
                  originalFile: game.originalFile,
                  platform: game.platform,
                },
              },
            });

            // Fall back to title+platform match (cross-device dedup for same game with different filename)
            if (!existing) {
              existing = await tx.game.findFirst({
                where: { title: game.title, platform: game.platform },
              });
            }

            let result;
            if (existing) {
              // Update title if it changed (e.g. ROM renamed on disk)
              if (!confirmed?.game && existing.title !== game.title) {
                await tx.game.update({
                  where: { id: existing.id },
                  data: { title: game.title },
                });
                updatedCount++;
              }
              result = existing;
            } else {
              result = await tx.game.create({
                data: {
                  title: game.title,
                  originalFile: game.originalFile,
                  platform: game.platform,
                  platformLabel: game.platformLabel,
                  source: game.source,
                },
              });
              newCount++;
            }

            scannedGameIds.push(result.id);
            gameIds.set(`${game.title}|${game.platform}`, result.id);

            // Create/refresh the GameDevice link, recording the filename THIS
            // device's scan saw. Updating on re-scan fixes the .m3u-supersedes-disc
            // case (SCANNING-2) and keeps each device's path independent (SCANNING-3).
            await tx.gameDevice.upsert({
              where: {
                gameId_deviceId: {
                  gameId: result.id,
                  deviceId: device.id,
                },
              },
              update: { originalFile: game.originalFile },
              create: {
                gameId: result.id,
                deviceId: device.id,
                originalFile: game.originalFile,
              },
            });
          });
        }

        await jobs.assertActive();
        await persistDeviceManifest(prisma, device.id, files, reliable, gameIds, {
          assertOwned: (tx) => assertDeviceJobsOwned(jobs!, tx), signal: jobs.signal,
        });

        // Clean up stale GameDevice links for games no longer on this device.
        // Prune only when the scan was RELIABLE (every relevant directory was
        // completely read), even if it found 0 games — that means the device was
        // genuinely emptied. On an unreliable scan (a path was temporarily
        // unreadable, e.g. SD card unmounted) we skip pruning, because
        // scanDevice() can return 0 games silently for an unreachable path and
        // pruning then would wipe the device's whole library.
        if (reliable) {
          const orphanIds = await prisma.$transaction(async (tx) => {
            await assertDeviceJobsOwned(jobs!, tx);
            jobs!.signal.throwIfAborted();
            const staleFilter = scannedGameIds.length > 0 ? { gameId: { notIn: scannedGameIds } } : {};
            await tx.gameDevice.deleteMany({ where: { deviceId: device.id, ...staleFilter } });
            await tx.syncQueue.deleteMany({ where: { deviceId: device.id, status: { in: ["pending", "failed"] }, ...staleFilter } });
            const orphans = await tx.game.findMany({ where: { devices: { none: {} } }, select: { id: true } });
            const ids = orphans.map((game) => game.id);
            if (ids.length) await tx.game.deleteMany({ where: { id: { in: ids }, devices: { none: {} } } });
            return ids;
          });
          if (orphanIds.length) {
            await jobs.assertActive();
            await deleteGameFiles(orphanIds);
            console.warn(`Removed ${orphanIds.length} orphaned games with no device links`);
          }
        } else {
          console.warn(
            `Scan of ${device.name} was incomplete — skipping library cleanup`,
          );
        }

        totalNew += newCount;
        totalUpdated += updatedCount;
        totalGamesFound += games.length;

        deviceResults.push({
          device: device.name,
          total: games.length,
          new: newCount,
          updated: updatedCount,
        });

        setScanProgress({
          scanning: true,
          progress: totalPaths > 0 ? Math.round((completedPaths / totalPaths) * 100) : 0,
          status: `Finished ${device.name}`,
          gamesFound: totalGamesFound,
          newGames: totalNew,
          updatedGames: totalUpdated,
          totalPaths,
          completedPaths,
          deviceName: device.name,
        });
      } catch (err) {
        console.error(`Scan failed for device ${device.name}:`, err);
        deviceResults.push({
          device: device.name,
          total: 0,
          new: 0,
          updated: 0,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    // Update platform game counts — upsert so new platforms get created
    const { PLATFORM_CONFIG } = await import("@/lib/platforms");
    const platformCounts = await prisma.game.groupBy({ by: ["platform"], _count: true });
    await prisma.platform.updateMany({ data: { gameCount: 0 } });
    for (const pc of platformCounts) {
      const platDef = PLATFORM_CONFIG.find((p) => p.id === pc.platform);
      await prisma.platform.upsert({
        where: { id: pc.platform },
        update: { gameCount: pc._count },
        create: {
          id: pc.platform,
          label: platDef?.label || pc.platform,
          icon: platDef?.icon || "🎮",
          color: platDef?.color || "#6366f1",
          gameCount: pc._count,
          sortOrder: platDef?.sortOrder || 99,
        },
      });
    }

    // Mark scan as complete
    setScanProgress({
      scanning: false,
      progress: 100,
      status: `Scan complete — ${totalGamesFound} games (${totalNew} new, ${totalUpdated} updated)`,
      gamesFound: totalGamesFound,
      newGames: totalNew,
      updatedGames: totalUpdated,
      totalPaths,
      completedPaths: totalPaths,
      deviceName: devices.length === 1 ? devices[0].name : `${devices.length} devices`,
    });

    // Clear progress after 10 seconds
    setTimeout(() => clearScanProgress(), 10000);
  } catch (err) {
    console.error("Background scan failed:", err);
    setScanProgress({
      scanning: false,
      progress: 0,
      status: "Scan failed",
      gamesFound: 0,
      newGames: 0,
      updatedGames: 0,
      totalPaths: 0,
      completedPaths: 0,
      deviceName: "",
      error: err instanceof Error ? err.message : "Unknown error",
    });
    setTimeout(() => clearScanProgress(), 10000);
  } finally {
    await jobs?.close();
  }
}
