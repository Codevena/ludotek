import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { scanSteamDeck } from "@/lib/scanner";

export async function POST() {
  try {
    const settings = await prisma.settings.findFirst({ where: { id: 1 } });
    if (!settings) {
      return NextResponse.json(
        { error: "Settings not configured" },
        { status: 400 }
      );
    }

    if (!settings.deckHost || !settings.deckUser) {
      return NextResponse.json(
        { error: "Steam Deck SSH credentials not configured" },
        { status: 400 }
      );
    }

    const games = await scanSteamDeck(
      settings.deckHost,
      settings.deckUser,
      settings.deckPassword
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
      total: games.length,
      new: newCount,
      updated: updatedCount,
    });
  } catch (err) {
    console.error("Scan failed:", err);
    return NextResponse.json(
      {
        error: `Scan failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      },
      { status: 500 }
    );
  }
}
