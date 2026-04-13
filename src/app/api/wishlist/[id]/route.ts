import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const itemId = parseInt(id, 10);

    if (isNaN(itemId)) {
      return NextResponse.json(
        { error: "Invalid wishlist item ID" },
        { status: 400 }
      );
    }

    await prisma.wishlistItem.delete({ where: { id: itemId } });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      return NextResponse.json(
        { error: "Wishlist item not found" },
        { status: 404 }
      );
    }
    console.error("Failed to delete wishlist item:", err);
    return NextResponse.json(
      { error: "Failed to delete wishlist item" },
      { status: 500 }
    );
  }
}
