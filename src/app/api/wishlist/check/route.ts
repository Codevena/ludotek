import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const title = searchParams.get("title");
    const platform = searchParams.get("platform");

    if (!title || !platform) {
      return NextResponse.json(
        { error: "title and platform query parameters are required" },
        { status: 400 }
      );
    }

    const item = await prisma.wishlistItem.findUnique({
      where: {
        title_platform: { title, platform },
      },
      select: { id: true },
    });

    if (item) {
      return NextResponse.json({ onWishlist: true, id: item.id });
    }

    return NextResponse.json({ onWishlist: false });
  } catch (err) {
    console.error("Failed to check wishlist:", err);
    return NextResponse.json(
      { error: "Failed to check wishlist" },
      { status: 500 }
    );
  }
}
