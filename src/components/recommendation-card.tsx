"use client";

import { useState } from "react";
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

export function RecommendationCard({ game }: RecommendationCardProps) {
  const [expanded, setExpanded] = useState(false);
  const score = game.igdbScore ?? game.metacriticScore ?? null;
  const safeVideoId = game.videoId && /^[a-zA-Z0-9_-]{6,15}$/.test(game.videoId) ? game.videoId : null;

  return (
    <div className="card overflow-hidden">
      {/* Main row — always visible */}
      <div
        className="flex gap-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Cover */}
        <div className="w-14 h-[75px] flex-shrink-0 rounded-lg overflow-hidden bg-vault-bg">
          {game.coverUrl ? (
            <img src={game.coverUrl} alt={game.title} className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-vault-muted text-[9px]">No Cover</div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-semibold text-sm text-white line-clamp-1">{game.title}</h3>
              <p className="text-xs text-vault-muted mt-0.5">{game.platformLabel}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="bg-vault-amber/20 text-vault-amber text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
                {game.vibeTag}
              </span>
              {score !== null && (
                <span className={`text-lg font-bold tabular-nums ${scoreColor(Math.round(score))}`}>
                  {Math.round(score)}
                </span>
              )}
            </div>
          </div>
          <p className="text-xs text-vault-muted mt-1.5 leading-relaxed line-clamp-2">{game.reason}</p>
        </div>

        {/* Expand indicator */}
        <div className="flex items-center flex-shrink-0">
          <span className={`text-vault-muted text-xs transition-transform ${expanded ? "rotate-180" : ""}`}>
            &#9660;
          </span>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-vault-border space-y-3">
          {/* Artwork */}
          {game.artworkUrl && (
            <div className="aspect-video rounded-lg overflow-hidden bg-vault-bg">
              <img src={game.artworkUrl} alt={`${game.title} artwork`} className="w-full h-full object-cover" loading="lazy" />
            </div>
          )}

          {/* Video */}
          {safeVideoId && (
            <div className="aspect-video rounded-lg overflow-hidden bg-vault-bg">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${safeVideoId}`}
                title={`${game.title} Trailer`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              />
            </div>
          )}

          {/* Summary */}
          {game.summary && (
            <p className="text-sm text-vault-muted leading-relaxed">{game.summary}</p>
          )}

          {/* Genres */}
          {game.genres && game.genres.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {game.genres.map((g) => (
                <span key={g} className="text-xs bg-vault-bg px-2 py-0.5 rounded-full text-vault-muted">{g}</span>
              ))}
            </div>
          )}

          {/* Full reason */}
          <div>
            <p className="text-vault-amber text-xs font-semibold mb-1">Why you&apos;ll love this:</p>
            <p className="text-sm text-vault-muted leading-relaxed">{game.reason}</p>
          </div>

          {/* Link to game detail */}
          {game.dbId && (
            <Link
              href={`/game/${game.dbId}`}
              className="inline-block text-xs text-vault-amber hover:text-vault-amber-hover transition-colors"
            >
              View game details &rarr;
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
