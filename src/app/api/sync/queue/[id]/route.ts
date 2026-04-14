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

  try {
    await prisma.syncQueue.delete({ where: { id: Number(id) } });
    return NextResponse.json({ deleted: true });
  } catch {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }
}
