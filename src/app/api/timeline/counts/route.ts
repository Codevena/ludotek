import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ERA_BUCKETS } from "@/lib/eras";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Count games per era with individual DB queries (avoids loading all games into memory)
    const counts = await Promise.all(
      ERA_BUCKETS.map(async (bucket) => {
        const count = await prisma.game.count({
          where: {
            releaseDate: {
              gte: new Date(bucket.minYear, 0, 1),
              lt: new Date(bucket.maxYear === 9999 ? 2100 : bucket.maxYear + 1, 0, 1),
              not: null,
            },
          },
        });
        return { slug: bucket.slug, count };
      })
    );

    return NextResponse.json(counts);
  } catch (error) {
    console.error("Timeline counts error:", error);
    return NextResponse.json({ error: "Failed to load counts" }, { status: 500 });
  }
}
