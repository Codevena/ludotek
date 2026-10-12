// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SyncDoctor } from "@/components/sync-doctor";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const counts = { missing: 1, extra: 1, changed: 0, legacy: 0, stale: 0, unsafe: 0, unknown: 0 };
const page = (complete = true) => ({ reportId: "12345678-1234-1234-1234-123456789abc", createdAt: new Date(0).toISOString(), complete, summary: { observed: 5, manifest: 5, links: 1, unchanged: 4, counts, truncated: false }, findings: [
  { kind: complete ? "missing" : "unknown", path: "/fixture/missing.sfc", repair: "rescan", detail: "Fixture missing" },
  { kind: "extra", path: "/fixture/extra.sfc", repair: complete ? "review" : "rescan", detail: "Fixture extra", actual: { kind: "file", size: "3", modifiedAt: null } },
], total: 250, nextOffset: 200 });

describe("explicit Doctor diagnosis and safe repairs", () => {
  it("makes no request on mount, runs only after explicit start and repairs only after another click", async () => {
    const fetch = vi.fn(async (url: string) => url.endsWith("/scan") ? Response.json({ success: true }) : Response.json(page()));
    vi.stubGlobal("fetch", fetch);
    render(React.createElement(SyncDoctor, { deviceId: 7 }));
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Diagnose starten" }));
    expect(await screen.findByText("Vollständiges Inventar")).toBeTruthy();
    expect(fetch.mock.calls[0]).toEqual(["/api/devices/7/doctor", expect.objectContaining({ method: "POST" })]);
    expect(screen.getByText("/fixture/missing.sfc")).toBeTruthy();
    expect(fetch).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Manifest durch neuen Scan aktualisieren" }));
    expect(await screen.findByText(/Scanauftrag angenommen/)).toBeTruthy();
    expect(fetch.mock.calls[1]).toEqual(["/api/devices/7/scan", expect.objectContaining({ method: "POST" })]);
    expect(fetch.mock.calls.every(([url]) => !url.includes("delete") && !url.includes("file-plans"))).toBe(true);
  });

  it("shows incomplete inventory and forbids file-removal review links while keeping explicit rescan", async () => {
    vi.stubGlobal("fetch", async () => Response.json(page(false)));
    render(React.createElement(SyncDoctor, { deviceId: 7 }));
    fireEvent.click(screen.getByRole("button", { name: "Diagnose starten" }));
    expect(await screen.findByText("Unvollständiges Inventar")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Dateimanager öffnen" })).toBeNull();
    expect(screen.getByRole("button", { name: "Manifest durch neuen Scan aktualisieren" })).toBeTruthy();
  });

  it("loads next immutable report page without rerunning any device diagnosis", async () => {
    const fetch = vi.fn(async (url: string, options?: RequestInit) => {
      if (url.includes("offset=200")) {
        expect(options?.method).toBe("GET");
        return Response.json({ ...page(), findings: [{ kind: "legacy", gameId: 2, legacyFile: "legacy.sfc", detail: "Fixture legacy", repair: "rescan" }], nextOffset: null });
      }
      return Response.json(page());
    });
    vi.stubGlobal("fetch", fetch);
    render(React.createElement(SyncDoctor, { deviceId: 7 }));
    fireEvent.click(screen.getByRole("button", { name: "Diagnose starten" }));
    fireEvent.click(await screen.findByRole("button", { name: "Nächste Berichtsseite" }));
    expect(await screen.findByText("Katalogvertreter: legacy.sfc")).toBeTruthy();
    expect(fetch.mock.calls[1][0]).toContain("reportId=12345678-1234-1234-1234-123456789abc&offset=200&take=200");
    expect(fetch.mock.calls[1][1]).toMatchObject({ method: "GET" });
    expect(screen.queryByText("/fixture/missing.sfc")).toBeNull();
  });

  it("cancels active diagnosis and ignores its late result after switching device", async () => {
    let signal: AbortSignal | undefined;
    let finish!: (response: Response) => void;
    vi.stubGlobal("fetch", async (_url: string, options?: RequestInit) => {
      signal = options?.signal as AbortSignal;
      return new Promise<Response>((resolve) => { finish = resolve; });
    });
    const view = render(React.createElement(SyncDoctor, { deviceId: 7 }));
    fireEvent.click(screen.getByRole("button", { name: "Diagnose starten" }));
    fireEvent.click(await screen.findByRole("button", { name: "Diagnose abbrechen" }));
    expect(signal?.aborted).toBe(true);
    view.rerender(React.createElement(SyncDoctor, { deviceId: 8 }));
    finish(Response.json(page()));
    await waitFor(() => expect(screen.queryByText("Vollständiges Inventar")).toBeNull());
    expect(screen.queryByText("/fixture/missing.sfc")).toBeNull();
  });

  it("shows real request cancellation and lets a saved report load without another diagnosis", async () => {
    const fetch = vi.fn(async (_url: string, options?: RequestInit) => {
      if (options?.method === "GET") return Response.json(page());
      return new Promise<Response>((_resolve, reject) => options?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true }));
    });
    vi.stubGlobal("fetch", fetch);
    render(React.createElement(SyncDoctor, { deviceId: 7 }));
    fireEvent.click(screen.getByRole("button", { name: "Diagnose starten" }));
    fireEvent.click(await screen.findByRole("button", { name: "Diagnose abbrechen" }));
    expect(await screen.findByText("Diagnose abgebrochen.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Letzten Bericht laden" }));
    expect(await screen.findByText("Vollständiges Inventar")).toBeTruthy();
    expect(fetch.mock.calls[1][1]).toMatchObject({ method: "GET" });
  });
});
