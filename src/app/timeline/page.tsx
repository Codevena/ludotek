"use client";

import { useState, useEffect, useMemo } from "react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { EraBar } from "@/components/timeline/era-bar";
import { EraHeader } from "@/components/timeline/era-header";
import { InfiniteGameGrid } from "@/components/infinite-game-grid";
import { SortSelect } from "@/components/sort-select";
import { ERA_BUCKETS, findEraBySlug, type EraSlug } from "@/lib/eras";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

interface EraCount {
  slug: EraSlug;
  count: number;
}

interface Game {
  id: number;
  title: string;
  coverUrl: string | null;
  localCoverPath?: string | null;
  platformLabel: string;
  igdbScore: number | null;
  metacriticScore: number | null;
  isFavorite?: boolean;
  devices?: { id: number; name: string; type: string }[];
}

function TimelineContent() {
  const searchParams = useSearchParams();
  const sort = searchParams.get("sort") || "igdbScore";
  const order = searchParams.get("order") || "desc";
  const search = searchParams.get("search") || "";

  const [eraCounts, setEraCounts] = useState<EraCount[]>([]);
  const [activeEra, setActiveEra] = useState<EraSlug | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [total, setTotal] = useState(0);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countsError, setCountsError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Fetch era counts on mount (and on retry)
  useEffect(() => {
    setCountsError(false);
    fetch("/api/timeline/counts")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch counts");
        return r.json();
      })
      .then((counts: EraCount[]) => {
        if (counts.length === 0) return;
        setEraCounts(counts);
        // Select era with most games
        const maxEra = counts.reduce((max, c) =>
          c.count > max.count ? c : max, counts[0]
        );
        if (maxEra) setActiveEra(maxEra.slug);
      })
      .catch((err) => {
        console.error("Failed to load era counts:", err);
        setCountsError(true);
      });
  }, [retryCount]);

  // Fetch games when era/sort/search changes
  useEffect(() => {
    if (!activeEra) return;
    setLoading(true);
    setError(null);

    const controller = new AbortController();

    const params = new URLSearchParams({
      era: activeEra,
      sort,
      order,
      limit: "48",
    });
    if (search) params.set("search", search);

    fetch(`/api/games?${params.toString()}`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch games");
        return r.json();
      })
      .then((data) => {
        setGames(data.games || []);
        setTotal(data.pagination?.total ?? 0);
        // Extract distinct platform labels (from first page — representative, not exhaustive)
        const labels = new Set<string>();
        for (const g of data.games || []) {
          if (g.platformLabel) labels.add(g.platformLabel);
        }
        setPlatforms(Array.from(labels).sort());
        setLoading(false);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("Failed to load games:", err);
        setGames([]);
        setTotal(0);
        setPlatforms([]);
        setError("Spiele konnten nicht geladen werden.");
        setLoading(false);
      });

    return () => controller.abort();
  }, [activeEra, sort, order, search, retryCount]);

  const currentBucket = activeEra ? findEraBySlug(activeEra) : undefined;

  const eraBarData = useMemo(
    () =>
      ERA_BUCKETS.map((b) => ({
        slug: b.slug,
        shortName: b.shortName,
        count: eraCounts.find((c) => c.slug === b.slug)?.count ?? 0,
        color: b.color,
      })),
    [eraCounts]
  );

  const fetchUrl = useMemo(() => {
    if (!activeEra) return "";
    const p = new URLSearchParams({ era: activeEra, sort, order, limit: "48" });
    if (search) p.set("search", search);
    return `/api/games?${p.toString()}`;
  }, [activeEra, sort, order, search]);

  const activeCount = eraCounts.find((c) => c.slug === activeEra)?.count ?? 0;

  if (countsError) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400 text-sm mb-3">Ären konnten nicht geladen werden.</p>
        <button
          onClick={() => setRetryCount((c) => c + 1)}
          className="px-4 py-2 bg-vault-surface border border-vault-border rounded-lg text-sm text-vault-text hover:border-vault-amber transition-colors"
        >
          Erneut versuchen
        </button>
      </div>
    );
  }

  if (eraCounts.length === 0) {
    return (
      <div className="space-y-4">
        {/* Skeleton pills */}
        <div className="flex gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-8 w-24 rounded-full bg-vault-surface animate-pulse" />
          ))}
        </div>
        {/* Skeleton grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 mt-8">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] rounded-lg bg-vault-surface animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="transition-all duration-500 ease-in-out rounded-xl -m-2 p-2"
      style={{
        background: currentBucket
          ? `radial-gradient(ellipse at top, ${currentBucket.color}14 0%, transparent 60%)`
          : undefined,
      }}
    >
      {activeEra && (
        <EraBar
          eras={eraBarData}
          activeEra={activeEra}
          onEraChange={setActiveEra}
        />
      )}

      {currentBucket && (
        <EraHeader
          era={currentBucket}
          gameCount={activeCount}
          platforms={platforms}
        />
      )}

      <div className="flex items-center justify-between mb-4">
        <div />
        <Suspense>
          <SortSelect />
        </Suspense>
      </div>

      {error ? (
        <div className="text-center py-12">
          <p className="text-red-400 text-sm mb-3">{error}</p>
          <button
            onClick={() => setRetryCount((c) => c + 1)}
            className="px-4 py-2 bg-vault-surface border border-vault-border rounded-lg text-sm text-vault-text hover:border-vault-amber transition-colors"
          >
            Erneut versuchen
          </button>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] rounded-lg bg-vault-surface animate-pulse" />
          ))}
        </div>
      ) : (
        <InfiniteGameGrid
          initialGames={games}
          total={total}
          fetchUrl={fetchUrl}
        />
      )}
    </div>
  );
}

export default function TimelinePage() {
  return (
    <div className="max-w-7xl mx-auto">
      <Breadcrumbs
        items={[{ label: "Home", href: "/" }, { label: "Timeline" }]}
      />
      <h1 className="font-heading text-2xl font-bold mb-6">Timeline</h1>
      <Suspense>
        <TimelineContent />
      </Suspense>
    </div>
  );
}
