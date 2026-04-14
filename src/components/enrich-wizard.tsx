"use client";

import { useState } from "react";

interface IgdbResult {
  igdbId: number;
  name: string;
  rating: number | null;
  coverUrl: string | null;
  releaseDate: string | null;
  summary: string | null;
}

export function EnrichWizard({ gameId, gameTitle }: { gameId: number; gameTitle: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(gameTitle);
  const [results, setResults] = useState<IgdbResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [generateAi, setGenerateAi] = useState(true);
  const [status, setStatus] = useState<string | null>(null);

  async function search() {
    setSearching(true);
    setResults([]);
    setStatus(null);
    try {
      const res = await fetch(`/api/games/${gameId}/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.results) setResults(data.results);
      else setStatus(data.error || "No results");
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
        body: JSON.stringify({ igdbId, generateAi }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus("Enrichment complete! Reloading...");
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setStatus(data.error || "Failed");
      }
    } catch (err) {
      setStatus(String(err));
    }
    setEnriching(false);
  }

  async function regenerateAi() {
    setEnriching(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/games/${gameId}/enrich`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generateAi: true }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus("AI content regenerated! Reloading...");
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setStatus(data.error || "Failed");
      }
    } catch (err) {
      setStatus(String(err));
    }
    setEnriching(false);
  }

  if (!open) {
    return (
      <div className="mt-8 flex gap-3">
        <button
          onClick={() => setOpen(true)}
          className="px-4 py-2 rounded-lg text-sm bg-vault-surface border border-vault-border text-vault-muted hover:text-vault-text hover:border-vault-amber transition-colors"
        >
          Get Metadata
        </button>
        <button
          onClick={regenerateAi}
          disabled={enriching}
          className="px-4 py-2 rounded-lg text-sm bg-purple-600/20 border border-purple-500/30 text-purple-400 hover:bg-purple-600/30 transition-colors disabled:opacity-50"
        >
          {enriching ? "Generating..." : "Regenerate AI Stories"}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-8 card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xl font-bold">Get Metadata</h2>
        <button onClick={() => setOpen(false)} className="text-vault-muted hover:text-vault-text text-sm">
          Close
        </button>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="Search IGDB..."
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

      {/* Generate AI toggle */}
      <label className="flex items-center gap-2 text-sm text-vault-muted cursor-pointer">
        <input
          type="checkbox"
          checked={generateAi}
          onChange={(e) => setGenerateAi(e.target.checked)}
          className="rounded"
        />
        Also generate AI Fun Facts &amp; Story
      </label>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-2 max-h-96 overflow-y-auto">
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
        <p className={`text-sm ${status.includes("complete") || status.includes("regenerated") ? "text-green-400" : "text-red-400"}`}>
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
  );
}
