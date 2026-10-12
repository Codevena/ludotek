// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DeviceProfileSync } from "@/components/device-profile-sync";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const profile = { profile: { template: "custom", romRoots: [{ path: "/fixture/roms" }], saveRoots: [], formats: [".sfc"], reserveBytes: "0" }, templates: [{ id: "custom", label: "Eigene Vorlage", romHint: "Fixture root", saveHint: "Fixture save", formats: [], source: null }] };
const fixturePlan = (status = "conflict") => ({ id: "fixture-sync", status, conflicts: status === "conflict" ? [{ fileKey: "snes|Toy.sfc", reason: "Beide Seiten geändert." }] : [], plans: ["fixture-common"], summary: {
  bytes: "3", total: 101, nextKey: "snes|Toy.sfc", afterKey: "", rows: [{ fileKey: "snes|Toy.sfc", masterPath: "/fixture/master/snes/Toy.sfc", devicePath: "/fixture/device/snes/Toy.sfc", action: status === "conflict" ? "conflict" : "copy-master", reason: "Beide Seiten geändert.", master: { sha256: "a", size: "3" }, device: { sha256: "b", size: "3" } }] } });

describe("device profile and explicit conflict resolution UI", () => {
  it("loads configuration, saves explicit roots/formats/reserve and never starts sync on mount", async () => {
    const fetch = vi.fn(async (url: string, options?: RequestInit) => url === "/api/devices" ? Response.json({ devices: [{ id: 1, name: "Master fixture" }, { id: 2, name: "Device fixture" }] }) : options?.method === "PUT" ? Response.json({ saved: true }) : Response.json(profile));
    vi.stubGlobal("fetch", fetch);
    render(React.createElement(DeviceProfileSync, { deviceId: 2 }));
    const roots = await screen.findByLabelText("ROM-Wurzeln"); expect((roots as HTMLTextAreaElement).value).toBe("/fixture/roms");
    expect(fetch).toHaveBeenCalledTimes(2);
    fireEvent.change(screen.getByLabelText("Freie Speicherreserve (MiB)"), { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: "Profil speichern" }));
    expect(await screen.findByText("Geräteprofil gespeichert.")).toBeTruthy();
    expect(JSON.parse(fetch.mock.calls[2][1]!.body as string)).toMatchObject({ reserveBytes: "4194304", romRoots: [{ path: "/fixture/roms" }], formats: [".sfc"] });
    expect(fetch.mock.calls.every(([url]) => !url.startsWith("/api/device-sync"))).toBe(true);
  });
  it("renders per-file conflict, requires new resolved preview before apply and clears previous-page resolutions", async () => {
    let previews = 0;
    const calls: { url: string; options?: RequestInit }[] = [];
    vi.stubGlobal("fetch", async (url: string, options?: RequestInit) => {
      calls.push({ url, options });
      if (url === "/api/devices") return Response.json({ devices: [{ id: 1, name: "Master fixture" }, { id: 2, name: "Device fixture" }] });
      if (url.includes("/profile")) return Response.json(profile);
      if (url === "/api/device-sync") return Response.json(fixturePlan(++previews === 1 ? "conflict" : "ready"));
      if (url.endsWith("/apply")) return Response.json(fixturePlan("applied"));
      throw new Error("Unexpected fixture request");
    });
    render(React.createElement(DeviceProfileSync, { deviceId: 2 }));
    fireEvent.change(await screen.findByLabelText("Mastergerät"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Synchronisierungsrichtung"), { target: { value: "two-way" } });
    fireEvent.click(screen.getByRole("button", { name: "Sync-Vorschau erstellen" }));
    fireEvent.change(await screen.findByLabelText("Konfliktauflösung snes|Toy.sfc"), { target: { value: "master" } });
    expect((screen.getByRole("button", { name: "Geprüften Sync-Plan anwenden" }) as HTMLButtonElement).disabled).toBe(true);
    expect(calls.some((call) => call.url.endsWith("/apply"))).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Sync-Vorschau erstellen" }));
    expect(await screen.findByText("Vorschau gespeichert. Dateien wurden noch nicht verändert.")).toBeTruthy();
    expect(JSON.parse(calls.filter((call) => call.url === "/api/device-sync")[1].options!.body as string)).toMatchObject({ resolutions: { "snes|Toy.sfc": "master" } });
    fireEvent.click(screen.getByRole("button", { name: "Geprüften Sync-Plan anwenden" }));
    expect(await screen.findByText("Synchronisierung und verifizierte Baseline gespeichert.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Nächste Dateiseite vorbereiten" }));
    expect(await screen.findByText("Vorschau gespeichert. Dateien wurden noch nicht verändert.")).toBeTruthy();
    const next = calls.filter((call) => call.url === "/api/device-sync")[2];
    expect(JSON.parse(next.options!.body as string)).toMatchObject({ afterKey: "snes|Toy.sfc", resolutions: {} });
  });
  it("shows failed apply's persisted recovery state without claiming a baseline was saved", async () => {
    vi.stubGlobal("fetch", async (url: string) => {
      if (url === "/api/devices") return Response.json({ devices: [{ id: 1, name: "Master fixture" }] });
      if (url.includes("/profile")) return Response.json(profile);
      if (url === "/api/device-sync") return Response.json(fixturePlan("ready"));
      if (url.endsWith("/apply")) return Response.json({ error: "Current file differs" }, { status: 409 });
      if (url.includes("/api/device-sync/")) return Response.json(fixturePlan("recovery"));
      throw new Error("Unexpected fixture request");
    });
    render(React.createElement(DeviceProfileSync, { deviceId: 2 }));
    fireEvent.change(await screen.findByLabelText("Mastergerät"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Sync-Vorschau erstellen" }));
    fireEvent.click(await screen.findByRole("button", { name: "Geprüften Sync-Plan anwenden" }));
    expect(await screen.findByText("Current file differs")).toBeTruthy();
    expect(screen.getByText(/Plan: recovery/)).toBeTruthy();
    expect(screen.queryByText("Synchronisierung und verifizierte Baseline gespeichert.")).toBeNull();
    expect(screen.getByRole("link", { name: /Gemeinsamen Dateiplan/ })).toHaveProperty("href", "http://localhost:3000/files?planId=fixture-common");
  });
});
