"use client";

import { useScan } from "@/context/scan-context";

export function ScanBar() {
  const {
    scanning,
    progress,
    status,
    gamesFound,
    newGames,
    updatedGames,
    justCompleted,
    dismissed,
    dismiss,
  } = useScan();

  if (dismissed || (!scanning && !justCompleted)) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-vault-surface border-t border-vault-border px-4 py-3 shadow-lg">
      <div className="max-w-5xl mx-auto flex items-center gap-4">
        {/* Pulsing dot */}
        <div
          className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
            scanning ? "bg-blue-400 animate-pulse" : "bg-green-400"
          }`}
        />

        {/* Label + status */}
        <div className="flex-shrink-0 text-sm font-medium text-vault-text">
          {scanning ? "Scanning" : "Done"}
          {status && (
            <span className="text-vault-muted ml-1.5 font-normal">{status}</span>
          )}
        </div>

        {/* Progress bar */}
        <div className="flex-1 bg-vault-bg rounded-full h-2 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              scanning ? "bg-blue-400" : "bg-green-400"
            }`}
            style={{ width: `${justCompleted && !scanning ? 100 : progress}%` }}
          />
        </div>

        {/* Percentage */}
        <span className="flex-shrink-0 text-xs font-medium text-vault-text tabular-nums w-8 text-right">
          {justCompleted && !scanning ? 100 : progress}%
        </span>

        {/* Counts */}
        <div className="flex-shrink-0 flex items-center gap-3 text-xs text-vault-muted">
          {gamesFound > 0 && <span>{gamesFound} games</span>}
          {newGames > 0 && <span className="text-green-400">{newGames} new</span>}
          {updatedGames > 0 && <span className="text-blue-400">{updatedGames} updated</span>}
        </div>

        {/* Dismiss */}
        <button
          onClick={dismiss}
          className="flex-shrink-0 text-vault-muted hover:text-vault-text transition-colors text-sm"
        >
          <svg
            aria-hidden="true"
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M1 1l12 12M13 1L1 13" />
          </svg>
          <span className="sr-only">Dismiss</span>
        </button>
      </div>
    </div>
  );
}
