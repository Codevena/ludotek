// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DeviceSaves } from "@/components/device-saves";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const uuid = "12345678-1234-4234-9234-123456789abc";
const other = "87654321-1234-4234-9234-123456789abc";
const version = { id: uuid, deviceId: 1, gameId: 7, deviceName: "Own fixture", gameTitle: "Own game", platform: "snes", fileKey: "snes|Toy.srm", sourcePath: "/fixture/saves/Toy.srm", sha256: "a".repeat(64), size: "8", createdAt: new Date(0).toISOString() };
const plan = { id: uuid, kind: "save_restore", status: "ready", totalBytes: "8", revision: 0, error: null, createdAt: new Date(0).toISOString(), appliedAt: null, operations: [{ id: other, ordinal: 0, kind: "copy", phase: "planned", sourcePath: `backup:${uuid}`, targetPath: "/fixture/saves/Toy.srm", sourceDeviceId: 0, targetDeviceId: 1, sourceFingerprint: { sha256: "a".repeat(64), size: 8 }, outputFingerprint: { sha256: "a".repeat(64), size: 8 } }] };
const sse = (events: unknown[]) => new Response(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""), { headers: { "Content-Type": "text/event-stream" } });
function metadata(url: string): Response | null {
  if (url.endsWith("/profile")) return Response.json({ profile: { saveRoots: [{ path: "/fixture/saves" }] } });
  if (url === "/api/devices") return Response.json({ devices: [{ id: 1, name: "Current fixture" }, { id: 2, name: "Master fixture" }] });
  if (url.startsWith("/api/games?")) return Response.json({ games: [{ id: 7, title: "Own game", platformLabel: "SNES" }] });
  if (url.startsWith("/api/saves/versions?")) return Response.json({ versions: [version], total: 1, nextOffset: null });
  return null;
}
const inventory = () => Response.json({ files: [{ path: version.sourcePath, fileKey: version.fileKey, size: "8" }], complete: true });

describe("explicit saves UI with versions, journal restore and conflict sync", () => {
  it("mount only reads stored metadata; explicit backup streams progress and restore requires separate journal Apply", async () => {
    const calls: { url: string; options?: RequestInit }[] = [];
    vi.stubGlobal("fetch", async (url: string, options?: RequestInit) => {
      calls.push({ url, options }); const result = metadata(url); if (result) return result;
      if (url === "/api/devices/1/saves") return options?.method === "POST" ? sse([{ type: "start" }, { type: "progress", bytes: 8, total: 8 }, { type: "done", version }]) : inventory();
      if (url.endsWith("/restore")) return Response.json({ plan, targetBackupVersionId: other });
      if (url.endsWith("/apply")) return Response.json({ plan: { ...plan, status: "applied" } });
      throw new Error("Unexpected fixture request");
    });
    render(React.createElement(DeviceSaves, { deviceId: 1 }));
    fireEvent.click(await screen.findByRole("button", { name: "Save-Inventar lesen" }));
    expect(await screen.findByText("Save-Inventar vollständig gelesen.")).toBeTruthy();
    expect(calls.filter((call) => call.url === "/api/devices/1/saves")).toHaveLength(1);
    fireEvent.change(screen.getByLabelText("Tatsächliche Save-Datei"), { target: { value: version.sourcePath } });
    fireEvent.change(screen.getByLabelText("Spielzuordnung"), { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: "Save-Version sichern" }));
    expect(await screen.findByText("Verifizierte Save-Version gespeichert.")).toBeTruthy();
    expect(screen.getByText("8/8 Bytes gesichert.")).toBeTruthy();
    const body = JSON.parse(calls.find((call) => call.url === "/api/devices/1/saves" && call.options?.method === "POST")!.options!.body as string);
    expect(body).toEqual({ filePath: version.sourcePath, gameId: 7 });
    fireEvent.click(screen.getByRole("button", { name: "Restore-Dateiplan vorbereiten" }));
    expect(await screen.findByText("Dateiplan prüfen")).toBeTruthy();
    expect(calls.some((call) => call.url.endsWith("/apply"))).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Plan ausführen" }));
    expect(await screen.findByRole("button", { name: "Rückgängig machen" })).toBeTruthy();
  });
  it("premature backup EOF retains known versions and does not claim a new saved version", async () => {
    vi.stubGlobal("fetch", async (url: string, options?: RequestInit) => metadata(url) ?? (options?.method === "POST" ? sse([{ type: "progress", bytes: 3, total: 8 }]) : inventory()));
    render(React.createElement(DeviceSaves, { deviceId: 1 }));
    fireEvent.click(await screen.findByRole("button", { name: "Save-Inventar lesen" }));
    await screen.findByText("Save-Inventar vollständig gelesen.");
    fireEvent.change(screen.getByLabelText("Tatsächliche Save-Datei"), { target: { value: version.sourcePath } });
    fireEvent.click(screen.getByRole("button", { name: "Save-Version sichern" }));
    expect(await screen.findByText("Save-Sicherung wurde vor erfolgreichem Abschluss unterbrochen.")).toBeTruthy();
    expect(screen.queryByText("Verifizierte Save-Version gespeichert.")).toBeNull();
    expect(screen.getByText("3/8 Bytes gesichert.")).toBeTruthy();
  });
  it("explicit backup cancellation aborts its request while retaining stored history", async () => {
    let signal: AbortSignal | undefined;
    vi.stubGlobal("fetch", async (url: string, options?: RequestInit) => {
      const result = metadata(url); if (result) return result;
      if (options?.method !== "POST") return inventory();
      signal = options.signal as AbortSignal;
      return new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('data: {"type":"start"}\n\n')); signal!.addEventListener("abort", () => controller.error(new DOMException("Aborted", "AbortError")), { once: true }); } }), { headers: { "Content-Type": "text/event-stream" } });
    });
    render(React.createElement(DeviceSaves, { deviceId: 1 }));
    fireEvent.click(await screen.findByRole("button", { name: "Save-Inventar lesen" })); await screen.findByText("Save-Inventar vollständig gelesen.");
    fireEvent.change(screen.getByLabelText("Tatsächliche Save-Datei"), { target: { value: version.sourcePath } }); fireEvent.click(screen.getByRole("button", { name: "Save-Version sichern" }));
    fireEvent.click(await screen.findByRole("button", { name: "Save-Auftrag abbrechen" }));
    expect(await screen.findByText("Save-Auftrag abgebrochen. Gespeicherte Versionen und Dateiplanstatus prüfen.")).toBeTruthy(); expect(signal?.aborted).toBe(true);
    expect((screen.getByLabelText("Gesicherte Version") as HTMLSelectElement).options).toHaveLength(2);
  });
  it("loads all retained versions and paginates without reopening any device", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      calls.push(url);
      if (url === "/api/saves/versions?offset=0&take=20") return Response.json({ versions: [{ ...version, id: other, deviceName: "Removed fixture device" }], total: 21, nextOffset: 20 });
      if (url === "/api/saves/versions?offset=20&take=20") return Response.json({ versions: [version], total: 21, nextOffset: null });
      return metadata(url) ?? Response.json({ error: "unexpected" }, { status: 500 });
    });
    render(React.createElement(DeviceSaves, { deviceId: 1 }));
    fireEvent.click(await screen.findByRole("button", { name: "Alle erhaltenen Versionen laden" }));
    fireEvent.click(await screen.findByRole("button", { name: "Weitere Save-Versionen laden" }));
    expect(await screen.findByText(/Removed fixture device/)).toBeTruthy();
    expect(calls).toContain("/api/saves/versions?offset=20&take=20"); expect(calls.some((url) => url === "/api/devices/1/saves")).toBe(false);
  });
  it("requires per-file conflict resolution and a new preview before Save-Sync Apply", async () => {
    let previews = 0; const calls: { url: string; options?: RequestInit }[] = [];
    const syncPlan = (status: string) => ({ id: uuid, deviceId: 1, status, plans: [other], conflicts: status === "conflict" ? [{ fileKey: version.fileKey }] : [], summary: { progress: 0, nextKey: null, afterKey: "", rows: [{ fileKey: version.fileKey, action: status === "conflict" ? "conflict" : "copy-master", master: { sha256: "a" }, device: { sha256: "b" }, reason: "Both fixture sides changed" }] } });
    vi.stubGlobal("fetch", async (url: string, options?: RequestInit) => {
      calls.push({ url, options }); const result = metadata(url); if (result) return result;
      const body = JSON.parse(options?.body as string);
      if (body.action === "preview") return Response.json(syncPlan(++previews === 1 ? "conflict" : "ready"));
      if (body.action === "apply") return Response.json(syncPlan("applied"));
      throw new Error("Unexpected fixture request");
    });
    render(React.createElement(DeviceSaves, { deviceId: 1 }));
    fireEvent.change(await screen.findByLabelText("Save-Mastergerät"), { target: { value: "2" } }); fireEvent.click(screen.getByRole("button", { name: "Save-Sync-Vorschau erstellen" }));
    fireEvent.change(await screen.findByLabelText(`Save-Konflikt ${version.fileKey}`), { target: { value: "master" } });
    expect((screen.getByRole("button", { name: "Gespeicherten Save-Sync anwenden oder fortsetzen" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Save-Sync-Vorschau erstellen" }));
    expect(await screen.findByText("Save-Sync-Vorschau gespeichert; vorhandene Ziele sind zuvor versioniert gesichert.")).toBeTruthy();
    const resolved = calls.filter((call) => call.url.endsWith("/saves/sync"))[1]; expect(JSON.parse(resolved.options!.body as string).resolutions).toEqual({ [version.fileKey]: "master" });
    fireEvent.click(screen.getByRole("button", { name: "Gespeicherten Save-Sync anwenden oder fortsetzen" }));
    expect(await screen.findByText("Save-Sync und verifizierte Baseline gespeichert.")).toBeTruthy();
  });
});
