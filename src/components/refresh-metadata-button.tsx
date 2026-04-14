"use client";

import { useEffect, useState } from "react";

interface IgdbResult {
  igdbId: number;
  name: string;
  rating: number | null;
  coverUrl: string | null;
  releaseDate: string | null;
  summary: string | null;
}

export function RefreshMetadataButton({ gameId, gameTitle }: { gameId: number; gameTitle: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(gameTitle);
  const [results, setResults] = useState<IgdbResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open]);

  async function search() {
    setSearching(true);
    setResults([]);
    setStatus(null);
    try {
      const res = await fetch(`/api/games/${gameId}/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.results?.length > 0) setResults(data.results);
      else setStatus("No results found");
    } catch (err) {
      setStatus(String(err));
    }
    setSearching(false);
  }

  async function pickResult(igdbId: number) {
    setEnriching(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/games/${gameId}/enrich`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ igdbId, generateAi: false }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus("Metadata refreshed! Reloading...");
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setStatus(data.error || "Failed to enrich");
      }
    } catch (err) {
      setStatus(String(err));
    }
    setEnriching(false);
  }

  return (
    <>
      <button
        onClick={() => { setOpen(true); setQuery(gameTitle); setResults([]); setStatus(null); }}
        className="px-3 py-1 rounded-lg text-xs font-medium bg-vault-surface border border-vault-border text-vault-muted hover:text-vault-text hover:border-vault-amber transition-colors"
      >
        Refresh Metadata
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-vault-surface border border-vault-border rounded-xl max-w-lg w-full mx-4 overflow-hidden shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h3 className="text-base font-semibold text-vault-text">Refresh Metadata</h3>
              <button onClick={() => setOpen(false)} className="text-vault-muted hover:text-vault-text text-sm">
                Close
              </button>
            </div>

            <div className="px-5 pb-4 space-y-3">
              {/* Search */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && search()}
                  placeholder="Search IGDB..."
                  autoFocus
                  className="flex-1 bg-vault-bg border border-vault-border rounded-lg px-4 py-2 text-sm text-vault-text focus:outline-none focus:border-vault-amber"
                />
                <button
                  onClick={search}
                  disabled={searching}
                  className="px-4 py-2 rounded-lg text-sm bg-vault-amber text-black hover:bg-vault-amber-hover disabled:opacity-50"
                >
                  {searching ? "Searching..." : "Search"}
                </button>
              </div>

              {/* Results */}
              {results.length > 0 && (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {results.map((r) => (
                    <button
                      key={r.igdbId}
                      onClick={() => pickResult(r.igdbId)}
                      disabled={enriching}
                      className="w-full flex gap-3 p-3 bg-vault-bg rounded-lg border border-vault-border hover:border-vault-amber transition-colors text-left disabled:opacity-50"
                    >
                      {r.coverUrl ? (
                        <img src={r.coverUrl} alt={r.name} className="w-12 h-16 object-cover rounded" />
                      ) : (
                        <div className="w-12 h-16 bg-vault-surface rounded flex items-center justify-center text-vault-muted text-xs">
                          ?
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{r.name}</p>
                        <p className="text-xs text-vault-muted">
                          {r.releaseDate ? new Date(r.releaseDate).getFullYear() : "Unknown year"}
                          {r.rating ? ` · Score: ${Math.round(r.rating)}` : ""}
                        </p>
                        {r.summary && (
                          <p className="text-xs text-vault-muted mt-1 line-clamp-2">{r.summary}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Status */}
              {status && (
                <p className={`text-sm ${status.includes("Reloading") ? "text-green-400" : "text-red-400"}`}>
                  {status}
                </p>
              )}

              {enriching && (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-vault-amber animate-pulse" />
                  <span className="text-sm text-vault-muted">Fetching metadata...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function RefreshAiFactsButton({ gameId }: { gameId: number }) {
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function handleRefresh() {
    setRefreshing(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/games/${gameId}/enrich`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generateAi: true }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus("AI Facts refreshed! Reloading...");
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setStatus(data.error || "Failed to refresh");
      }
    } catch (err) {
      console.error("Refresh AI facts error:", err);
      setStatus(String(err));
    }
    setRefreshing(false);
  }

  return (
    <div className="inline-flex items-center gap-2">
      <button
        onClick={handleRefresh}
        disabled={refreshing}
        className="px-3 py-1 rounded-lg text-xs font-medium bg-purple-600/20 border border-purple-500/30 text-purple-400 hover:bg-purple-600/30 transition-colors disabled:opacity-50"
      >
        {refreshing ? "Generating..." : "Refresh AI Facts"}
      </button>
      {status && (
        <span className={`text-xs ${status.includes("Reloading") ? "text-green-400" : "text-red-400"}`}>
          {status}
        </span>
      )}
    </div>
  );
}
