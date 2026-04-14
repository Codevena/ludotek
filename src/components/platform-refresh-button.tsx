"use client";

import { useEnrichment } from "@/context/enrichment-context";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/confirm-dialog";

export function PlatformRefreshButton({ platformId }: { platformId: string }) {
  const { startEnrichment, isRunning } = useEnrichment();
  const [enriching, setEnriching] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const router = useRouter();

  async function handleRefresh() {
    setShowConfirm(false);
    try {
      await startEnrichment("/api/enrich", setEnriching, {
        platforms: [platformId],
        force: true,
      });
      router.refresh();
    } catch (err) {
      console.error("Platform refresh error:", err);
      setEnriching(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        disabled={isRunning || enriching}
        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-orange-500/20 text-orange-400 border border-orange-500/30 hover:bg-orange-500/30 transition-colors disabled:opacity-50"
      >
        {enriching ? "Refreshing..." : "Refresh All Metadata"}
      </button>
      <ConfirmDialog
        open={showConfirm}
        title="Refresh All Metadata"
        message="Refresh metadata for all games on this platform? This will re-fetch all data from IGDB."
        confirmLabel="Refresh"
        confirmVariant="warning"
        onConfirm={handleRefresh}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  );
}
