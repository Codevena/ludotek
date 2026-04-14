"use client";

import { useState, useEffect, useCallback } from "react";

interface ImageStats {
  covers: { count: number; size: number };
  screenshots: { count: number; size: number };
  artwork: { count: number; size: number };
  total: { count: number; size: number };
}

interface ApiCacheStats {
  count: number;
  oldestEntry: string | null;
  newestEntry: string | null;
}

interface CacheStats {
  images: ImageStats;
  apiCache: ApiCacheStats;
}

function formatMB(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function CacheManager() {
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [caching, setCaching] = useState(false);
  const [cacheDone, setCacheDone] = useState(0);
  const [cacheTotal, setCacheTotal] = useState(0);
  const [clearingImages, setClearingImages] = useState(false);
  const [clearingApi, setClearingApi] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch("/api/cache/stats");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setStats(data);
      setError(null);
    } catch (err) {
      console.error("Failed to load cache stats:", err);
      setError("Failed to load cache stats");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  async function handleCacheAll() {
    setCaching(true);
    setCacheDone(0);
    setCacheTotal(0);
    setError(null);

    try {
      const res = await fetch("/api/cache/batch", { method: "POST" });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        setError(data.error || "Cache batch failed");
        setCaching(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setError("No response body");
        setCaching(false);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          buffer = buffer.replace(/\r\n/g, "\n");
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === "progress") {
                setCacheDone(data.done ?? data.current ?? 0);
                setCacheTotal(data.total ?? 0);
              } else if (data.type === "done") {
                // finished
              }
            } catch {
              // skip malformed
            }
          }
        }
      } finally {
        await reader.cancel();
      }
    } catch (err) {
      console.error("Cache batch error:", err);
      setError(String(err));
    }

    setCaching(false);
    loadStats();
  }

  async function handleClearImages() {
    if (!confirm("Clear all cached images? They will be re-downloaded on next access.")) return;
    setClearingImages(true);
    setError(null);
    try {
      const res = await fetch("/api/cache", { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await loadStats();
    } catch (err) {
      console.error("Clear image cache error:", err);
      setError("Failed to clear image cache");
    }
    setClearingImages(false);
  }

  async function handleClearApi() {
    if (!confirm("Clear all API response cache? Future requests will re-fetch from APIs.")) return;
    setClearingApi(true);
    setError(null);
    try {
      const res = await fetch("/api/cache/api-responses", { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await loadStats();
    } catch (err) {
      console.error("Clear API cache error:", err);
      setError("Failed to clear API cache");
    }
    setClearingApi(false);
  }

  const cachePct = cacheTotal > 0 ? Math.round((cacheDone / cacheTotal) * 100) : 0;

  if (loading) {
    return (
      <div className="card space-y-4">
        <h2 className="font-heading text-lg font-bold">Cache Management</h2>
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 rounded-full bg-vault-amber animate-pulse" />
          <span className="text-sm text-vault-muted">Loading cache stats...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="card space-y-6">
      <h2 className="font-heading text-lg font-bold">Cache Management</h2>

      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}

      {/* Image Cache Stats */}
      <div className="space-y-3">
        <h3 className="text-vault-amber text-sm font-semibold uppercase tracking-wide">Image Cache</h3>
        {stats?.images ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-vault-bg rounded-lg px-3 py-2 border border-vault-border">
              <div className="text-xs text-vault-muted">Covers</div>
              <div className="text-sm font-medium text-vault-text">
                {stats.images.covers.count}
                <span className="text-vault-muted ml-1 text-xs">({formatMB(stats.images.covers.size)} MB)</span>
              </div>
            </div>
            <div className="bg-vault-bg rounded-lg px-3 py-2 border border-vault-border">
              <div className="text-xs text-vault-muted">Screenshots</div>
              <div className="text-sm font-medium text-vault-text">
                {stats.images.screenshots.count}
                <span className="text-vault-muted ml-1 text-xs">({formatMB(stats.images.screenshots.size)} MB)</span>
              </div>
            </div>
            <div className="bg-vault-bg rounded-lg px-3 py-2 border border-vault-border">
              <div className="text-xs text-vault-muted">Artwork</div>
              <div className="text-sm font-medium text-vault-text">
                {stats.images.artwork.count}
                <span className="text-vault-muted ml-1 text-xs">({formatMB(stats.images.artwork.size)} MB)</span>
              </div>
            </div>
            <div className="bg-vault-bg rounded-lg px-3 py-2 border border-vault-border">
              <div className="text-xs text-vault-muted">Total</div>
              <div className="text-sm font-bold text-vault-amber">
                {stats.images.total.count}
                <span className="ml-1 text-xs font-normal">({formatMB(stats.images.total.size)} MB)</span>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-vault-muted">No stats available</p>
        )}

        {/* Cache All + Progress */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleCacheAll}
            disabled={caching || clearingImages}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-vault-amber text-black hover:bg-vault-amber-hover transition-all disabled:opacity-50"
          >
            {caching ? "Caching..." : "Cache All Images"}
          </button>
          <button
            onClick={handleClearImages}
            disabled={caching || clearingImages}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-600/30 transition-all disabled:opacity-50"
          >
            {clearingImages ? "Clearing..." : "Clear Image Cache"}
          </button>
        </div>

        {/* Progress bar while caching */}
        {caching && (
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-vault-bg rounded-full h-2 overflow-hidden">
                <div
                  className="h-full rounded-full bg-vault-amber transition-all duration-300"
                  style={{ width: `${cachePct}%` }}
                />
              </div>
              <span className="text-xs text-vault-muted tabular-nums">
                {cacheDone}/{cacheTotal}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* API Cache Stats */}
      <div className="space-y-3">
        <h3 className="text-vault-amber text-sm font-semibold uppercase tracking-wide">API Response Cache</h3>
        {stats?.apiCache ? (
          <div className="flex items-center gap-4 text-sm">
            <span className="text-vault-text font-medium">{stats.apiCache.count} cached responses</span>
            {stats.apiCache.count > 0 && (
              <span className="text-vault-muted text-xs">
                {formatDate(stats.apiCache.oldestEntry)} — {formatDate(stats.apiCache.newestEntry)}
              </span>
            )}
          </div>
        ) : (
          <p className="text-sm text-vault-muted">No stats available</p>
        )}
        <button
          onClick={handleClearApi}
          disabled={clearingApi}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-600/30 transition-all disabled:opacity-50"
        >
          {clearingApi ? "Clearing..." : "Clear API Cache"}
        </button>
      </div>
    </div>
  );
}
