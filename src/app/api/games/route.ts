import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const platform = searchParams.get("platform");
  const search = searchParams.get("search");
  const sort = searchParams.get("sort") || "title";
  const order = searchParams.get("order") === "desc" ? "desc" : "asc";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "48", 10) || 48));
  const skip = (page - 1) * limit;

  const favorites = searchParams.get("favorites");
  const tag = searchParams.get("tag");
  const deviceId = searchParams.get("deviceId");

  const where: Record<string, unknown> = {};
  if (platform) where.platform = platform;
  if (search) where.title = { contains: search };
  if (favorites === "true") where.isFavorite = true;
  if (tag) {
    where.OR = [
      { genres: { contains: tag } },
      { themes: { contains: tag } },
    ];
  }
  if (deviceId && deviceId !== "all") {
    const parsedDeviceId = parseInt(deviceId, 10);
    if (isNaN(parsedDeviceId)) {
      return NextResponse.json({ error: "Invalid deviceId" }, { status: 400 });
    }
    where.devices = { some: { deviceId: parsedDeviceId } };
  }

  const orderBy: Record<string, string> = {};
  const validSorts = ["title", "igdbScore", "releaseDate", "createdAt"];
  orderBy[validSorts.includes(sort) ? sort : "title"] = order;

  const [games, total] = await Promise.all([
    prisma.game.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: {
        devices: {
          include: { device: { select: { id: true, name: true, type: true } } },
        },
      },
    }),
    prisma.game.count({ where }),
  ]);

  // Flatten device associations for frontend
  const gamesWithDevices = games.map((game) => ({
    ...game,
    devices: game.devices.map((gd) => gd.device),
  }));

  return NextResponse.json({
    games: gamesWithDevices,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}
