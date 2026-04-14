"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface TransferProgress {
  transferring: boolean;
  currentFile: string;
  progress: number;
  completedFiles: number;
  totalFiles: number;
  mode: "copy" | "move";
  error?: string;
}

declare global {
  interface Window {
    __transferBarPoll?: () => void;
  }
}

export function TransferBar() {
  const [data, setData] = useState<TransferProgress | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const errorCountRef = useRef(0);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/devices/transfer/status");
      if (!res.ok) {
        errorCountRef.current += 1;
        if (errorCountRef.current > 30) {
          stopPolling();
        }
        return;
      }
      errorCountRef.current = 0;
      const json: TransferProgress = await res.json();
      setData(json);

      if (!json.transferring) {
        stopPolling();
      }
    } catch {
      errorCountRef.current += 1;
      if (errorCountRef.current > 30) {
        stopPolling();
      }
    }
  }, [stopPolling]);

  const startPolling = useCallback(() => {
    if (intervalRef.current) return;
    // Fire immediately, then every 1 s
    poll();
    intervalRef.current = setInterval(poll, 1000);
  }, [poll]);

  // Expose startPolling on window so the Files page can trigger it
  useEffect(() => {
    window.__transferBarPoll = startPolling;
    return () => {
      delete window.__transferBarPoll;
    };
  }, [startPolling]);

  // Start polling on mount
  useEffect(() => {
    startPolling();
    return stopPolling;
  }, [startPolling, stopPolling]);

  // Nothing to show
  if (!data || (!data.transferring && !data.error)) return null;

  const { transferring, currentFile, progress, completedFiles, totalFiles, mode, error } = data;

  const pct =
    totalFiles > 0
      ? Math.round(((completedFiles + progress / 100) / totalFiles) * 100)
      : 0;

  const modeLabel = mode === "move" ? "Moving" : "Copying";

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-vault-surface border-t border-vault-border px-6 py-3 shadow-lg">
      <div className="max-w-5xl mx-auto">
        {error ? (
          <p className="text-sm text-red-400">{error}</p>
        ) : transferring ? (
          <>
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="text-vault-text">
                {modeLabel} {currentFile}&hellip;{" "}
                <span className="text-vault-muted">
                  ({completedFiles}/{totalFiles} files)
                </span>
              </span>
              <span className="text-vault-text tabular-nums">{pct}%</span>
            </div>
            <div className="bg-vault-bg rounded-full h-2 overflow-hidden">
              <div
                className="h-full rounded-full bg-vault-amber transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
