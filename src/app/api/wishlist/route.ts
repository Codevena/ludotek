import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PLATFORM_CONFIG } from "@/lib/platforms";

export async function GET() {
  try {
    const items = await prisma.wishlistItem.findMany({
      orderBy: { createdAt: "desc" },
    });
    // Resolve platformLabel from PLATFORM_CONFIG to ensure correctness
    const resolved = items.map((item) => {
      const config = PLATFORM_CONFIG.find((p) => p.id === item.platform);
      return {
        ...item,
        platformLabel: config?.label ?? item.platformLabel,
      };
    });
    return NextResponse.json({ items: resolved });
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

    if (!title || !platform) {
      return NextResponse.json(
        { error: "title and platform are required" },
        { status: 400 }
      );
    }

    // Always resolve label from PLATFORM_CONFIG for correctness
    const resolvedLabel = PLATFORM_CONFIG.find((p) => p.id === platform)?.label ?? platformLabel ?? platform;

    const item = await prisma.wishlistItem.upsert({
      where: {
        title_platform: { title, platform },
      },
      update: {
        platformLabel: resolvedLabel,
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
        platformLabel: resolvedLabel,
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
