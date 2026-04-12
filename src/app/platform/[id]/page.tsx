import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { GameGrid } from "@/components/game-grid";
import { SortSelect } from "@/components/sort-select";
import { Suspense } from "react";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    sort?: string;
    order?: string;
    page?: string;
  }>;
}

export default async function PlatformPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;

  const platform = await prisma.platform.findUnique({ where: { id } });
  if (!platform) notFound();

  const sort = sp.sort || "title";
  const order = sp.order === "desc" ? "desc" as const : "asc" as const;
  const page = Math.max(1, parseInt(sp.page || "1", 10));
  const limit = 48;

  const validSorts = ["title", "igdbScore", "releaseDate", "createdAt"];
  const orderBy: Record<string, string> = {};
  orderBy[validSorts.includes(sort) ? sort : "title"] = order;

  const [games, total] = await Promise.all([
    prisma.game.findMany({
      where: { platform: id },
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.game.count({ where: { platform: id } }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <Link
        href="/"
        className="text-vault-muted hover:text-vault-text text-sm mb-4 inline-block"
      >
        &larr; All platforms
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl font-bold flex items-center gap-3">
            <span>{platform.icon}</span>
            {platform.label}
          </h1>
          <p className="text-vault-muted text-sm mt-1">
            {total} {total === 1 ? "game" : "games"}
          </p>
        </div>
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
                href={`?sort=${sort}&order=${order}&page=${p}`}
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
