// @vitest-environment jsdom
import React from "react";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
const navigation = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: navigation.refresh }) }));
import { GameFiles } from "@/components/game-files";
import { SyncPanel } from "@/components/sync-panel";

const planId = "12345678-1234-4234-8234-123456789abc";
const plan = { id: planId, kind: "rename", status: "ready", totalBytes: "7", revision: 0, error: null, createdAt: "2026-10-12T00:00:00Z", appliedAt: null,
  operations: [{ id: "own-operation", ordinal: 0, kind: "move", phase: "planned", error: null, deviceId: 1, filePath: "/own/One.nes", sourceDeviceId: 1, sourcePath: "/own/One.nes", targetDeviceId: 1, newPath: "/own/Two.nes", targetPath: "/own/Two.nes", bytes: 7, generated: false, rewritesDescriptor: false, sourceFingerprint: { sha256: "a".repeat(64), size: 7 } }] };
const row = { id: 7, type: "rename", deviceId: 1, gameId: 1, filePath: "/own/One.nes", newPath: "/own/Two.nes", status: "pending", error: null,
  planId, plan, canApply: true, canRemove: true, device: { id: 1, name: "Own fixture" }, game: { id: 1, title: "One", platform: "nes" } };
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe("game file staging", () => {
  it("keeps an unconfirmed legacy association visible and surfaces server refusal without a staged marker", async () => {
    vi.stubGlobal("fetch", async () => Response.json({ error: "Association unconfirmed; rescan" }, { status: 409 }));
    render(React.createElement(GameFiles, { gameId: 1, unconfirmedDeviceCount: 1, files: [{ deviceId: 1, deviceName: "Own fixture", filePath: "/own/One.nes", fileName: "One.nes" }] }));
    expect(screen.getByText(/ohne bestätigten Dateipfad/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(await screen.findByRole("button", { name: "Stage Delete" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Association unconfirmed");
    expect(screen.queryByText("Staged for deletion")).toBeNull();
  });
  it("only confirms a persisted 201 preview and exposes its actual journal link", async () => {
    vi.stubGlobal("fetch", async () => Response.json({ item: { id: 7, planId }, plan: { ...plan, kind: "delete" } }, { status: 201 }));
    render(React.createElement(GameFiles, { gameId: 1, files: [{ deviceId: 1, deviceName: "Own fixture", filePath: "/own/One.nes", fileName: "One.nes" }] }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" })); fireEvent.click(await screen.findByRole("button", { name: "Stage Delete" }));
    expect(await screen.findByText("Staged for deletion")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Gespeicherte Vorschau/ })).toHaveAttribute("href", `/files?plan=${planId}`);
  });
  it("rejects a misleading 200 response rather than marking a deletion staged", async () => {
    vi.stubGlobal("fetch", async () => Response.json({ item: { id: 7, planId }, plan }));
    render(React.createElement(GameFiles, { gameId: 1, files: [{ deviceId: 1, deviceName: "Own fixture", filePath: "/own/One.nes", fileName: "One.nes" }] }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" })); fireEvent.click(await screen.findByRole("button", { name: "Stage Delete" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("nicht gespeichert");
    expect(screen.queryByText("Staged for deletion")).toBeNull();
  });
});

describe("journal-backed sync panel", () => {
  it("shows a concrete stored preview and sends only displayed eligible queue IDs", async () => {
    const calls: { url: string; body?: string }[] = [];
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      calls.push({ url, body: init?.body as string | undefined });
      if (url === "/api/sync/apply") return Response.json({ applied: 1, failed: 0, ignored: 0, results: [{ id: 7, status: "applied", plan: { ...plan, status: "applied" }, planId }] });
      return Response.json({ count: 2, items: [row, { ...row, id: 8, status: "in_progress", canApply: false, canRemove: false }], nextCursor: null });
    });
    render(React.createElement(SyncPanel));
    fireEvent.click(screen.getByRole("button", { name: /Sync/ }));
    fireEvent.click((await screen.findAllByRole("button", { name: "Vorschau und Ergebnis prüfen" }))[0]);
    expect(await screen.findByRole("heading", { name: "Dateiplan prüfen" })).toBeTruthy();
    expect(screen.getByText(/7 Bytes/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "1 angezeigte Pläne bestätigen" }));
    await waitFor(() => expect(calls.find((call) => call.url === "/api/sync/apply")?.body).toBe('{"ids":[7]}'));
    expect(await screen.findByText("1 bestätigt abgeschlossen")).toBeTruthy();
    expect(await screen.findByRole("button", { name: "Rückgängig machen" })).toBeTruthy();
  });
  it("uses the shared journal UI for real undo and exposes recovery after a failed action", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      calls.push(url);
      if (url.endsWith("/undo") && init?.method === "POST") return Response.json({ plan: { ...plan, status: "undone" } });
      if (url.includes("/api/file-plans/")) return Response.json({ plan: { ...plan, status: "applied" } });
      return Response.json({ count: 1, items: [{ ...row, status: "metadata_failed", plan: { ...plan, status: "applied" } }], nextCursor: null });
    });
    render(React.createElement(SyncPanel)); fireEvent.click(screen.getByRole("button", { name: /Sync/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Vorschau und Ergebnis prüfen" }));
    fireEvent.click(await screen.findByRole("button", { name: "Rückgängig machen" }));
    expect(await screen.findByText("Zurückgenommen")).toBeTruthy();
    expect(calls).toContain(`/api/file-plans/${planId}/undo`);
    expect(navigation.refresh).toHaveBeenCalled();
  });
  it("surfaces apply errors without reporting completed changes", async () => {
    vi.stubGlobal("fetch", async (url: string) => url === "/api/sync/apply" ? Response.json({ error: "Device job already running" }, { status: 409 }) : Response.json({ count: 1, items: [row] }));
    render(React.createElement(SyncPanel)); fireEvent.click(screen.getByRole("button", { name: /Sync/ }));
    fireEvent.click(await screen.findByRole("button", { name: "1 angezeigte Pläne bestätigen" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Device job already running");
    expect(screen.queryByText(/bestätigt abgeschlossen/)).toBeNull();
  });
});
