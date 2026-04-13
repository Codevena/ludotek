import { prisma } from "@/lib/prisma";
import { GameGrid } from "@/components/game-grid";
import { GameCard } from "@/components/game-card";
import { SortSelect } from "@/components/sort-select";
import { StatsDashboard } from "@/components/stats-dashboard";
import { Suspense } from "react";

interface Props {
  searchParams: Promise<{
    search?: string;
    sort?: string;
    order?: string;
    page?: string;
  }>;
}

async function RecentlyAdded() {
  const games = await prisma.game.findMany({
    orderBy: { createdAt: "desc" },
    take: 6,
  });
  if (games.length === 0) return null;
  return (
    <section className="mb-8">
      <h2 className="font-heading text-xl font-bold mb-4">Recently Added</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {games.map((game) => (
          <GameCard key={game.id} id={game.id} title={game.title} coverUrl={game.coverUrl}
            platformLabel={game.platformLabel} igdbScore={game.igdbScore}
            metacriticScore={game.metacriticScore} />
        ))}
      </div>
    </section>
  );
}

async function TopRated() {
  const games = await prisma.game.findMany({
    where: { igdbScore: { not: null } },
    orderBy: { igdbScore: "desc" },
    take: 6,
  });
  if (games.length === 0) return null;
  return (
    <section className="mb-8">
      <h2 className="font-heading text-xl font-bold mb-4">Top Rated</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {games.map((game) => (
          <GameCard key={game.id} id={game.id} title={game.title} coverUrl={game.coverUrl}
            platformLabel={game.platformLabel} igdbScore={game.igdbScore}
            metacriticScore={game.metacriticScore} />
        ))}
      </div>
    </section>
  );
}

export default async function HomePage({ searchParams }: Props) {
  const params = await searchParams;
  const search = params.search;
  const sort = params.sort || "title";
  const order = params.order === "desc" ? "desc" as const : "asc" as const;
  const page = Math.max(1, parseInt(params.page || "1", 10) || 1);
  const limit = 48;

  const where: Record<string, unknown> = {};
  if (search) where.title = { contains: search };

  const validSorts = ["title", "igdbScore", "releaseDate", "createdAt"];
  const orderBy: Record<string, string> = {};
  orderBy[validSorts.includes(sort) ? sort : "title"] = order;

  const [games, total] = await Promise.all([
    prisma.game.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.game.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <StatsDashboard />

      {!search && (
        <>
          <Suspense>
            <RecentlyAdded />
          </Suspense>
          <Suspense>
            <TopRated />
          </Suspense>
        </>
      )}

      <div className="flex items-center justify-between mb-6">
        <h2 className="font-heading text-xl font-bold">
          {search ? `Results for "${search}"` : "All Games"}
          <span className="text-vault-muted text-sm font-normal ml-2">
            ({total.toLocaleString()})
          </span>
        </h2>
        <Suspense>
          <SortSelect />
        </Suspense>
      </div>

      <GameGrid games={games} />

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-8">
          {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map(
            (p) => (
              <a
                key={p}
                href={`?${new URLSearchParams({
                  ...(search ? { search } : {}),
                  sort,
                  order,
                  page: p.toString(),
                }).toString()}`}
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
