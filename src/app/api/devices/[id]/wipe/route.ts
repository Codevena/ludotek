import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// POST /api/devices/[id]/wipe — delete all games linked to this device
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const { id } = await params;
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const deviceId = Number(id);

  const device = await prisma.device.findUnique({
    where: { id: deviceId },
    select: { name: true },
  });
  if (!device) {
    return NextResponse.json({ error: "Device not found" }, { status: 404 });
  }

  // Remove all GameDevice links for this device
  const { count: linksRemoved } = await prisma.gameDevice.deleteMany({
    where: { deviceId },
  });

  // Remove all pending/failed sync queue items for this device
  await prisma.syncQueue.deleteMany({
    where: { deviceId },
  });

  // Remove orphaned games (no remaining device links)
  const orphanedGames = await prisma.game.findMany({
    where: { devices: { none: {} } },
    select: { id: true },
  });
  let gamesRemoved = 0;
  if (orphanedGames.length > 0) {
    const result = await prisma.game.deleteMany({
      where: { id: { in: orphanedGames.map((g) => g.id) } },
    });
    gamesRemoved = result.count;
  }

  // Update platform counts
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

  return NextResponse.json({
    success: true,
    device: device.name,
    linksRemoved,
    gamesRemoved,
  });
}
