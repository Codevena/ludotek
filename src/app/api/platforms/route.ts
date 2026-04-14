import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const deviceId = searchParams.get("deviceId");

  if (deviceId && deviceId !== "all") {
    if (!/^\d+$/.test(deviceId)) {
      return NextResponse.json({ error: "Invalid deviceId" }, { status: 400 });
    }
    const parsedDeviceId = parseInt(deviceId, 10);

    // Count games per platform filtered by device
    const counts = await prisma.game.groupBy({
      by: ["platform"],
      where: { devices: { some: { deviceId: parsedDeviceId } } },
      _count: true,
    });

    const countMap = new Map(counts.map((c) => [c.platform, c._count]));

    const platforms = await prisma.platform.findMany({
      where: { gameCount: { gt: 0 } },
      orderBy: { sortOrder: "asc" },
    });

    // Override gameCount with device-filtered count
    const filtered = platforms
      .map((p) => ({ ...p, gameCount: countMap.get(p.id) ?? 0 }))
      .filter((p) => p.gameCount > 0);

    return NextResponse.json(filtered);
  }

  const platforms = await prisma.platform.findMany({
    where: { gameCount: { gt: 0 } },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json(platforms);
}
