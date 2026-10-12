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
  networkDown: boolean;
  stopped: boolean;
  stopReason: string;
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
  networkDown: false,
  stopped: false,
  stopReason: "",
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
        networkDown: false,
        stopped: false,
        stopReason: "",
      });

      if (fadeTimerRef.current) {
        clearTimeout(fadeTimerRef.current);
        fadeTimerRef.current = null;
      }

      const isStale = () => runId !== activeRunIdRef.current;
      let result: Record<string, unknown> | null = null;
      const totals = { processed: 0, enriched: 0, failed: 0, updated: 0, skipped: 0 };
      let runTotal = 0;
      let position = 0;
      let stopped = false;
      let stopReason = "";
      let networkDown = false;
      const count = (value: unknown, fallback = 0): number =>
        typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : fallback;
      let activePageCounts: typeof totals | null = null;
      let activeDoneFields: Record<string, unknown> | null = null;
      let pageAccounted = true;
      const accountCurrentPage = (fields = activeDoneFields) => {
        if (pageAccounted || !activePageCounts) return;
        for (const key of Object.keys(totals) as Array<keyof typeof totals>) {
          totals[key] += count(fields?.[key], activePageCounts[key]);
        }
        pageAccounted = true;
        position = totals.processed;
      };
      const stop = (reason: string) => {
        stopped = true;
        stopReason = reason;
        setState((prev) => ({ ...prev, stopped: true, stopReason: reason }));
      };

      try {
        const continuation = new URL(url, "http://localhost");
        let previousCursor = Number(continuation.searchParams.get("afterId") || 0);
        let nextUrl = url;
        for (let page = 0; page < 100; page++) {
          if (controller.signal.aborted || isStale()) break;
          const offset = totals.processed;
          const pageCounts = { processed: 0, enriched: 0, failed: 0, updated: 0, skipped: 0 };
          activePageCounts = pageCounts;
          activeDoneFields = null;
          pageAccounted = false;
          let doneFields: Record<string, unknown> | null = null;
          const res = await fetch(nextUrl, {
            method: "POST",
            signal: controller.signal,
            ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
          });
          if (!res.ok) {
            const error = await res.json().catch(() => ({}));
            throw new Error(error.error || `HTTP ${res.status}`);
          }
          if (!(res.headers.get("content-type") || "").includes("text/event-stream")) {
            doneFields = await res.json();
          } else {
            const reader = res.body?.getReader();
            if (!reader) throw new Error("No response body");
            const cancelReader = () => { void reader.cancel().catch(() => {}); };
            controller.signal.addEventListener("abort", cancelReader, { once: true });
            const decoder = new TextDecoder();
            let buffer = "";
            const consume = (line: string) => {
              if (!line.startsWith("data: ") || isStale()) return;
              let data: Record<string, unknown>;
              try { data = JSON.parse(line.slice(6)); } catch { return; }
              if (data.type === "start") {
                runTotal = Math.max(runTotal, offset + count(data.totalRemaining, count(data.total)));
              } else if (data.type === "stopped" || (data.type === "error" && data.stopped === true)) {
                if (data.processed !== undefined) {
                  pageCounts.processed = count(data.processed);
                  position = offset + pageCounts.processed;
                }
                stop(String(data.reason || data.message || data.error || "Enrichment stopped"));
              } else if (data.type === "done") {
                const { type: ignoredType, ...fields } = data;
                void ignoredType;
                doneFields = fields;
                activeDoneFields = fields;
              } else if (data.type === "enriched") {
                pageCounts.enriched++;
                pageCounts.processed = count(data.current, pageCounts.processed + 1);
              } else if (data.type === "skipped") {
                pageCounts.skipped++;
                pageCounts.processed = count(data.current, pageCounts.processed + 1);
              } else if (data.type === "error" || data.type === "missed") {
                pageCounts.failed++;
                pageCounts.processed = count(data.current, pageCounts.processed + 1);
                if (data.networkDown) {
                  networkDown = true;
                  stop(String(data.error || data.message || "Network unavailable"));
                }
              }
              if (data.current !== undefined) position = offset + count(data.current);
              setState((prev) => ({
                ...prev, current: position, total: runTotal,
                enriched: totals.enriched + totals.updated + pageCounts.enriched + pageCounts.updated,
                failed: totals.failed + pageCounts.failed,
                title: typeof data.title === "string" ? data.title : prev.title,
                type: typeof data.platform === "string" ? data.platform : prev.type,
                networkDown,
              }));
            };
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                buffer = buffer.replace(/\r\n/g, "\n");
                const lines = buffer.split("\n\n");
                buffer = lines.pop() || "";
                lines.forEach(consume);
              }
              buffer += decoder.decode();
              if (buffer.trim()) consume(buffer);
            } finally {
              controller.signal.removeEventListener("abort", cancelReader);
              await reader.cancel().catch(() => {});
              reader.releaseLock();
            }
          }
          if (isStale()) return null;
          if (controller.signal.aborted) { accountCurrentPage(); stop("Enrichment cancelled"); break; }
          if (!doneFields) {
            if (stopped) doneFields = { stopped: true, ...pageCounts };
            else throw new Error("Enrichment stream ended before completion");
          }
          accountCurrentPage(doneFields);
          networkDown ||= doneFields.networkDown === true;
          if (doneFields.stopped === true || doneFields.success === false || networkDown) {
            stop(stopReason || String(doneFields.reason || doneFields.error || (networkDown ? "Network unavailable" : "Enrichment stopped")));
          }
          result = { ...doneFields, ...totals, success: !stopped, stopped, ...(stopped ? { error: stopReason } : {}) };
          if (stopped || doneFields.hasMore !== true) break;
          const cursor = doneFields.nextCursor;
          if (typeof cursor !== "number" || !Number.isSafeInteger(cursor) || cursor <= previousCursor) {
            throw new Error("Invalid enrichment continuation cursor");
          }
          if (page === 99) throw new Error("Enrichment reached its 100-batch limit");
          previousCursor = cursor;
          continuation.searchParams.set("afterId", String(cursor));
          nextUrl = /^https?:\/\//i.test(url) ? continuation.href : `${continuation.pathname}${continuation.search}${continuation.hash}`;
        }
      } catch (err) {
        if (isStale()) return null;
        accountCurrentPage();
        stop(controller.signal.aborted ? "Enrichment cancelled" : err instanceof Error ? err.message : String(err));
        result = { ...(result || {}), ...totals, success: false, stopped: true, error: stopReason };
      }

      if (isStale()) return result;
      if (controller.signal.aborted && !stopped) stop("Enrichment cancelled");
      if (stopped) result = { ...(result || {}), ...totals, success: false, stopped: true, error: stopReason };

      setter?.(false);
      setState((prev) => ({
        ...prev,
        isRunning: false,
        current: position,
        total: runTotal,
        enriched: totals.enriched + totals.updated,
        failed: totals.failed,
        stopped,
        stopReason,
        networkDown,
        justCompleted: !prev.dismissed,
      }));

      if (!stopped && !networkDown) {
        fadeTimerRef.current = setTimeout(() => setState(initialState), 3000);
      }

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
