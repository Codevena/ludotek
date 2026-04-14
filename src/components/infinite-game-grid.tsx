"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { GameCard } from "./game-card";

interface Game {
  id: number;
  title: string;
  coverUrl: string | null;
  platformLabel: string;
  igdbScore: number | null;
  metacriticScore: number | null;
  isFavorite?: boolean;
  devices?: { id: number; name: string; type: string }[];
}

interface InfiniteGameGridProps {
  initialGames: Game[];
  total: number;
  fetchUrl: string;
}

export function InfiniteGameGrid({ initialGames, total, fetchUrl }: InfiniteGameGridProps) {
  const [games, setGames] = useState<Game[]>(initialGames);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialGames.length < total);
  const observerRef = useRef<HTMLDivElement | null>(null);

  // Reset when initialGames/fetchUrl changes (e.g. sort or search changed)
  useEffect(() => {
    setGames(initialGames);
    setPage(1);
    setHasMore(initialGames.length < total);
  }, [initialGames, total]);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);

    try {
      const nextPage = page + 1;
      const separator = fetchUrl.includes("?") ? "&" : "?";
      const res = await fetch(`${fetchUrl}${separator}page=${nextPage}`);
      if (!res.ok) throw new Error("Fetch failed");
      const data = await res.json();

      const newGames: Game[] = data.games || [];
      if (newGames.length === 0) {
        setHasMore(false);
      } else {
        setGames((prev) => [...prev, ...newGames]);
        setPage(nextPage);
        const totalLoaded = games.length + newGames.length;
        setHasMore(totalLoaded < (data.pagination?.total ?? total));
      }
    } catch (err) {
      console.error("Failed to load more games:", err);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, page, fetchUrl, games.length, total]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const el = observerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: "400px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  if (games.length === 0) {
    return (
      <div className="text-center text-vault-muted py-20">
        <p className="text-lg">No games found</p>
        <p className="text-sm mt-2">Try scanning your Steam Deck in the Admin panel</p>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {games.map((game) => (
          <GameCard
            key={game.id}
            id={game.id}
            title={game.title}
            coverUrl={game.coverUrl}
            platformLabel={game.platformLabel}
            igdbScore={game.igdbScore}
            metacriticScore={game.metacriticScore}
            isFavorite={game.isFavorite}
            devices={game.devices}
          />
        ))}
      </div>

      {/* Sentinel for intersection observer */}
      <div ref={observerRef} className="h-4" />

      {loading && (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 rounded-full bg-vault-amber animate-pulse" />
        </div>
      )}

      {!hasMore && games.length > 0 && (
        <p className="text-center text-vault-muted text-sm py-6">
          Alle {total} Spiele geladen
        </p>
      )}
    </div>
  );
}
