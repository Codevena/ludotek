import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { scanDevice } from "@/lib/scanner";
import { requireAuth } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = requireAuth(request);
  if (authError) return authError;

  try {
    const { id } = await params;
    const deviceId = parseInt(id, 10);
    if (isNaN(deviceId)) {
      return NextResponse.json({ error: "Invalid device ID" }, { status: 400 });
    }

    const device = await prisma.device.findUnique({ where: { id: deviceId } });
    if (!device) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 });
    }

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

    // Update platform game counts
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
      device: device.name,
      total: games.length,
      new: newCount,
      updated: updatedCount,
    });
  } catch (err) {
    console.error("Device scan failed:", err);
    return NextResponse.json(
      {
        error: `Scan failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      },
      { status: 500 },
    );
  }
}
