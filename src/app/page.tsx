import { cache, Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { GameCard } from "@/components/game-card";
import { SortSelect } from "@/components/sort-select";
import { StatsDashboard } from "@/components/stats-dashboard";
import { InfiniteGameGrid } from "@/components/infinite-game-grid";
import { SetupRedirect } from "@/components/setup-redirect";
import { coverUrl } from "@/lib/image-url";

const getActiveDeviceId = cache(async () => {
  const settings = await prisma.settings.findFirst();
  return settings?.activeDeviceId ?? null;
});

interface Props {
  searchParams: Promise<{
    search?: string;
    sort?: string;
    order?: string;
    page?: string;
    favorites?: string;
  }>;
}

async function RecentlyAdded() {
  const deviceId = await getActiveDeviceId();
  const where: Record<string, unknown> = {};
  if (deviceId) where.devices = { some: { deviceId } };

  const games = await prisma.game.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 6,
    include: {
      devices: {
        include: { device: { select: { id: true, name: true, type: true } } },
      },
    },
  });
  const gamesWithDevices = games.map((g) => ({
    ...g,
    devices: g.devices.map((gd) => gd.device),
  }));

  if (gamesWithDevices.length === 0) return null;
  return (
    <section className="mb-8">
      <h2 className="font-heading text-xl font-bold mb-4">Recently Added</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {gamesWithDevices.map((game) => (
          <GameCard key={game.id} id={game.id} title={game.title} coverUrl={coverUrl(game) ?? null}
            platformLabel={game.platformLabel} igdbScore={game.igdbScore}
            metacriticScore={game.metacriticScore} isFavorite={game.isFavorite}
            devices={game.devices} />
        ))}
      </div>
    </section>
  );
}

async function TopRated() {
  const deviceId = await getActiveDeviceId();
  const where: Record<string, unknown> = { igdbScore: { not: null } };
  if (deviceId) where.devices = { some: { deviceId } };

  const games = await prisma.game.findMany({
    where,
    orderBy: { igdbScore: "desc" },
    take: 6,
    include: {
      devices: {
        include: { device: { select: { id: true, name: true, type: true } } },
      },
    },
  });
  const gamesWithDevices = games.map((g) => ({
    ...g,
    devices: g.devices.map((gd) => gd.device),
  }));

  if (gamesWithDevices.length === 0) return null;
  return (
    <section className="mb-8">
      <h2 className="font-heading text-xl font-bold mb-4">Top Rated</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {gamesWithDevices.map((game) => (
          <GameCard key={game.id} id={game.id} title={game.title} coverUrl={coverUrl(game) ?? null}
            platformLabel={game.platformLabel} igdbScore={game.igdbScore}
            metacriticScore={game.metacriticScore} isFavorite={game.isFavorite}
            devices={game.devices} />
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
  const favorites = params.favorites === "true";
  const limit = 48;

  const activeDeviceId = await getActiveDeviceId();

  const where: Record<string, unknown> = {};
  if (search) where.title = { contains: search };
  if (favorites) where.isFavorite = true;
  if (activeDeviceId) where.devices = { some: { deviceId: activeDeviceId } };

  const validSorts = ["title", "igdbScore", "releaseDate", "createdAt"];
  const orderBy: Record<string, string> = {};
  orderBy[validSorts.includes(sort) ? sort : "title"] = order;

  const [games, total] = await Promise.all([
    prisma.game.findMany({
      where,
      orderBy,
      take: limit,
      include: {
        devices: {
          include: { device: { select: { id: true, name: true, type: true } } },
        },
      },
    }),
    prisma.game.count({ where }),
  ]);

  const gamesWithDevices = games.map((g) => ({
    ...g,
    devices: g.devices.map((gd) => gd.device),
  }));

  // Build fetch URL for infinite scroll
  const fetchParams = new URLSearchParams({ sort, order, limit: String(limit) });
  if (search) fetchParams.set("search", search);
  if (favorites) fetchParams.set("favorites", "true");
  if (activeDeviceId) fetchParams.set("deviceId", String(activeDeviceId));
  const fetchUrl = `/api/games?${fetchParams.toString()}`;

  return (
    <div>
      <Suspense>
        <SetupRedirect />
      </Suspense>
      <StatsDashboard />

      {!search && !favorites && (
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
          {favorites ? "Favorites" : search ? `Results for "${search}"` : "All Games"}
          <span className="text-vault-muted text-sm font-normal ml-2">
            ({total.toLocaleString()})
          </span>
        </h2>
        <Suspense>
          <SortSelect />
        </Suspense>
      </div>

      <InfiniteGameGrid initialGames={gamesWithDevices} total={total} fetchUrl={fetchUrl} emptyMessage={activeDeviceId ? "No games on this device" : undefined} />
    </div>
  );
}
