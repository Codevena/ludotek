import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { coverUrl } from "@/lib/image-url";
import { findEraBySlug } from "@/lib/eras";
import { groupGameIds } from "@/lib/game-groups";

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
  const era = searchParams.get("era");

  const where: Record<string, unknown> = {};
  if (platform) where.platform = platform;
  if (search) where.title = { contains: search };
  if (favorites === "true") where.isFavorite = true;
  if (tag) {
    // genres/themes are JSON arrays stored as strings (e.g. ["Horror","Sports"]).
    // Anchor on the surrounding quotes so tag="or" doesn't match "Horror"/"Sports".
    const quoted = `"${tag}"`;
    where.OR = [
      { genres: { contains: quoted } },
      { themes: { contains: quoted } },
    ];
  }
  if (deviceId && deviceId !== "all") {
    if (!/^\d+$/.test(deviceId)) {
      return NextResponse.json({ error: "Invalid deviceId" }, { status: 400 });
    }
    where.devices = { some: { deviceId: parseInt(deviceId, 10) } };
  }
  if (era) {
    const bucket = findEraBySlug(era);
    if (!bucket) {
      return NextResponse.json({ error: "Invalid era" }, { status: 400 });
    }
    where.releaseDate = {
      gte: new Date(bucket.minYear, 0, 1),
      lt: new Date(bucket.maxYear === 9999 ? 2100 : bucket.maxYear + 1, 0, 1),
      not: null,
    };
  }

  const validSorts = ["title", "igdbScore", "releaseDate", "createdAt"];
  const orderBy: Record<string, "asc" | "desc">[] = [
    { [validSorts.includes(sort) ? sort : "title"]: order },
    { id: "asc" },
  ];
  const include = {
    devices: { include: { device: { select: { id: true, name: true, type: true } } } },
  } as const;
  const flatten = (game: Awaited<ReturnType<typeof prisma.game.findMany>>[number] & {
    devices: { device: { id: number; name: string; type: string } }[];
  }) => ({ ...game, coverUrl: coverUrl(game) ?? null, devices: game.devices.map((gd) => gd.device) });

  // Keep grouping, count and page reads in one SQLite snapshot. Only lightweight
  // identities are read for the full catalog; metadata is fetched for page groups.
  const { games, total } = await prisma.$transaction(async (transaction) => {
    if (deviceId && deviceId !== "all") {
      const rows = await transaction.game.findMany({ where, orderBy, skip, take: limit, include });
      return { games: rows.map(flatten), total: await transaction.game.count({ where }) };
    }
    const identities = await transaction.game.findMany({
      where, orderBy, select: { id: true, igdbId: true, title: true, platform: true },
    });
    const groups = groupGameIds(identities);
    const pageGroups = groups.slice(skip, skip + limit);
    if (pageGroups.length === 0) return { games: [], total: groups.length };
    const rows = await transaction.game.findMany({
      where: { id: { in: pageGroups.flat() } }, include,
    });
    const byId = new Map(rows.map((row) => [row.id, flatten(row)]));
    const merged = pageGroups.map((ids) => {
      const representative = byId.get(ids[0])!;
      const devices = new Map(representative.devices.map((device) => [device.id, device]));
      for (const id of ids.slice(1)) {
        for (const device of byId.get(id)!.devices) devices.set(device.id, device);
      }
      return { ...representative, devices: Array.from(devices.values()) };
    });
    return { games: merged, total: groups.length };
  });

  return NextResponse.json({
    games,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}
