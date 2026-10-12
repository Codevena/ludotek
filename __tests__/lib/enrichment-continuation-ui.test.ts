// @vitest-environment jsdom
import React, { useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EnrichmentProvider, useEnrichment } from "@/context/enrichment-context";
import { EnrichmentBar } from "@/components/enrichment-bar";

const h = React.createElement;
function Probe() {
  const enrichment = useEnrichment();
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  return h("div", null,
    h("button", { onClick: async () => setResult(await enrichment.startEnrichment("/api/enrich/refresh?platform=snes", undefined, { force: true, platforms: ["snes"] })) }, "Run"),
    h("output", { "data-testid": "result" }, JSON.stringify(result)),
    h("output", { "data-testid": "position" }, `${enrichment.current}/${enrichment.total}`),
  );
}
function events(values: Record<string, unknown>[]) { return values.map((value) => `data: ${JSON.stringify(value)}\n\n`).join(""); }
function sse(values: Record<string, unknown>[]) { return new Response(events(values), { headers: { "Content-Type": "text/event-stream" } }); }
function mount() { return render(h(EnrichmentProvider, null, h(Probe), h(EnrichmentBar))); }
async function result() {
  await waitFor(() => expect(screen.getByTestId("result").textContent).not.toBe("null"));
  return JSON.parse(screen.getByTestId("result").textContent!) as Record<string, unknown>;
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("bounded enrichment continuation", () => {
  it("retains acknowledged enrichment after EOF without done and excludes the next unfinished item", async () => {
    const fetch = vi.fn(async () => sse([
      { type: "start", total: 3, totalRemaining: 3 },
      { type: "progress", current: 1, total: 3 },
      { type: "enriched", current: 1 },
      { type: "progress", current: 2, total: 3 },
    ]));
    vi.stubGlobal("fetch", fetch); mount(); fireEvent.click(screen.getByText("Run"));
    expect(await result()).toMatchObject({ success: false, processed: 1, enriched: 1, failed: 0, error: "Enrichment stream ended before completion" });
    expect(screen.getByTestId("position").textContent).toBe("1/3");
    expect(screen.getByText("1 done")).toBeTruthy();
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("retains acknowledged counters when the response reader throws", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(new TextEncoder().encode(events([
        { type: "start", total: 3, totalRemaining: 3 },
        { type: "enriched", current: 1 },
        { type: "error", current: 2, error: "Ordinary fixture failure" },
      ]))); },
      pull(controller) { controller.error(new Error("Fixture read failure")); },
    });
    vi.stubGlobal("fetch", async () => new Response(stream, { headers: { "Content-Type": "text/event-stream" } }));
    mount(); fireEvent.click(screen.getByText("Run"));
    expect(await result()).toMatchObject({ success: false, processed: 2, enriched: 1, failed: 1, error: "Fixture read failure" });
    expect(screen.getByTestId("position").textContent).toBe("2/3");
  });

  it("adds an incomplete second page once while retaining all five completed-page totals", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(sse([
        { type: "start", total: 5, totalRemaining: 9 },
        { type: "done", processed: 5, enriched: 1, updated: 2, skipped: 1, failed: 1, nextCursor: 50, hasMore: true },
      ]))
      .mockResolvedValueOnce(sse([
        { type: "start", total: 4, totalRemaining: 4 },
        { type: "enriched", current: 1 },
        { type: "skipped", current: 2 },
        { type: "error", current: 3, error: "Ordinary fixture failure" },
        { type: "progress", current: 4, total: 4 },
      ]));
    vi.stubGlobal("fetch", fetch); mount(); fireEvent.click(screen.getByText("Run"));
    expect(await result()).toMatchObject({ success: false, processed: 8, enriched: 2, updated: 2, skipped: 2, failed: 2 });
    expect(screen.getByTestId("position").textContent).toBe("8/9");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("does not recount an accepted done page when its continuation cursor then fails", async () => {
    vi.stubGlobal("fetch", async () => sse([
      { type: "start", total: 1, totalRemaining: 2 },
      { type: "enriched", current: 1 },
      { type: "done", processed: 1, enriched: 1, nextCursor: 0, hasMore: true },
    ]));
    mount(); fireEvent.click(screen.getByText("Run"));
    expect(await result()).toMatchObject({ success: false, processed: 1, enriched: 1, error: "Invalid enrichment continuation cursor" });
  });

  it("does not let a cancelled stale response overwrite the fresh run's counters", async () => {
    let resolveOld!: (response: Response) => void;
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveOld = resolve; }))
      .mockResolvedValueOnce(sse([
        { type: "start", total: 2, totalRemaining: 2 },
        { type: "done", processed: 2, enriched: 2, hasMore: false },
      ]));
    vi.stubGlobal("fetch", fetch); mount(); fireEvent.click(screen.getByText("Run"));
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByText("Run"));
    await waitFor(() => expect(screen.getByTestId("position").textContent).toBe("2/2"));
    await act(async () => resolveOld(sse([
      { type: "start", total: 3, totalRemaining: 3 },
      { type: "enriched", current: 1 },
    ])));
    expect(screen.getByTestId("position").textContent).toBe("2/2");
    expect(screen.getByText("2 done")).toBeTruthy();
    expect(screen.queryByText("Stopped")).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("retains platform/body filters and sums updated/skipped/ordinary failures across batches", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(sse([
        { type: "start", total: 2, totalRemaining: 3 },
        { type: "done", processed: 2, updated: 1, skipped: 1, failed: 0, nextCursor: 20, hasMore: true, remaining: 1 },
      ]))
      .mockResolvedValueOnce(sse([
        { type: "start", total: 1, totalRemaining: 1 },
        { type: "done", processed: 1, updated: 0, skipped: 0, failed: 1, nextCursor: 30, hasMore: false, remaining: 1 },
      ]));
    vi.stubGlobal("fetch", fetch); mount(); fireEvent.click(screen.getByText("Run"));
    expect(await result()).toMatchObject({ success: true, processed: 3, updated: 1, skipped: 1, failed: 1, remaining: 1 });
    expect(String(fetch.mock.calls[1][0])).toBe("/api/enrich/refresh?platform=snes&afterId=20");
    expect(JSON.parse(fetch.mock.calls[1][1]!.body as string)).toEqual({ force: true, platforms: ["snes"] });
    expect(screen.getByTestId("position").textContent).toBe("3/3");
  });

  it("waits for the old stream to reach EOF before acquiring the next batch", async () => {
    let streamController!: ReadableStreamDefaultController<Uint8Array>;
    const stream = new ReadableStream<Uint8Array>({ start(controller) {
      streamController = controller;
      controller.enqueue(new TextEncoder().encode(events([
        { type: "start", total: 1, totalRemaining: 2 },
        { type: "done", processed: 1, enriched: 1, nextCursor: 1, hasMore: true },
      ])));
    } });
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(new Response(stream, { headers: { "Content-Type": "text/event-stream" } }))
      .mockResolvedValueOnce(sse([{ type: "done", processed: 1, enriched: 1, hasMore: false }]));
    vi.stubGlobal("fetch", fetch); mount(); fireEvent.click(screen.getByText("Run"));
    await waitFor(() => expect(screen.getByTestId("position").textContent).toBe("0/2"));
    expect(fetch).toHaveBeenCalledOnce();
    await act(async () => streamController.close());
    expect(await result()).toMatchObject({ success: true, processed: 2, enriched: 2 });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it.each([0, -1, 1.5, "1", null])("rejects invalid cursor %s before another dispatch", async (cursor) => {
    const fetch = vi.fn(async () => sse([
      { type: "start", total: 1, totalRemaining: 2 },
      { type: "done", processed: 1, hasMore: true, nextCursor: cursor },
    ]));
    vi.stubGlobal("fetch", fetch); mount(); fireEvent.click(screen.getByText("Run"));
    expect(await result()).toMatchObject({ success: false, processed: 1, error: "Invalid enrichment continuation cursor" });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("halts a repeated cursor rather than revisiting the same rows", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(sse([{ type: "done", processed: 1, hasMore: true, nextCursor: 10 }]))
      .mockResolvedValueOnce(sse([{ type: "done", processed: 1, hasMore: true, nextCursor: 10 }]));
    vi.stubGlobal("fetch", fetch); mount(); fireEvent.click(screen.getByText("Run"));
    expect(await result()).toMatchObject({ success: false, processed: 2, error: "Invalid enrichment continuation cursor" });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("stops after 100 pages instead of issuing unbounded calls", async () => {
    let cursor = 0;
    const fetch = vi.fn(async () => sse([
      { type: "start", total: 1, totalRemaining: 101 - cursor },
      { type: "done", processed: 1, enriched: 1, nextCursor: ++cursor, hasMore: true },
    ]));
    vi.stubGlobal("fetch", fetch); mount(); fireEvent.click(screen.getByText("Run"));
    expect(await result()).toMatchObject({ success: false, processed: 100, error: "Enrichment reached its 100-batch limit" });
    expect(fetch).toHaveBeenCalledTimes(100);
    expect(screen.getByTestId("position").textContent).toBe("100/101");
  });

  it("treats an error with stopped:true as fatal even if done advertises more work", async () => {
    const fetch = vi.fn(async () => sse([
      { type: "start", total: 2, totalRemaining: 3 },
      { type: "error", stopped: true, error: "Admission store unavailable", processed: 1 },
      { type: "done", processed: 1, hasMore: true, nextCursor: 1, stopped: true },
    ]));
    vi.stubGlobal("fetch", fetch); mount(); fireEvent.click(screen.getByText("Run"));
    expect(await result()).toMatchObject({ success: false, processed: 1, error: "Admission store unavailable" });
    expect(fetch).toHaveBeenCalledOnce();
    expect(screen.getByTestId("position").textContent).toBe("1/3");
  });

  it("retains the actual processed count when a fatal stop closes without a done event", async () => {
    vi.stubGlobal("fetch", async () => sse([
      { type: "start", total: 2, totalRemaining: 2 },
      { type: "stopped", reason: "Admission store unavailable", processed: 1 },
    ]));
    mount(); fireEvent.click(screen.getByText("Run"));
    expect(await result()).toMatchObject({ success: false, processed: 1, error: "Admission store unavailable" });
    expect(screen.getByTestId("position").textContent).toBe("1/2");
  });

  it("keeps stop details visible until dismiss and does not schedule a success fade", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", async () => sse([
      { type: "start", total: 2, totalRemaining: 2 },
      { type: "stopped", reason: "Budget exhausted", processed: 1 },
      { type: "done", processed: 1, stopped: true },
    ]));
    mount();
    await act(async () => { fireEvent.click(screen.getByText("Run")); });
    await act(async () => vi.advanceTimersByTimeAsync(5000));
    expect(screen.getByText("Stopped")).toBeTruthy();
    expect(screen.getByText("Budget exhausted")).toBeTruthy();
    expect(screen.getByTestId("position").textContent).toBe("1/2");
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText("Stopped")).toBeNull();
  });

  it("cancels a held stream on unmount without calling a continuation", async () => {
    let cancelled = false;
    const stream = new ReadableStream({ cancel() { cancelled = true; } });
    const fetch = vi.fn(async () => new Response(stream, { headers: { "Content-Type": "text/event-stream" } }));
    vi.stubGlobal("fetch", fetch); const mounted = mount(); fireEvent.click(screen.getByText("Run"));
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    await act(async () => mounted.unmount());
    expect(cancelled).toBe(true);
    expect(fetch).toHaveBeenCalledOnce();
  });
});
