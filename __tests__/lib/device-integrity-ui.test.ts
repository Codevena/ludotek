// @vitest-environment jsdom
import React from "react";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DeviceIntegrity } from "@/components/device-integrity";

const sourceId = "12345678-1234-1234-1234-123456789abc";
const jobId = "12345678-1234-1234-1234-123456789def";
const job = { id: jobId, deviceId: 1, datSourceId: sourceId, sourceName: "Own DAT", status: "completed", total: 1, checked: 1, progress: 100, error: null, cancelRequested: false, createdAt: "2026-10-12T00:00:00Z" };
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("device integrity UI", () => {
  it("starts an explicit file/revision check using a DAT index rather than filename assumptions", async () => {
    const calls: { url: string; body?: string }[] = [];
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      calls.push({ url, body: init?.body as string | undefined });
      if (init?.method === "POST") return Response.json({ job: { ...job, status: "running", checked: 0, progress: 0 } }, { status: 202 });
      if (url.includes("/jobs/")) return Response.json({ job, results: [], nextCursor: null });
      if (url.includes("sourceId=")) return Response.json({ roms: [{ index: 7, name: "Other name.nes", gameName: "Known revision", size: 3 }], nextCursor: null });
      if (url.includes("/dats")) return Response.json({ sources: [{ id: sourceId, name: "Own DAT", format: "logiqx", romCount: 1 }], nextCursor: null });
      return Response.json({ files: [{ id: 41, path: "/own/nes/Game.nes", size: "3" }], nextFilesCursor: null, inventoryComplete: true, job: null });
    });
    render(React.createElement(DeviceIntegrity, { deviceId: 1 }));
    await screen.findByRole("option", { name: "Own DAT" });
    fireEvent.change(screen.getByLabelText("DAT-Quelle"), { target: { value: sourceId } });
    fireEvent.change(screen.getByLabelText("Prüfumfang"), { target: { value: "41" } });
    await screen.findByRole("option", { name: /Known revision/ });
    fireEvent.change(screen.getByLabelText("Erwartete DAT-Revision"), { target: { value: "7" } });
    expect(calls.filter((call) => call.body)).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Integrität prüfen" }));
    await waitFor(() => expect(calls.find((call) => call.body)?.body).toBe(JSON.stringify({ datSourceId: sourceId, fileIds: [41], expected: [{ deviceFileId: 41, romIndex: 7 }] })));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("1/1"));
  });

  it("shows unknown, stale, real duplicate counts and DAT revision/source without claiming corruption", async () => {
    const result = { id: 1, deviceFileId: 41, path: "/own/Game.nes", fingerprint: { size: 3, sha256: "a".repeat(64) }, status: "unknown", originalStatus: "unknown", stale: false, duplicateCount: 2, matches: [], matchCount: 0, sourceName: "Own DAT", datSourceId: sourceId, expectedRom: null };
    vi.stubGlobal("fetch", async (url: string) => {
      if (url.includes("/dats")) return Response.json({ sources: [], nextCursor: null });
      if (url.includes("/jobs/")) return Response.json({ job, results: [result, { ...result, id: 2, path: "/own/Changed.nes", status: "stale", stale: true, originalStatus: "verified", matches: [{ gameName: "Revision 2", name: "Expected.nes", size: 3 }], matchCount: 1 }], nextCursor: null });
      return Response.json({ files: [], nextFilesCursor: null, inventoryComplete: false, job });
    });
    render(React.createElement(DeviceIntegrity, { deviceId: 1 }));
    expect(await screen.findByText("Unbekannt")).toBeTruthy();
    expect(await screen.findByText("Veraltet")).toBeTruthy();
    expect(screen.getAllByText(/2 inhaltgleiche Dateien/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Revision 2/)).toBeTruthy();
    expect(screen.queryByText(/beschädigt/i)).toBeNull();
    expect(screen.getAllByText(/erneut scannen/i).length).toBeGreaterThan(0);
  });

  it("keeps cancellation pending until the server reports drained cancellation", async () => {
    let finish!: (response: Response) => void;
    const running = { ...job, status: "running", checked: 1, total: 3, progress: 33 };
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      if (init?.method === "POST" && url.endsWith("/cancel")) return new Promise<Response>((resolve) => { finish = resolve; });
      if (url.includes("/dats")) return Response.json({ sources: [], nextCursor: null });
      if (url.includes("/jobs/")) return Response.json({ job: running, results: [], nextCursor: null });
      return Response.json({ files: [], nextFilesCursor: null, inventoryComplete: true, job: running });
    });
    render(React.createElement(DeviceIntegrity, { deviceId: 1 }));
    fireEvent.click(await screen.findByRole("button", { name: "Prüfung abbrechen" }));
    expect(await screen.findByText(/Abbruch wird angefordert/)).toBeTruthy();
    expect(screen.queryByText(/Prüfung abgebrochen/)).toBeNull();
    finish(Response.json({ job: { ...running, status: "cancelled", cancelRequested: true }, results: [], nextCursor: null }));
    expect(await screen.findByText(/Prüfung abgebrochen/)).toHaveTextContent("1/3");
  });

  it("imports only on explicit action and retains the selected local source", async () => {
    const calls: { url: string; body?: BodyInit | null }[] = [];
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      calls.push({ url, body: init?.body });
      if (init?.method === "POST") return Response.json({ source: { id: sourceId, name: "Friendly toy", romCount: 1, format: "logiqx" } }, { status: 201 });
      if (url.includes("sourceId=")) return Response.json({ roms: [], nextCursor: null });
      if (url.includes("/dats")) return Response.json({ sources: [], nextCursor: null });
      return Response.json({ files: [], totalFiles: 0, nextFilesCursor: null, inventoryComplete: true, job: null });
    });
    render(React.createElement(DeviceIntegrity, { deviceId: 1 }));
    await screen.findByText(/Keine bestätigten ROM-Dateien/);
    const file = new File(["own raw DAT"], "toy.dat", { type: "text/plain" });
    fireEvent.change(screen.getByLabelText(/Lokale DAT-Datei/), { target: { files: [file] } });
    fireEvent.change(screen.getByLabelText("Name der DAT-Quelle"), { target: { value: "Friendly toy" } });
    expect(calls.filter((call) => call.body)).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "DAT lokal importieren" }));
    expect(await screen.findByText(/1 DAT-Einträge lokal importiert/)).toBeTruthy();
    const imported = calls.find((call) => call.body);
    expect(imported).toEqual({ url: "/api/integrity/dats?name=Friendly%20toy", body: file });
    expect(screen.getByLabelText("DAT-Quelle")).toHaveValue(sourceId);
  });

  it("loads result pages and lets a fresh manifest snapshot show a newly stale historical check", async () => {
    const first = { id: 1, path: "/own/First.nes", status: "verified", originalStatus: "verified", stale: false, fingerprint: { size: 3, sha256: "a".repeat(64) }, duplicateCount: 1, matches: [], matchCount: 0 };
    const second = { ...first, id: 2, path: "/own/Second.nes" };
    let refreshed = false;
    vi.stubGlobal("fetch", async (url: string) => {
      if (url.includes("/dats")) return Response.json({ sources: [], nextCursor: null });
      if (url.includes("afterId=1")) return Response.json({ job, results: [second], nextCursor: null });
      if (url.includes("/jobs/")) {
        const result = refreshed ? { ...first, status: "stale", stale: true } : first;
        return Response.json({ job, results: [result], nextCursor: 1 });
      }
      return Response.json({ files: [], nextFilesCursor: null, inventoryComplete: true, job, jobs: [job] });
    });
    render(React.createElement(DeviceIntegrity, { deviceId: 1 }));
    fireEvent.click(await screen.findByRole("button", { name: "Weitere Prüfergebnisse laden" }));
    expect(await screen.findByText("/own/Second.nes")).toBeTruthy();
    expect(screen.getByText("/own/First.nes")).toBeTruthy();
    refreshed = true;
    fireEvent.click(screen.getByRole("button", { name: "Ergebnisse aktualisieren" }));
    expect(await screen.findByText("Veraltet")).toBeTruthy();
  });

  it("shows restart interruption without claiming successful completion", async () => {
    vi.stubGlobal("fetch", async (url: string) => {
      if (url.includes("/dats")) return Response.json({ sources: [], nextCursor: null });
      if (url.includes("/jobs/")) return Response.json({ job: { ...job, status: "interrupted", total: 3, checked: 1, progress: 33 }, results: [], nextCursor: null });
      return Response.json({ files: [], nextFilesCursor: null, inventoryComplete: true, job: { ...job, status: "interrupted" } });
    });
    render(React.createElement(DeviceIntegrity, { deviceId: 1 }));
    await waitFor(() => expect(screen.getByText(/Prüfung unterbrochen/)).toHaveTextContent("1/3"));
    expect(screen.queryByText(/Prüflauf abgeschlossen/)).toBeNull();
  });
});
