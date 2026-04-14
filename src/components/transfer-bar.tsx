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
  const [dismissed, setDismissed] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
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

  // Auto-dismiss error after 10 seconds
  useEffect(() => {
    if (data && !data.transferring && data.error) {
      const timer = setTimeout(() => setDismissed(true), 10000);
      return () => clearTimeout(timer);
    }
    setDismissed(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.transferring, data?.error]);

  // Auto-dismiss success after 3 seconds
  useEffect(() => {
    if (data && !data.transferring && !data.error && data.completedFiles > 0) {
      setShowSuccess(true);
      const timer = setTimeout(() => setShowSuccess(false), 3000);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.transferring, data?.error, data?.completedFiles]);

  // Success message
  if (showSuccess) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-vault-surface border-t border-vault-border px-6 py-3">
        <div className="text-sm text-green-400">Transfer complete ({data?.completedFiles} files)</div>
      </div>
    );
  }

  // Nothing to show
  if (!data || (!data.transferring && !data.error) || dismissed) return null;

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
          <div className="flex items-center justify-between">
            <p className="text-sm text-red-400">{error}</p>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="ml-4 text-vault-muted hover:text-vault-text text-sm"
              title="Dismiss"
            >
              &#10005;
            </button>
          </div>
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
