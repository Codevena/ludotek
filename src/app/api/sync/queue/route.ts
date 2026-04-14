import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// GET /api/sync/queue — list pending queue items grouped by device
export async function GET(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const items = await prisma.syncQueue.findMany({
    where: { status: { in: ["pending", "failed"] } },
    include: {
      device: { select: { id: true, name: true } },
      game: { select: { id: true, title: true, platform: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const pendingCount = items.filter((i) => i.status === "pending").length;

  return NextResponse.json({ items, count: pendingCount });
}

// POST /api/sync/queue — add item to queue
export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const body = await request.json();
  const { type, deviceId, gameId, filePath, newPath } = body;

  if (!type || !deviceId || !gameId || !filePath) {
    return NextResponse.json(
      { error: "type, deviceId, gameId, and filePath are required" },
      { status: 400 },
    );
  }

  if (type !== "rename" && type !== "delete") {
    return NextResponse.json(
      { error: "type must be 'rename' or 'delete'" },
      { status: 400 },
    );
  }

  if (type === "rename" && !newPath) {
    return NextResponse.json(
      { error: "newPath is required for rename operations" },
      { status: 400 },
    );
  }

  if (!/^\d+$/.test(String(deviceId)) || !/^\d+$/.test(String(gameId))) {
    return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
  }

  // Validate filePath and newPath are within device scan paths (prevent path traversal)
  const device = await prisma.device.findUnique({
    where: { id: Number(deviceId) },
    select: { scanPaths: true },
  });
  if (!device) {
    return NextResponse.json({ error: "Device not found" }, { status: 404 });
  }

  let scanRoots: string[];
  try {
    const parsed = JSON.parse(device.scanPaths) as { path: string }[];
    scanRoots = parsed.map((sp) => sp.path);
  } catch {
    return NextResponse.json(
      { error: "Device has invalid scan path config" },
      { status: 500 },
    );
  }

  const isWithinScanPaths = (p: string) =>
    scanRoots.some((root) => p.startsWith(root + "/"));

  if (!isWithinScanPaths(filePath)) {
    return NextResponse.json(
      { error: "filePath is outside device scan paths" },
      { status: 400 },
    );
  }

  if (type === "rename" && newPath && !isWithinScanPaths(newPath)) {
    return NextResponse.json(
      { error: "newPath is outside device scan paths" },
      { status: 400 },
    );
  }

  // For rename: replace existing pending rename for same file+device (only latest counts)
  if (type === "rename") {
    await prisma.syncQueue.deleteMany({
      where: {
        deviceId: Number(deviceId),
        gameId: Number(gameId),
        filePath,
        type: "rename",
        status: "pending",
      },
    });
  }

  // Don't allow duplicate delete entries
  if (type === "delete") {
    const existing = await prisma.syncQueue.findFirst({
      where: {
        deviceId: Number(deviceId),
        gameId: Number(gameId),
        filePath,
        type: "delete",
        status: "pending",
      },
    });
    if (existing) {
      return NextResponse.json({ item: existing });
    }
  }

  const item = await prisma.syncQueue.create({
    data: {
      type,
      deviceId: Number(deviceId),
      gameId: Number(gameId),
      filePath,
      newPath: type === "rename" ? newPath : null,
      status: "pending",
    },
  });

  return NextResponse.json({ item }, { status: 201 });
}

// DELETE /api/sync/queue — clear all pending items
export async function DELETE(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const { count } = await prisma.syncQueue.deleteMany({
    where: { status: { in: ["pending", "failed"] } },
  });

  return NextResponse.json({ cleared: count });
}
