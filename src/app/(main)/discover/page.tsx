"use client";

import { useState, useEffect, Suspense } from "react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { DiscoverWizard } from "@/components/discover-wizard";
import { DiscoverResults } from "@/components/discover-results";
import { type RecommendationGame } from "@/components/recommendation-card";
import { useSearchParams } from "next/navigation";

interface PlatformOption {
  id: string;
  label: string;
  icon: string;
  gameCount: number;
}

function DiscoverPageContent() {
  const [phase, setPhase] = useState<"wizard" | "loading" | "results">("wizard");
  const [libraryGames, setLibraryGames] = useState<RecommendationGame[]>([]);
  const [wishlistGames, setWishlistGames] = useState<RecommendationGame[]>([]);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [platforms, setPlatforms] = useState<PlatformOption[]>([]);

  const searchParams = useSearchParams();

  // Fetch platforms with gameCount on mount
  useEffect(() => {
    fetch("/api/platforms")
      .then((r) => r.json())
      .then((data) => {
        setPlatforms(
          data.map((p: Record<string, unknown>) => ({
            id: p.id,
            label: p.label,
            icon: p.icon || "",
            gameCount: p.gameCount,
          }))
        );
      })
      .catch((err) => console.error("Failed to fetch platforms:", err));
  }, []);

  // Surprise Me support: auto-trigger on mount if ?surprise=true&platforms=...
  useEffect(() => {
    const platformsParam = searchParams.get("platforms");
    const surprise = searchParams.get("surprise");
    if (surprise === "true" && platformsParam) {
      const platformIds = platformsParam.split(",");
      fetch(`/api/discover/genres?platforms=${platformsParam}`)
        .then((r) => r.json())
        .then((data) => {
          handleGenerate(platformIds, data.genres || [], data.themes || []);
        })
        .catch((err) => setError(err.message));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleGenerate(
    selectedPlatforms: string[],
    genres: string[],
    themes: string[]
  ) {
    setPhase("loading");
    setLibraryGames([]);
    setWishlistGames([]);
    setError(null);
    setLoadingMessage("Analysiere deine Library...");

    try {
      const res = await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platforms: selectedPlatforms,
          genres,
          themes,
          tab: "wishlist",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Generation failed");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "generating") {
              setLoadingMessage(data.message);
            } else if (
              data.type === "recommendations" &&
              data.tab === "library"
            ) {
              setLibraryGames(data.games);
              setPhase("results");
            } else if (
              data.type === "recommendations" &&
              data.tab === "wishlist"
            ) {
              setWishlistGames(data.games);
            } else if (data.type === "done") {
              setLoadingMessage("");
            } else if (data.type === "error") {
              setError(data.error);
            }
          } catch {
            // skip malformed SSE chunks
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setPhase("wizard");
    }
  }

  return (
    <>
      {error && (
        <div className="card mb-6 border-red-500/50">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {phase === "wizard" && (
        <DiscoverWizard
          platforms={platforms.filter((p) => p.gameCount > 0)}
          onGenerate={(p, g, t) => { setError(null); handleGenerate(p, g, t); }}
        />
      )}

      {(phase === "loading" || phase === "results") && (
        <>
          <DiscoverResults
            libraryGames={libraryGames}
            wishlistGames={wishlistGames}
            isLoading={phase === "loading" || loadingMessage !== ""}
            loadingMessage={loadingMessage}
          />
          {phase === "results" && (
            <button
              onClick={() => {
                setPhase("wizard");
                setLibraryGames([]);
                setWishlistGames([]);
              }}
              className="mt-6 px-4 py-2 bg-vault-surface border border-vault-border rounded-lg text-sm text-vault-text hover:border-vault-amber transition-colors"
            >
              Neue Empfehlungen generieren
            </button>
          )}
        </>
      )}
    </>
  );
}

export default function DiscoverPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <Breadcrumbs
        items={[{ label: "Home", href: "/" }, { label: "Discover" }]}
      />

      <h1 className="font-heading text-2xl font-bold mb-8">Game Discovery</h1>

      <Suspense>
        <DiscoverPageContent />
      </Suspense>
    </div>
  );
}
