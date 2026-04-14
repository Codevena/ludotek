import { prisma } from "@/lib/prisma";
import { scanDevice } from "@/lib/scanner";
import { setScanProgress, clearScanProgress } from "@/lib/scan-progress";
import { migrateSettingsToDevice } from "@/lib/migrate-device";

interface DeviceScanResult {
  device: string;
  total: number;
  new: number;
  updated: number;
  error?: string;
}

export async function runScanInBackground(deviceId?: number): Promise<void> {
  try {
    await migrateSettingsToDevice();

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

    // Count total scan paths across all devices
    let totalPaths = 0;
    const deviceConfigs: {
      device: (typeof devices)[0];
      scanPaths: { path: string; type: "rom" | "steam" }[];
      blacklist: string[];
    }[] = [];

    for (const device of devices) {
      const scanPaths = JSON.parse(device.scanPaths) as { path: string; type: "rom" | "steam" }[];
      const blacklist = JSON.parse(device.blacklist) as string[];
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
      try {
        const games = await scanDevice(
          {
            id: device.id,
            protocol: device.protocol as "ssh" | "ftp",
            host: device.host,
            port: device.port,
            user: device.user,
            password: device.password,
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
        );

        let newCount = 0;
        let updatedCount = 0;

        for (const game of games) {
          const result = await prisma.game.upsert({
            where: {
              originalFile_platform: {
                originalFile: game.originalFile,
                platform: game.platform,
              },
            },
            update: { title: game.title },
            create: {
              title: game.title,
              originalFile: game.originalFile,
              platform: game.platform,
              platformLabel: game.platformLabel,
              source: game.source,
            },
          });

          // Create GameDevice link
          await prisma.gameDevice.upsert({
            where: {
              gameId_deviceId: {
                gameId: result.id,
                deviceId: device.id,
              },
            },
            update: {},
            create: {
              gameId: result.id,
              deviceId: device.id,
            },
          });

          if (result.createdAt.getTime() === result.updatedAt.getTime()) {
            newCount++;
          } else {
            updatedCount++;
          }
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

    // Update platform game counts
    const platformCounts = await prisma.game.groupBy({ by: ["platform"], _count: true });
    await prisma.platform.updateMany({ data: { gameCount: 0 } });
    for (const pc of platformCounts) {
      await prisma.platform.updateMany({
        where: { id: pc.platform },
        data: { gameCount: pc._count },
      });
    }

    const steamCount = platformCounts.find((p) => p.platform === "steam");
    if (steamCount) {
      await prisma.platform.upsert({
        where: { id: "steam" },
        update: { gameCount: steamCount._count },
        create: {
          id: "steam",
          label: "Steam",
          icon: "🎮",
          color: "#171a21",
          gameCount: steamCount._count,
          sortOrder: 19,
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
  }
}
