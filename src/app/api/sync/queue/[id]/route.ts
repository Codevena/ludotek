import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// DELETE /api/sync/queue/[id] — remove single item from queue
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const { id } = await params;
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  // Only allow removal of pending/failed items — in_progress items are being applied
  const deleted = await prisma.syncQueue.deleteMany({
    where: { id: Number(id), status: { not: "in_progress" } },
  });

  if (deleted.count === 0) {
    return NextResponse.json(
      { error: "Item not found or currently being applied" },
      { status: 404 },
    );
  }

  return NextResponse.json({ deleted: true });
}
