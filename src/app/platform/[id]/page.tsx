import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { InfiniteGameGrid } from "@/components/infinite-game-grid";
import { SortSelect } from "@/components/sort-select";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { PlatformStats } from "@/components/platform-stats";
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
  const tag = sp.tag || null;
  const limit = 48;

  const validSorts = ["title", "igdbScore", "releaseDate", "createdAt"];
  const orderBy: Record<string, string> = {};
  orderBy[validSorts.includes(sort) ? sort : "title"] = order;

  const where: Record<string, unknown> = { platform: id };
  if (tag) {
    where.OR = [
      { genres: { contains: tag } },
      { themes: { contains: tag } },
    ];
  }

  const [games, total] = await Promise.all([
    prisma.game.findMany({
      where,
      orderBy,
      take: limit,
    }),
    prisma.game.count({ where }),
  ]);

  const fetchParams = new URLSearchParams({ platform: id, sort, order, limit: String(limit) });
  if (tag) fetchParams.set("tag", tag);
  const fetchUrl = `/api/games?${fetchParams.toString()}`;

  return (
    <div>
      <Breadcrumbs items={[
        { label: "Home", href: "/" },
        ...(tag
          ? [{ label: platform.label, href: `/platform/${id}` }, { label: tag }]
          : [{ label: platform.label }]),
      ]} />

      <PlatformStats platformId={id} />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl font-bold flex items-center gap-3">
            <span>{platform.icon}</span>
            {platform.label}
          </h1>
          {tag && (
            <div className="flex items-center gap-2 mt-1">
              <Link
                href={`/platform/${id}`}
                className="text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors"
              >
                Clear filter
              </Link>
            </div>
          )}
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

      <InfiniteGameGrid initialGames={games} total={total} fetchUrl={fetchUrl} />
    </div>
  );
}
