import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { clearCache } from "@/lib/image-cache";

// POST /api/devices/wipe-all — delete ALL games from ALL devices
export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  // Remove all cached image files + CacheEntry rows (all games are about to go)
  await clearCache();

  // Delete all sync queue items
  await prisma.syncQueue.deleteMany({});

  // Delete all game-device links
  await prisma.gameDevice.deleteMany({});

  // Delete all games
  const { count: gamesRemoved } = await prisma.game.deleteMany({});

  // Reset all platform counts to 0
  await prisma.platform.updateMany({ data: { gameCount: 0 } });

  return NextResponse.json({
    success: true,
    gamesRemoved,
  });
}
