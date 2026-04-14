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
    if (!/^\d+$/.test(deviceId)) {
      return NextResponse.json({ error: "Invalid deviceId" }, { status: 400 });
    }
    where.devices = { some: { deviceId: parseInt(deviceId, 10) } };
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

  // Deduplicate games when showing all devices
  // (same game scanned from different devices creates separate Game records)
  let deduped = gamesWithDevices;
  if (!deviceId || deviceId === "all") {
    const seenByIgdb = new Map<number, typeof gamesWithDevices[0]>();
    const seenByTitlePlatform = new Map<string, typeof gamesWithDevices[0]>();
    const result: typeof gamesWithDevices = [];
    for (const game of gamesWithDevices) {
      let existing: typeof gamesWithDevices[0] | undefined;

      if (game.igdbId) {
        existing = seenByIgdb.get(game.igdbId);
      }
      if (!existing) {
        const key = `${game.title}|${game.platform}`;
        existing = seenByTitlePlatform.get(key);
      }

      if (existing) {
        // Merge devices into existing entry
        for (const dev of game.devices) {
          if (!existing.devices.some((d) => d.id === dev.id)) {
            existing.devices.push(dev);
          }
        }
      } else {
        if (game.igdbId) seenByIgdb.set(game.igdbId, game);
        seenByTitlePlatform.set(`${game.title}|${game.platform}`, game);
        result.push(game);
      }
    }
    deduped = result;
  }

  // When deduplicating, adjust total to reflect unique count
  const adjustedTotal = deduped.length < gamesWithDevices.length
    ? Math.max(total - (gamesWithDevices.length - deduped.length), deduped.length)
    : total;

  return NextResponse.json({
    games: deduped,
    pagination: { page, limit, total: adjustedTotal, totalPages: Math.ceil(adjustedTotal / limit) },
  });
}
