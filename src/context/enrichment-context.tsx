"use client";

import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";

interface EnrichmentState {
  isRunning: boolean;
  current: number;
  total: number;
  enriched: number;
  failed: number;
  title: string;
  type: string;
  justCompleted: boolean;
  dismissed: boolean;
}

interface EnrichmentContextValue extends EnrichmentState {
  startEnrichment: (
    url: string,
    setter?: (v: boolean) => void,
    body?: Record<string, unknown>
  ) => Promise<Record<string, unknown> | null>;
  dismiss: () => void;
}

const initialState: EnrichmentState = {
  isRunning: false,
  current: 0,
  total: 0,
  enriched: 0,
  failed: 0,
  title: "",
  type: "",
  justCompleted: false,
  dismissed: false,
};

const EnrichmentContext = createContext<EnrichmentContextValue>({
  ...initialState,
  startEnrichment: async () => null,
  dismiss: () => {},
});

export function useEnrichment() {
  return useContext(EnrichmentContext);
}

export function EnrichmentProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<EnrichmentState>(initialState);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const activeRunIdRef = useRef(0);
  const prevSetterRef = useRef<((v: boolean) => void) | null>(null);

  useEffect(() => {
    return () => {
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
      abortControllerRef.current?.abort();
    };
  }, []);

  const dismiss = useCallback(() => {
    setState((prev) => ({ ...prev, dismissed: true, justCompleted: false }));
    if (fadeTimerRef.current) {
      clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
  }, []);

  const startEnrichment = useCallback(
    async (
      url: string,
      setter?: (v: boolean) => void,
      body?: Record<string, unknown>
    ): Promise<Record<string, unknown> | null> => {
      // Clear previous run's setter so it doesn't stay stuck true
      if (prevSetterRef.current && prevSetterRef.current !== setter) {
        prevSetterRef.current(false);
      }
      prevSetterRef.current = setter ?? null;

      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const runId = ++activeRunIdRef.current;

      setter?.(true);
      setState({
        isRunning: true,
        current: 0,
        total: 0,
        enriched: 0,
        failed: 0,
        title: "",
        type: "",
        justCompleted: false,
        dismissed: false,
      });

      if (fadeTimerRef.current) {
        clearTimeout(fadeTimerRef.current);
        fadeTimerRef.current = null;
      }

      const isStale = () => runId !== activeRunIdRef.current;
      let result: Record<string, unknown> | null = null;

      try {
        const res = await fetch(url, {
          method: "POST",
          signal: controller.signal,
          ...(body
            ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
            : {}),
        });

        if (!res.ok) {
          let errResult: Record<string, unknown>;
          try { errResult = await res.json(); } catch { errResult = { error: `HTTP ${res.status}` }; }
          if (!isStale()) {
            setter?.(false);
            setState(initialState);
          }
          return errResult;
        }

        const contentType = res.headers.get("content-type") || "";
        if (!contentType.includes("text/event-stream")) {
          const jsonResult = await res.json();
          if (!isStale()) {
            setter?.(false);
            setState(initialState);
          }
          return jsonResult;
        }

        const reader = res.body?.getReader();
        if (!reader) {
          if (!isStale()) {
            setter?.(false);
            setState(initialState);
          }
          return { error: "No response body" };
        }

        const decoder = new TextDecoder();
        let buffer = "";
        let enrichedCount = 0;
        let failedCount = 0;

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
              if (isStale()) continue;
              try {
                const data = JSON.parse(line.slice(6));

                if (data.type === "progress") {
                  setState((prev) => prev.dismissed ? prev : ({
                    ...prev,
                    current: data.current,
                    total: data.total,
                    title: data.title,
                    type: data.platform || prev.type,
                    enriched: enrichedCount,
                    failed: failedCount,
                  }));
                } else if (data.type === "enriched") {
                  enrichedCount++;
                  setState((prev) => prev.dismissed ? prev : ({
                    ...prev,
                    enriched: enrichedCount,
                    ...(data.current != null ? { current: data.current } : {}),
                  }));
                } else if (data.type === "error" || data.type === "missed") {
                  failedCount++;
                  setState((prev) => prev.dismissed ? prev : ({
                    ...prev,
                    failed: failedCount,
                    ...(data.current != null ? { current: data.current } : {}),
                  }));
                } else if (data.type === "done") {
                  // eslint-disable-next-line @typescript-eslint/no-unused-vars
                  const { type: _t, ...doneFields } = data;
                  result = { success: true, ...doneFields };
                }
              } catch {
                // skip malformed events
              }
            }
          }
        } finally {
          await reader.cancel();
        }
      } catch (err) {
        if (controller.signal.aborted || isStale()) {
          return null;
        }
        result = { error: String(err) };
      }

      if (isStale()) return result;

      setter?.(false);
      setState((prev) => ({
        ...prev,
        isRunning: false,
        current: prev.total || prev.current,
        justCompleted: !prev.dismissed,
      }));

      fadeTimerRef.current = setTimeout(() => {
        setState(initialState);
      }, 3000);

      return result;
    },
    []
  );

  return (
    <EnrichmentContext.Provider value={{ ...state, startEnrichment, dismiss }}>
      {children}
    </EnrichmentContext.Provider>
  );
}
