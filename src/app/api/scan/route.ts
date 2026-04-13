import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { scanDevice } from "@/lib/scanner";
import { requireAuth } from "@/lib/auth";
import { migrateSettingsToDevice } from "@/lib/migrate-device";

interface DeviceScanResult {
  device: string;
  total: number;
  new: number;
  updated: number;
  error?: string;
}

export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  try {
    // Auto-migrate legacy settings if no devices exist
    await migrateSettingsToDevice();

    const devices = await prisma.device.findMany();
    if (devices.length === 0) {
      return NextResponse.json(
        {
          error:
            "No devices configured. Add a device in Settings before scanning.",
        },
        { status: 400 },
      );
    }

    let totalNew = 0;
    let totalUpdated = 0;
    let totalGames = 0;
    const deviceResults: DeviceScanResult[] = [];

    for (const device of devices) {
      try {
        const scanPaths = JSON.parse(device.scanPaths) as {
          path: string;
          type: "rom" | "steam";
        }[];
        const blacklist = JSON.parse(device.blacklist) as string[];

        const games = await scanDevice({
          id: device.id,
          protocol: device.protocol as "ssh" | "ftp",
          host: device.host,
          port: device.port,
          user: device.user,
          password: device.password,
          scanPaths,
          blacklist,
        });

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

          if (result.createdAt.getTime() === result.updatedAt.getTime()) {
            newCount++;
          } else {
            updatedCount++;
          }
        }

        totalNew += newCount;
        totalUpdated += updatedCount;
        totalGames += games.length;

        deviceResults.push({
          device: device.name,
          total: games.length,
          new: newCount,
          updated: updatedCount,
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

    // Update platform game counts after all scans
    const platformCounts = await prisma.game.groupBy({
      by: ["platform"],
      _count: true,
    });

    await prisma.platform.updateMany({ data: { gameCount: 0 } });

    for (const pc of platformCounts) {
      await prisma.platform.updateMany({
        where: { id: pc.platform },
        data: { gameCount: pc._count },
      });
    }

    // Ensure "steam" platform exists if Steam games found
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

    return NextResponse.json({
      success: true,
      total: totalGames,
      new: totalNew,
      updated: totalUpdated,
      devices: deviceResults,
    });
  } catch (err) {
    console.error("Scan failed:", err);
    return NextResponse.json(
      {
        error: `Scan failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      },
      { status: 500 },
    );
  }
}
