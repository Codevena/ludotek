"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { buildRomSearchUrl } from "@/lib/rom-search";
import { PLATFORM_CONFIG } from "@/lib/platforms";

/* ---------- Types ---------- */

interface PlatformStatsProps {
  platformId: string;
}

interface StatsData {
  gameCount: number;
  avgScore: number | null;
  coverPercent: number;
  aiPercent: number;
  genreCounts: { genre: string; count: number }[];
}

interface MissingGame {
  title: string;
  coverUrl?: string | null;
  developer?: string | null;
  year?: number | null;
  genres?: string[];
  score?: number | null;
  summary?: string | null;
  screenshots?: string[];
  videoIds?: string[];
}

interface WishlistItem {
  id: number;
  title: string;
  platform: string;
}

/* ---------- Skeletons ---------- */

function SkeletonCards() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="bg-vault-surface animate-pulse rounded-xl h-20"
        />
      ))}
    </div>
  );
}

/* ---------- Stat Card ---------- */

function StatCard({
  value,
  label,
  color,
}: {
  value: string;
  label: string;
  color: string;
}) {
  return (
    <div className="bg-vault-surface border border-vault-border rounded-xl p-4 text-center">
      <p className={`font-heading text-3xl font-bold ${color}`}>{value}</p>
      <p className="text-vault-muted text-sm">{label}</p>
    </div>
  );
}

/* ---------- Score Badge Color ---------- */

function scoreColor(score: number): string {
  if (score >= 75) return "bg-green-500";
  if (score >= 50) return "bg-amber-500";
  return "bg-red-500";
}

function scoreTextColor(score: number): string {
  if (score >= 75) return "text-green-400";
  if (score >= 50) return "text-vault-amber";
  return "text-red-400";
}

/* ---------- Game Card ---------- */

function GameCard({
  game,
  isWishlisted,
  onToggleWishlist,
  onSelect,
  romSearchUrl,
  platformId,
  platformLabel,
}: {
  game: MissingGame;
  isWishlisted: boolean;
  onToggleWishlist: (e: React.MouseEvent) => void;
  onSelect: () => void;
  romSearchUrl: string;
  platformId: string;
  platformLabel?: string;
}) {
  const searchUrl = romSearchUrl ? buildRomSearchUrl(romSearchUrl, game.title, platformId, platformLabel) : undefined;
  return (
    <div
      onClick={onSelect}
      className="w-[200px] flex-shrink-0 bg-vault-surface border border-vault-border rounded-xl overflow-hidden hover:border-vault-amber/50 transition-all cursor-pointer"
      style={{ scrollSnapAlign: "start" }}
    >
      {/* Cover */}
      <div className="relative w-full h-[260px]">
        {game.coverUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={game.coverUrl}
            alt={game.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-vault-amber/20 to-purple-500/20" />
        )}

        {/* Score badge */}
        {game.score != null && (
          <span
            className={`absolute top-0 left-0 ${scoreColor(game.score)} text-black text-xs font-bold px-2 py-0.5 rounded-br-lg`}
          >
            {Math.round(game.score)}
          </span>
        )}

        {/* Wishlist bookmark */}
        <button
          onClick={onToggleWishlist}
          className="absolute top-1 right-1 p-1.5 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
          aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
        >
          {isWishlisted ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-vault-amber">
              <path fillRule="evenodd" d="M6.32 2.577a49.255 49.255 0 0111.36 0c1.497.174 2.57 1.46 2.57 2.93V21a.75.75 0 01-1.085.67L12 18.089l-7.165 3.583A.75.75 0 013.75 21V5.507c0-1.47 1.073-2.756 2.57-2.93z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-white/80">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
            </svg>
          )}
        </button>
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-vault-text text-sm font-bold truncate">
          {game.title}
        </p>
        <p className="text-vault-muted text-xs truncate">
          {[game.developer, game.year].filter(Boolean).join(" · ")}
        </p>
        {game.summary && (
          <p
            className="text-vault-muted text-xs mt-1 overflow-hidden"
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {game.summary}
          </p>
        )}
        {searchUrl && (
          <a
            href={searchUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="mt-2 flex items-center justify-center gap-1.5 w-full py-1.5 bg-vault-bg border border-vault-border rounded-lg text-vault-muted hover:text-vault-text hover:border-vault-amber/50 transition-all text-[10px] font-medium"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            Search ROM
          </a>
        )}
      </div>
    </div>
  );
}

/* ---------- Detail Modal ---------- */

function DetailModal({
  game,
  platformId,
  isWishlisted,
  onToggleWishlist,
  onClose,
  searchUrl,
}: {
  game: MissingGame;
  platformId: string;
  isWishlisted: boolean;
  onToggleWishlist: () => void;
  onClose: () => void;
  searchUrl?: string;
}) {
  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-vault-surface border border-vault-border rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto">
        {/* Close button */}
        <div className="sticky top-0 z-10 flex justify-end p-3">
          <button
            onClick={onClose}
            className="bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition-colors"
            aria-label="Close"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="w-5 h-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Cover + Title Header */}
        <div className="flex gap-4 px-6 -mt-4">
          {game.coverUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={game.coverUrl}
              alt={game.title}
              className="w-28 h-[160px] rounded-lg object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-28 h-[160px] rounded-lg bg-gradient-to-br from-vault-amber/20 to-purple-500/20 flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0 pt-2">
            <h2 className="font-heading text-xl font-bold text-vault-text">
              {game.title}
            </h2>
            <p className="text-vault-muted text-sm mt-1">
              {[game.developer, game.year, platformId]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {game.genres && game.genres.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {game.genres.map((g) => (
                  <span
                    key={g}
                    className="bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-full px-2 py-0.5 text-[10px]"
                  >
                    {g}
                  </span>
                ))}
              </div>
            )}
            {game.score != null && (
              <div className="mt-2 flex items-center gap-2">
                <span
                  className={`${scoreColor(game.score)} text-black text-sm font-bold px-2.5 py-0.5 rounded-md`}
                >
                  {Math.round(game.score)}
                </span>
                <span className={`text-sm font-medium ${scoreTextColor(game.score)}`}>
                  IGDB Score
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Summary */}
        {game.summary && (
          <div className="px-6 mt-4">
            <p className="text-vault-muted text-sm leading-relaxed">
              {game.summary}
            </p>
          </div>
        )}

        {/* Screenshots */}
        {game.screenshots && game.screenshots.length > 0 && (
          <div className="mt-4 px-6">
            <p className="text-vault-muted text-xs font-medium uppercase tracking-wider mb-2">
              Screenshots
            </p>
            <div
              className="flex gap-3 overflow-x-auto pb-2"
              style={{ scrollbarWidth: "none" }}
            >
              {game.screenshots.map((url, i) => (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  key={i}
                  src={url}
                  alt={`${game.title} screenshot ${i + 1}`}
                  className="h-36 rounded-lg object-cover flex-shrink-0"
                />
              ))}
            </div>
          </div>
        )}

        {/* Videos */}
        {game.videoIds && game.videoIds.length > 0 && (
          <div className="mt-4 px-6">
            <p className="text-vault-muted text-xs font-medium uppercase tracking-wider mb-2">
              Videos
            </p>
            <div className="flex flex-col gap-3">
              {game.videoIds.map((vid) => (
                <div
                  key={vid}
                  className="relative w-full rounded-lg overflow-hidden"
                  style={{ paddingBottom: "56.25%" }}
                >
                  <iframe
                    src={`https://www.youtube.com/embed/${vid}`}
                    title={`${game.title} video`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="absolute inset-0 w-full h-full"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="px-6 py-5 flex flex-col gap-2">
          <button
            onClick={onToggleWishlist}
            className={`w-full py-2.5 rounded-xl font-medium text-sm transition-colors ${
              isWishlisted
                ? "bg-vault-amber/20 text-vault-amber border border-vault-amber/40 hover:bg-vault-amber/30"
                : "bg-vault-amber text-black hover:bg-vault-amber/90"
            }`}
          >
            {isWishlisted ? "Remove from Wishlist" : "Add to Wishlist"}
          </button>
          {searchUrl && (
            <a
              href={searchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 rounded-xl font-medium text-sm text-center bg-vault-bg border border-vault-border text-vault-muted hover:text-vault-text hover:border-vault-amber/50 transition-colors flex items-center justify-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              Search ROM
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Main Component ---------- */

export function PlatformStats({ platformId }: PlatformStatsProps) {
  const resolvedLabel = PLATFORM_CONFIG.find((p) => p.id === platformId)?.label || platformId;
  const [stats, setStats] = useState<StatsData | null>(null);
  const [missing, setMissing] = useState<MissingGame[] | null>(null);
  const [missingError, setMissingError] = useState(false);
  const [loading, setLoading] = useState(true);

  // Missing section collapsed by default
  const [missingExpanded, setMissingExpanded] = useState(true);
  const carouselRef = useRef<HTMLDivElement>(null);

  // Detail modal
  const [selectedGame, setSelectedGame] = useState<MissingGame | null>(null);

  // ROM search URL
  const [romSearchUrl, setRomSearchUrl] = useState("");

  // Wishlist state: map of "title::platform" -> wishlist item id
  const [wishlistMap, setWishlistMap] = useState<Map<string, number>>(
    new Map()
  );
  const wishlistLoaded = useRef(false);

  const wishlistKey = useCallback(
    (title: string) => `${title}::${platformId}`,
    [platformId]
  );

  // Fetch stats + missing games
  useEffect(() => {
    const fetchStats = fetch(`/api/platforms/${platformId}/stats`)
      .then((res) => {
        if (!res.ok) throw new Error("Stats endpoint failed");
        return res.json();
      })
      .then((json) => setStats(json))
      .catch((err) => console.error("Failed to load platform stats:", err));

    const fetchMissing = fetch(`/api/platforms/${platformId}/missing`)
      .then((res) => {
        if (!res.ok) throw new Error("Missing endpoint failed");
        return res.json();
      })
      .then((json) => setMissing(json.missing || []))
      .catch(() => setMissingError(true));

    const fetchRomUrl = fetch("/api/settings/rom-search")
      .then((res) => res.json())
      .then((json) => setRomSearchUrl(json.romSearchUrl || ""))
      .catch(() => {});

    Promise.allSettled([fetchStats, fetchMissing, fetchRomUrl]).finally(() =>
      setLoading(false)
    );
  }, [platformId]);

  // Fetch wishlist on mount
  useEffect(() => {
    if (wishlistLoaded.current) return;
    wishlistLoaded.current = true;

    fetch("/api/wishlist")
      .then((res) => {
        if (!res.ok) throw new Error("Wishlist fetch failed");
        return res.json();
      })
      .then((json) => {
        const items = json.items as WishlistItem[];
        const map = new Map<string, number>();
        for (const item of items) {
          map.set(`${item.title}::${item.platform}`, item.id);
        }
        setWishlistMap(map);
      })
      .catch((err) => console.error("Failed to fetch wishlist:", err));
  }, []);

  const isWishlisted = useCallback(
    (title: string) => wishlistMap.has(wishlistKey(title)),
    [wishlistMap, wishlistKey]
  );

  const toggleWishlist = useCallback(
    async (game: MissingGame, e?: React.MouseEvent) => {
      if (e) {
        e.stopPropagation();
        e.preventDefault();
      }

      const key = wishlistKey(game.title);
      const existingId = wishlistMap.get(key);

      if (existingId) {
        // Optimistic remove
        setWishlistMap((prev) => {
          const next = new Map(prev);
          next.delete(key);
          return next;
        });

        try {
          const res = await fetch(`/api/wishlist/${existingId}`, {
            method: "DELETE",
          });
          if (!res.ok) throw new Error("Delete failed");
        } catch (err) {
          console.error("Failed to remove from wishlist:", err);
          // Revert
          setWishlistMap((prev) => {
            const next = new Map(prev);
            next.set(key, existingId);
            return next;
          });
        }
      } else {
        // Optimistic add with temp id
        const tempId = -Date.now();
        setWishlistMap((prev) => {
          const next = new Map(prev);
          next.set(key, tempId);
          return next;
        });

        try {
          const res = await fetch("/api/wishlist", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: game.title,
              platform: platformId,
              platformLabel: resolvedLabel,
              coverUrl: game.coverUrl ?? null,
              igdbScore: game.score ?? null,
              summary: game.summary ?? null,
              genres: game.genres ? JSON.stringify(game.genres) : null,
              screenshots: game.screenshots
                ? JSON.stringify(game.screenshots)
                : null,
              videoIds: game.videoIds
                ? JSON.stringify(game.videoIds)
                : null,
              developer: game.developer ?? null,
              year: game.year ?? null,
            }),
          });
          if (!res.ok) throw new Error("Add failed");
          const created = await res.json();
          setWishlistMap((prev) => {
            const next = new Map(prev);
            next.set(key, created.id);
            return next;
          });
        } catch (err) {
          console.error("Failed to add to wishlist:", err);
          // Revert
          setWishlistMap((prev) => {
            const next = new Map(prev);
            next.delete(key);
            return next;
          });
        }
      }
    },
    [wishlistMap, wishlistKey, platformId]
  );

  if (loading) return <SkeletonCards />;
  if (!stats) return null;

  return (
    <div className="min-w-0 overflow-hidden">
      {/* ---- Stats Row ---- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          value={stats.gameCount.toLocaleString()}
          label="Games"
          color="text-vault-amber"
        />
        <StatCard
          value={stats.avgScore !== null ? String(stats.avgScore) : "\u2014"}
          label="Avg Score"
          color="text-vault-amber"
        />
        <StatCard
          value={`${stats.coverPercent}%`}
          label="Cover %"
          color="text-green-400"
        />
        <StatCard
          value={`${stats.aiPercent}%`}
          label="AI %"
          color="text-purple-400"
        />
      </div>

      {/* ---- Genre Tags ---- */}
      {stats.genreCounts && stats.genreCounts.length > 0 && (
        <div className="mb-6">
          <p className="text-vault-muted text-xs font-medium uppercase tracking-wider mb-3">
            Your Top Genres
          </p>
          <div className="flex flex-wrap gap-2">
            {stats.genreCounts.map((g) => (
              <span
                key={g.genre}
                className="bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-full px-3 py-1 text-xs"
              >
                {g.genre} ({g.count})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ---- Missing Top Rated ---- */}
      {missingError ? (
        <div className="mb-6">
          <p className="text-vault-muted text-sm">
            IGDB-Zugangsdaten in den Admin Settings konfigurieren um
            Empfehlungen zu sehen
          </p>
        </div>
      ) : (
        missing &&
        missing.length > 0 && (
          <div className="mb-6 bg-gradient-to-br from-vault-amber/[0.05] to-transparent border border-vault-amber/20 rounded-xl overflow-hidden min-w-0">
            {/* Collapsible Header Bar */}
            <button
              onClick={() => setMissingExpanded((prev) => !prev)}
              className="w-full flex items-center gap-2 px-4 py-3 hover:bg-vault-amber/[0.03] transition-colors"
            >
              <span className="text-lg">&#127942;</span>
              <h3 className="font-heading text-sm font-bold text-vault-amber">
                Top Rated You&apos;re Missing
              </h3>
              <span className="text-[10px] font-medium uppercase tracking-wider bg-vault-amber/15 text-vault-amber border border-vault-amber/30 rounded px-1.5 py-0.5">
                {missing.length} games
              </span>
              <span className="ml-auto text-vault-muted text-xs font-medium">
                {missingExpanded ? "Hide" : "Show"}
              </span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className={`w-4 h-4 text-vault-muted transition-transform ${
                  missingExpanded ? "rotate-180" : ""
                }`}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                />
              </svg>
            </button>

            {/* Expanded Carousel */}
            {missingExpanded && (
              <div className="px-4 pb-4 min-w-0 max-w-full">
                <p className="text-vault-muted text-xs mb-3">
                  Top-rated {platformId} games not in your collection according
                  to IGDB
                </p>

                {/* Carousel Container */}
                <style>{`
                  .missing-carousel::-webkit-scrollbar { display: none; }
                `}</style>
                <div className="relative overflow-hidden min-w-0 w-full">
                  <div
                    ref={carouselRef}
                    className="missing-carousel flex gap-4 overflow-x-auto pb-2"
                    style={{
                      scrollSnapType: "x mandatory",
                      scrollbarWidth: "none",
                    }}
                  >
                    {missing.map((game) => (
                      <GameCard
                        key={game.title}
                        game={game}
                        isWishlisted={isWishlisted(game.title)}
                        onToggleWishlist={(e) => toggleWishlist(game, e)}
                        onSelect={() => setSelectedGame(game)}
                        romSearchUrl={romSearchUrl}
                        platformId={platformId}
                        platformLabel={resolvedLabel}
                      />
                    ))}
                  </div>
                  {/* Scroll right button */}
                  <button
                    onClick={() => {
                      carouselRef.current?.scrollBy({ left: 420, behavior: "smooth" });
                    }}
                    className="absolute right-0 top-0 bottom-2 w-10 bg-gradient-to-l from-vault-surface/90 to-transparent flex items-center justify-end pr-1 text-vault-muted hover:text-vault-text transition-colors"
                    aria-label="Scroll right"
                  >
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M7 4l6 6-6 6" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      )}

      {/* ---- Detail Modal ---- */}
      {selectedGame && (
        <DetailModal
          game={selectedGame}
          platformId={platformId}
          isWishlisted={isWishlisted(selectedGame.title)}
          onToggleWishlist={() => toggleWishlist(selectedGame)}
          onClose={() => setSelectedGame(null)}
          searchUrl={romSearchUrl ? buildRomSearchUrl(romSearchUrl, selectedGame.title, platformId, resolvedLabel) : undefined}
        />
      )}
    </div>
  );
}
