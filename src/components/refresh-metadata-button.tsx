"use client";

import { useState } from "react";

export function RefreshMetadataButton({ gameId }: { gameId: number }) {
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function handleRefresh() {
    setRefreshing(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/games/${gameId}/enrich?force=true`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generateAi: false }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus("Metadata refreshed! Reloading...");
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setStatus(data.error || "Failed to refresh");
      }
    } catch (err) {
      console.error("Refresh metadata error:", err);
      setStatus(String(err));
    }
    setRefreshing(false);
  }

  return (
    <div className="inline-flex items-center gap-2">
      <button
        onClick={handleRefresh}
        disabled={refreshing}
        className="px-3 py-1 rounded-lg text-xs font-medium bg-vault-surface border border-vault-border text-vault-muted hover:text-vault-text hover:border-vault-amber transition-colors disabled:opacity-50"
      >
        {refreshing ? "Refreshing..." : "Refresh Metadata"}
      </button>
      {status && (
        <span className={`text-xs ${status.includes("Reloading") ? "text-green-400" : "text-red-400"}`}>
          {status}
        </span>
      )}
    </div>
  );
}
