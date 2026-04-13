"use client";

import { useState, useEffect } from "react";
import {
  RecommendationCard,
  type RecommendationGame,
} from "./recommendation-card";

interface DiscoverResultsProps {
  libraryGames: RecommendationGame[];
  wishlistGames: RecommendationGame[];
  isLoading: boolean;
  loadingMessage: string;
}

export function DiscoverResults({
  libraryGames,
  wishlistGames,
  isLoading,
  loadingMessage,
}: DiscoverResultsProps) {
  const [activeTab, setActiveTab] = useState<"library" | "wishlist">("library");

  // Auto-switch to wishlist when library is empty but wishlist has results
  useEffect(() => {
    if (libraryGames.length === 0 && wishlistGames.length > 0) {
      setActiveTab("wishlist");
    }
  }, [libraryGames.length, wishlistGames.length]);

  const activeGames =
    activeTab === "library" ? libraryGames : wishlistGames;

  return (
    <div>
      {/* Tab Bar */}
      <div className="flex gap-6 border-b border-vault-border mb-6">
        <button
          type="button"
          onClick={() => setActiveTab("library")}
          className={`pb-3 text-sm font-medium cursor-pointer transition-colors ${
            activeTab === "library"
              ? "text-vault-amber border-b-2 border-vault-amber"
              : "text-vault-muted hover:text-vault-text"
          }`}
        >
          In deiner Library ({libraryGames.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("wishlist")}
          className={`pb-3 text-sm font-medium cursor-pointer transition-colors ${
            activeTab === "wishlist"
              ? "text-vault-amber border-b-2 border-vault-amber"
              : "text-vault-muted hover:text-vault-text"
          }`}
        >
          Fehlt dir noch ({wishlistGames.length})
        </button>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center gap-2 mb-6">
          <span className="inline-block w-2 h-2 rounded-full bg-vault-amber animate-pulse" />
          <span className="text-sm text-vault-muted">{loadingMessage}</span>
        </div>
      )}

      {/* Tab Content */}
      {activeGames.length > 0 ? (
        <div>
          {/* Section Header */}
          <div className="mb-4">
            <p className="text-xs text-vault-amber uppercase tracking-widest">
              {activeTab === "library"
                ? "AI Empfehlungen"
                : "Fehlt dir noch"}
            </p>
            <h2 className="text-xl font-bold font-heading">
              {activeTab === "library"
                ? `${activeGames.length} Games fuer dich`
                : `${activeGames.length} Games die du lieben wuerdest`}
            </h2>
          </div>

          {/* Cards */}
          <div className="space-y-4">
            {activeGames.map((game, index) => (
              <RecommendationCard
                key={`${game.title}-${game.platform}`}
                game={game}
                featured={index === 0}
              />
            ))}
          </div>
        </div>
      ) : !isLoading ? (
        <p className="text-center text-vault-muted py-8">
          {activeTab === "library"
            ? "Keine Empfehlungen gefunden. Versuch andere Genres!"
            : "Keine Vorschlaege gefunden."}
        </p>
      ) : null}
    </div>
  );
}
