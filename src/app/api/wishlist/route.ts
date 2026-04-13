import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const items = await prisma.wishlistItem.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ items });
  } catch (err) {
    console.error("Failed to fetch wishlist items:", err);
    return NextResponse.json(
      { error: "Failed to fetch wishlist items" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      title,
      platform,
      platformLabel,
      coverUrl,
      igdbScore,
      summary,
      genres,
      screenshots,
      videoIds,
      developer,
      year,
    } = body;

    if (!title || !platform || !platformLabel) {
      return NextResponse.json(
        { error: "title, platform, and platformLabel are required" },
        { status: 400 }
      );
    }

    const item = await prisma.wishlistItem.upsert({
      where: {
        title_platform: { title, platform },
      },
      update: {
        platformLabel,
        coverUrl: coverUrl ?? null,
        igdbScore: igdbScore ?? null,
        summary: summary ?? null,
        genres: genres ?? null,
        screenshots: screenshots ?? null,
        videoIds: videoIds ?? null,
        developer: developer ?? null,
        year: year ?? null,
      },
      create: {
        title,
        platform,
        platformLabel,
        coverUrl: coverUrl ?? null,
        igdbScore: igdbScore ?? null,
        summary: summary ?? null,
        genres: genres ?? null,
        screenshots: screenshots ?? null,
        videoIds: videoIds ?? null,
        developer: developer ?? null,
        year: year ?? null,
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    console.error("Failed to create wishlist item:", err);
    return NextResponse.json(
      { error: "Failed to create wishlist item" },
      { status: 500 }
    );
  }
}
