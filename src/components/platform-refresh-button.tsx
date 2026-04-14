"use client";

import { useEnrichment } from "@/context/enrichment-context";
import { useState } from "react";

export function PlatformRefreshButton({ platformId }: { platformId: string }) {
  const { startEnrichment, isRunning } = useEnrichment();
  const [enriching, setEnriching] = useState(false);

  async function handleRefresh() {
    if (!confirm("Refresh metadata for all games on this platform? This will re-fetch from IGDB.")) return;
    try {
      await startEnrichment("/api/enrich", setEnriching, {
        platforms: [platformId],
        force: true,
      });
    } catch (err) {
      console.error("Platform refresh error:", err);
      setEnriching(false);
    }
  }

  return (
    <button
      onClick={handleRefresh}
      disabled={isRunning || enriching}
      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-orange-500/20 text-orange-400 border border-orange-500/30 hover:bg-orange-500/30 transition-colors disabled:opacity-50"
    >
      {enriching ? "Refreshing..." : "Refresh All Metadata"}
    </button>
  );
}
