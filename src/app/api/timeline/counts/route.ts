import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ERA_BUCKETS } from "@/lib/eras";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const games = await prisma.game.findMany({
      where: { releaseDate: { not: null } },
      select: { releaseDate: true },
    });

    const counts = ERA_BUCKETS.map((bucket) => {
      const count = games.filter((g) => {
        const year = new Date(g.releaseDate!).getFullYear();
        return year >= bucket.minYear && year <= bucket.maxYear;
      }).length;
      return { slug: bucket.slug, count };
    });

    return NextResponse.json(counts);
  } catch (error) {
    console.error("Timeline counts error:", error);
    return NextResponse.json({ error: "Failed to load counts" }, { status: 500 });
  }
}
