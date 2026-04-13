"use client";

import { useEffect, useState } from "react";

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

/* ---------- Main Component ---------- */

export function PlatformStats({ platformId }: PlatformStatsProps) {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [missing, setMissing] = useState<MissingGame[] | null>(null);
  const [missingError, setMissingError] = useState(false);
  const [loading, setLoading] = useState(true);

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

    Promise.allSettled([fetchStats, fetchMissing]).finally(() =>
      setLoading(false)
    );
  }, [platformId]);

  if (loading) return <SkeletonCards />;
  if (!stats) return null;

  return (
    <div>
      {/* ---- Stats Row ---- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          value={stats.gameCount.toLocaleString()}
          label="Games"
          color="text-vault-amber"
        />
        <StatCard
          value={stats.avgScore !== null ? String(stats.avgScore) : "—"}
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
          <div className="mb-6 bg-gradient-to-br from-vault-amber/[0.05] to-transparent border border-vault-amber/20 rounded-xl p-4">
            {/* Header */}
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">🏆</span>
              <h3 className="font-heading text-sm font-bold text-vault-amber">
                Top Rated You&apos;re Missing
              </h3>
              <span className="text-[10px] font-medium uppercase tracking-wider bg-vault-amber/15 text-vault-amber border border-vault-amber/30 rounded px-1.5 py-0.5">
                IGDB DATA
              </span>
            </div>
            <p className="text-vault-muted text-xs mb-4">
              Top-rated {platformId} games not in your collection according to IGDB
            </p>

            {/* Game Rows */}
            <div className="flex flex-col gap-2">
              {missing.map((game, i) => (
                <div
                  key={game.title}
                  className="bg-vault-bg rounded-lg p-3 border border-vault-border flex items-center gap-3"
                >
                  {/* Rank */}
                  <span className="text-vault-muted text-xs font-medium w-6 text-right shrink-0">
                    #{i + 1}
                  </span>

                  {/* Cover */}
                  {game.coverUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={game.coverUrl}
                      alt={game.title}
                      className="w-8 h-[42px] rounded object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-[42px] rounded bg-vault-surface shrink-0" />
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-vault-text text-sm font-bold truncate">
                      {game.title}
                    </p>
                    <p className="text-vault-muted text-xs truncate">
                      {[game.developer, game.year, game.genres?.[0]]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>

                  {/* Score */}
                  {game.score != null && (
                    <span
                      className={`text-sm font-bold shrink-0 ${
                        game.score >= 75
                          ? "text-green-400"
                          : game.score >= 50
                            ? "text-vault-amber"
                            : "text-vault-muted"
                      }`}
                    >
                      {Math.round(game.score)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      )}
    </div>
  );
}
