// @vitest-environment jsdom
import React, { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EnrichmentProvider, useEnrichment } from "@/context/enrichment-context";
import { EnrichmentBar } from "@/components/enrichment-bar";

const h = React.createElement;
function Probe() {
  const enrichment = useEnrichment();
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  return h("div", null,
    h("button", { onClick: async () => setResult(await enrichment.startEnrichment("/api/enrich", undefined, { force: true })) }, "Run"),
    h("output", { "data-testid": "result" }, JSON.stringify(result)),
    h("output", { "data-testid": "position" }, JSON.stringify({ current: enrichment.current, total: enrichment.total })),
  );
}
function sse(events: Record<string, unknown>[]) {
  return new Response(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""), { headers: { "Content-Type": "text/event-stream" } });
}
function mount() { render(h(EnrichmentProvider, null, h(Probe), h(EnrichmentBar))); }
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("enrichment stream consumers", () => {
  it("shows a budget stop with its actual position and reason, without a success result", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => sse([
      { type: "start", total: 500, totalRemaining: 500 },
      { type: "progress", current: 1, total: 500, title: "Toy" },
      { type: "stopped", reason: "Provider long-term budget exhausted", processed: 1 },
      { type: "done", processed: 1, enriched: 0, failed: 0, remaining: 500, stopped: true },
    ])));
    mount(); fireEvent.click(screen.getByText("Run"));
    await waitFor(() => expect(screen.getByTestId("result").textContent).not.toBe("null"));
    expect(JSON.parse(screen.getByTestId("result").textContent!)).toMatchObject({ success: false, error: "Provider long-term budget exhausted", processed: 1 });
    expect(JSON.parse(screen.getByTestId("position").textContent!)).toEqual({ current: 1, total: 500 });
    expect(screen.getByText("Stopped")).toBeTruthy();
    expect(screen.getByText("Provider long-term budget exhausted")).toBeTruthy();
    expect(screen.queryByText("Done")).toBeNull();
  });

  it("continues a capped batch with its server cursor, then aggregates the completed run", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(sse([
        { type: "start", total: 500, totalRemaining: 501 },
        { type: "progress", current: 500, total: 500 },
        { type: "done", processed: 500, enriched: 500, failed: 0, remaining: 1, pending: 1, stopped: false, nextCursor: 500, hasMore: true },
      ]))
      .mockResolvedValueOnce(sse([
        { type: "start", total: 1, totalRemaining: 1 },
        { type: "progress", current: 1, total: 1 },
        { type: "done", processed: 1, enriched: 1, failed: 0, remaining: 0, stopped: false, nextCursor: 501, hasMore: false },
      ]));
    vi.stubGlobal("fetch", fetch); mount(); fireEvent.click(screen.getByText("Run"));
    await waitFor(() => expect(screen.getByTestId("result").textContent).not.toBe("null"));
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(String(fetch.mock.calls[1][0])).toContain("afterId=500");
    expect(JSON.parse(fetch.mock.calls[1][1]!.body as string)).toEqual({ force: true });
    expect(JSON.parse(screen.getByTestId("result").textContent!)).toMatchObject({ processed: 501, enriched: 501, remaining: 0, success: true });
    expect(JSON.parse(screen.getByTestId("position").textContent!)).toEqual({ current: 501, total: 501 });
  });
});
