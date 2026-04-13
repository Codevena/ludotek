"use client";

import Link from "next/link";

export interface RecommendationGame {
  title: string;
  platform: string;
  platformLabel: string;
  reason: string;
  vibeTag: string;
  coverUrl?: string | null;
  igdbScore?: number | null;
  metacriticScore?: number | null;
  genres?: string[];
  artworkUrl?: string | null;
  videoId?: string | null;
  summary?: string | null;
  dbId?: number | null;
}

interface RecommendationCardProps {
  game: RecommendationGame;
  featured?: boolean;
}

function scoreColor(score: number): string {
  if (score >= 75) return "text-green-400";
  if (score >= 50) return "text-yellow-400";
  return "text-red-400";
}

function ScoreBadge({ game }: { game: RecommendationGame }) {
  const score = game.igdbScore ?? game.metacriticScore ?? null;
  if (score === null) return null;
  const rounded = Math.round(score);
  return (
    <span className={`text-2xl font-bold tabular-nums ${scoreColor(rounded)}`}>
      {rounded}
    </span>
  );
}

function CompactScoreBadge({ game }: { game: RecommendationGame }) {
  const score = game.igdbScore ?? game.metacriticScore ?? null;
  if (score === null) return null;
  const rounded = Math.round(score);
  return (
    <span className={`text-lg font-bold tabular-nums ${scoreColor(rounded)}`}>
      {rounded}
    </span>
  );
}

function VibeTag({ label }: { label: string }) {
  return (
    <span className="bg-vault-amber/20 text-vault-amber text-xs px-2 py-0.5 rounded-full font-medium">
      {label}
    </span>
  );
}

function FeaturedCard({ game }: { game: RecommendationGame }) {
  return (
    <div className="card overflow-hidden p-0">
      {/* Hero artwork area */}
      <div className="relative h-[160px] overflow-hidden">
        {game.artworkUrl ? (
          <img
            src={game.artworkUrl}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-vault-surface to-vault-bg" />
        )}
        {/* Gradient overlay fading to vault-bg */}
        <div className="absolute inset-0 bg-gradient-to-t from-vault-surface via-vault-surface/60 to-transparent" />
      </div>

      {/* Content area overlapping the hero */}
      <div className="relative px-4 pb-4 -mt-10">
        <div className="flex items-end gap-3">
          {/* Cover image */}
          <div className="w-16 h-[85px] flex-shrink-0 rounded-lg overflow-hidden border-2 border-vault-border bg-vault-bg">
            {game.coverUrl ? (
              <img
                src={game.coverUrl}
                alt={game.title}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-vault-muted text-[10px]">
                No Cover
              </div>
            )}
          </div>

          {/* Title + meta */}
          <div className="flex-1 min-w-0">
            <h3 className="text-xl font-bold text-white drop-shadow line-clamp-1">
              {game.title}
            </h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs text-vault-muted">{game.platformLabel}</span>
              <span className="text-vault-border">·</span>
              <VibeTag label={game.vibeTag} />
            </div>
          </div>

          {/* Score */}
          <div className="flex-shrink-0">
            <ScoreBadge game={game} />
          </div>
        </div>

        {/* AI reason */}
        <div className="mt-3 pt-3 border-t border-vault-border">
          <p className="text-vault-amber text-xs font-semibold mb-1">
            Warum du das feiern wirst:
          </p>
          <p className="text-vault-muted text-sm leading-relaxed">
            {game.reason}
          </p>
        </div>
      </div>
    </div>
  );
}

function CompactCard({ game }: { game: RecommendationGame }) {
  return (
    <div className="card">
      <div className="flex gap-3">
        {/* Cover */}
        <div className="w-12 h-16 flex-shrink-0 rounded overflow-hidden bg-vault-bg">
          {game.coverUrl ? (
            <img
              src={game.coverUrl}
              alt={game.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-vault-muted text-[10px]">
              No Cover
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-semibold text-sm text-white line-clamp-1">
                {game.title}
              </h3>
              <p className="text-xs text-vault-muted mt-0.5">
                {game.platformLabel}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <VibeTag label={game.vibeTag} />
              <CompactScoreBadge game={game} />
            </div>
          </div>

          {/* Reason */}
          <p className="text-xs text-vault-muted mt-1.5 line-clamp-2 leading-relaxed">
            {game.reason}
          </p>
        </div>
      </div>
    </div>
  );
}

export function RecommendationCard({ game, featured = false }: RecommendationCardProps) {
  const inner = featured ? <FeaturedCard game={game} /> : <CompactCard game={game} />;

  if (game.dbId) {
    return (
      <Link href={`/game/${game.dbId}`} className="block group">
        {inner}
      </Link>
    );
  }

  return inner;
}
