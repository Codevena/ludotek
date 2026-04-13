import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { GameGrid } from "@/components/game-grid";
import { SortSelect } from "@/components/sort-select";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Suspense } from "react";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    sort?: string;
    order?: string;
    page?: string;
    tag?: string;
  }>;
}

export default async function PlatformPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;

  const platform = await prisma.platform.findUnique({ where: { id } });
  if (!platform) notFound();

  const sort = sp.sort || "title";
  const order = sp.order === "desc" ? "desc" as const : "asc" as const;
  const page = Math.max(1, parseInt(sp.page || "1", 10) || 1);
  const tag = sp.tag || null;
  const limit = 48;

  const validSorts = ["title", "igdbScore", "releaseDate", "createdAt"];
  const orderBy: Record<string, string> = {};
  orderBy[validSorts.includes(sort) ? sort : "title"] = order;

  // Base filter: platform. If tag is set, also filter by genre or theme (stored as JSON strings).
  const where: Record<string, unknown> = { platform: id };
  if (tag) {
    // Match tag in genres OR themes JSON arrays (SQLite string contains)
    where.OR = [
      { genres: { contains: tag } },
      { themes: { contains: tag } },
    ];
  }

  const [games, total, avgScore] = await Promise.all([
    prisma.game.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.game.count({ where }),
    prisma.game.aggregate({
      where,
      _avg: { igdbScore: true },
    }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <Breadcrumbs items={[
        { label: "Home", href: "/" },
        ...(tag
          ? [{ label: platform.label, href: `/platform/${id}` }, { label: tag }]
          : [{ label: platform.label }]),
      ]} />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl font-bold flex items-center gap-3">
            <span>{platform.icon}</span>
            {platform.label}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-vault-muted text-sm">
              {total} {total === 1 ? "game" : "games"}
              {avgScore._avg.igdbScore && (
                <span className="ml-3">Avg Score: {Math.round(avgScore._avg.igdbScore)}</span>
              )}
            </p>
            {tag && (
              <Link
                href={`/platform/${id}`}
                className="text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors"
              >
                Clear filter
              </Link>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/discover?platforms=${id}&surprise=true`}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-vault-amber/20 text-vault-amber border border-vault-amber/30 hover:bg-vault-amber/30 transition-colors"
          >
            Surprise Me
          </Link>
          <Suspense>
            <SortSelect />
          </Suspense>
        </div>
      </div>

      <GameGrid games={games} />

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-8">
          {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map(
            (p) => (
              <a
                key={p}
                href={`?sort=${sort}&order=${order}&page=${p}${tag ? `&tag=${encodeURIComponent(tag)}` : ""}`}
                className={`px-3 py-1 rounded text-sm ${
                  p === page
                    ? "bg-vault-amber text-black font-bold"
                    : "bg-vault-surface text-vault-muted hover:text-vault-text"
                }`}
              >
                {p}
              </a>
            )
          )}
        </div>
      )}
    </div>
  );
}
