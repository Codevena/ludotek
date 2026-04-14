"use client";

import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";

const POLL_INTERVAL_MS = 2000;

interface ScanState {
  scanning: boolean;
  progress: number;
  status: string;
  gamesFound: number;
  newGames: number;
  updatedGames: number;
  deviceName: string;
  error?: string;
  justCompleted: boolean;
  dismissed: boolean;
}

interface ScanContextValue extends ScanState {
  startScan: (deviceId?: number) => Promise<void>;
  dismiss: () => void;
}

const initialState: ScanState = {
  scanning: false,
  progress: 0,
  status: "",
  gamesFound: 0,
  newGames: 0,
  updatedGames: 0,
  deviceName: "",
  justCompleted: false,
  dismissed: false,
};

const ScanContext = createContext<ScanContextValue>({
  ...initialState,
  startScan: async () => {},
  dismiss: () => {},
});

export function useScan() {
  return useContext(ScanContext);
}

export function ScanProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ScanState>(initialState);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const dismiss = useCallback(() => {
    setState((prev) => ({ ...prev, dismissed: true, justCompleted: false }));
    stopPolling();
    if (fadeTimerRef.current) {
      clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
  }, [stopPolling]);

  const pollStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/scan/status");
      if (!res.ok) return;
      const data = await res.json();

      setState((prev) => {
        if (prev.dismissed) return prev;

        // Scan just finished
        if (!data.scanning && prev.scanning) {
          stopPolling();
          // Auto-hide after 5 seconds
          fadeTimerRef.current = setTimeout(() => {
            setState(initialState);
          }, 5000);
          return {
            ...prev,
            ...data,
            scanning: false,
            justCompleted: true,
          };
        }

        if (data.scanning) {
          return { ...prev, ...data, justCompleted: false, dismissed: false };
        }

        return prev;
      });
    } catch {
      // Ignore polling errors
    }
  }, [stopPolling]);

  const startScan = useCallback(
    async (deviceId?: number) => {
      if (fadeTimerRef.current) {
        clearTimeout(fadeTimerRef.current);
        fadeTimerRef.current = null;
      }
      stopPolling();

      setState({
        scanning: true,
        progress: 0,
        status: "Starting scan...",
        gamesFound: 0,
        newGames: 0,
        updatedGames: 0,
        deviceName: "",
        justCompleted: false,
        dismissed: false,
      });

      try {
        const url = deviceId ? `/api/devices/${deviceId}/scan` : "/api/scan";
        const res = await fetch(url, { method: "POST" });
        const data = await res.json();

        if (!res.ok) {
          setState((prev) => ({
            ...prev,
            scanning: false,
            status: data.error || "Scan failed",
            error: data.error,
          }));
          fadeTimerRef.current = setTimeout(() => setState(initialState), 5000);
          return;
        }

        // Start polling for progress
        pollingRef.current = setInterval(pollStatus, POLL_INTERVAL_MS);
      } catch (err) {
        setState((prev) => ({
          ...prev,
          scanning: false,
          status: "Failed to start scan",
          error: String(err),
        }));
        fadeTimerRef.current = setTimeout(() => setState(initialState), 5000);
      }
    },
    [pollStatus, stopPolling],
  );

  // Check if a scan is already running on mount
  useEffect(() => {
    async function checkExisting() {
      try {
        const res = await fetch("/api/scan/status");
        if (!res.ok) return;
        const data = await res.json();
        if (data.scanning) {
          setState({ ...data, justCompleted: false, dismissed: false });
          pollingRef.current = setInterval(pollStatus, POLL_INTERVAL_MS);
        }
      } catch {
        // Ignore
      }
    }
    checkExisting();
    return () => {
      stopPolling();
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, [pollStatus, stopPolling]);

  return (
    <ScanContext.Provider value={{ ...state, startScan, dismiss }}>
      {children}
    </ScanContext.Provider>
  );
}
