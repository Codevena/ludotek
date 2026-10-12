// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SavedVersions } from "@/components/saved-versions";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const id = "12345678-1234-4234-9234-123456789abc";
const version = { id, deviceId: 77, gameId: 88, deviceName: "Removed fixture device", gameTitle: "Removed fixture game", sourcePath: "/old/fixture/Toy.srm", fileKey: "snes|Toy.srm", sha256: "a".repeat(64), size: "8", createdAt: new Date(0).toISOString() };
describe("save history survives every device and game", () => {
  it("browses retained metadata with zero devices and never invents an id0 inventory/profile/restore call", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => { calls.push(url); if (url === "/api/devices") return Response.json({ devices: [] }); return Response.json({ versions: [version], total: 1, nextOffset: null }); });
    render(React.createElement(SavedVersions));
    expect(await screen.findByText("Removed fixture game")).toBeTruthy(); expect(screen.getByText(/Removed fixture device/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ein Gerät zum Restore hinzufügen" })).toHaveProperty("href", "http://localhost:3000/admin");
    expect(calls).toEqual(["/api/saves/versions?offset=0&take=20", "/api/devices"]);
    fireEvent.click(screen.getByRole("button", { name: `Version ${id} zum Restore auswählen` })); expect(calls).toHaveLength(2);
    expect(screen.queryByLabelText("Vorhandenes Restore-Zielgerät")).toBeNull();
  });
  it("only loads an actual chosen target profile and then prepares the protected version's separate restore plan", async () => {
    const calls: { url: string; options?: RequestInit }[] = [];
    vi.stubGlobal("fetch", async (url: string, options?: RequestInit) => {
      calls.push({ url, options });
      if (url === "/api/devices") return Response.json({ devices: [{ id: 5, name: "New target fixture" }] });
      if (url.endsWith("/profile")) return Response.json({ profile: { saveRoots: [{ path: "/new/fixture/saves" }] } });
      if (url.endsWith("/restore")) return Response.json({ plan: { id, kind: "save_restore", status: "ready", totalBytes: "8", operations: [] }, targetBackupVersionId: null });
      return Response.json({ versions: [version], total: 1, nextOffset: null });
    });
    render(React.createElement(SavedVersions)); await screen.findByText("Removed fixture game");
    expect(calls).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: `Version ${id} zum Restore auswählen` }));
    fireEvent.change(screen.getByLabelText("Vorhandenes Restore-Zielgerät"), { target: { value: "5" } });
    expect(await screen.findByText("Deklarierte Save-Wurzeln: /new/fixture/saves")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Restore-Zielpfad"), { target: { value: "/new/fixture/saves/Toy.srm" } });
    fireEvent.click(screen.getByRole("button", { name: "Restore aus erhaltener Version vorbereiten" }));
    expect(await screen.findByText("Dateiplan prüfen")).toBeTruthy();
    const restore = calls.find((call) => call.url.endsWith("/restore"))!; expect(JSON.parse(restore.options!.body as string)).toEqual({ targetDeviceId: 5, targetPath: "/new/fixture/saves/Toy.srm" });
    expect(calls.some((call) => call.url.endsWith("/apply"))).toBe(false);
  });
});
