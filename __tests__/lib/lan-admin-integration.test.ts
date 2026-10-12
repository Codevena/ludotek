// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import AdminPage from "@/app/(main)/admin/page";

vi.mock("@/context/enrichment-context", () => ({ useEnrichment: () => ({ startEnrichment: vi.fn(), isRunning: false }) }));
vi.mock("@/context/scan-context", () => ({ useScan: () => ({ startScan: vi.fn(), scanning: false }) }));
vi.mock("@/components/cache-manager", () => ({ CacheManager: () => null }));
// Core/API/LAN-component tests exercise scanning. Here the result-to-real-form
// boundary must require an explicit save, with no credential carry-over.
vi.mock("@/components/lan-discovery", () => ({ LanDiscovery: ({ onSelect }: { onSelect(value: unknown): void }) => React.createElement("button", {
  onClick: () => onSelect({ host: "192.168.45.4", protocol: "ftp", port: 21, type: "custom" }),
}, "Prepare fixture device") }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("prefills the existing real device form and only creates the device after explicit saving", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    if (url === "/api/auth") return Response.json({ configured: true, authRequired: true, authenticated: true });
    if (url === "/api/devices") return Response.json({ devices: [], gameDeviceCount: 0 });
    if (url === "/api/platforms") return Response.json({ platforms: [] });
    return Response.json({});
  });
  render(React.createElement(AdminPage));
  fireEvent.click(await screen.findByRole("button", { name: "Prepare fixture device" }));
  expect(screen.getByDisplayValue("192.168.45.4")).toBeTruthy();
  expect(screen.getByDisplayValue("21")).toBeTruthy();
  expect(screen.queryByDisplayValue("deck")).toBeNull();
  expect(calls.filter((call) => call.init?.method === "POST")).toHaveLength(0);
  fireEvent.change(screen.getByPlaceholderText("username"), { target: { value: "fixture-user" } });
  // Form submit deliberately uses the explicit Save action without making a
  // test-connection request; the fixture API never contacts a device.
  const save = screen.getByRole("button", { name: "Add Device" });
  fireEvent.submit(save.closest("form")!);
  await waitFor(() => expect(calls.filter((call) => call.init?.method === "POST")).toHaveLength(1));
  const creation = calls.find((call) => call.init?.method === "POST")!;
  expect(creation.url).toBe("/api/devices");
  expect(JSON.parse(creation.init!.body as string)).toMatchObject({ host: "192.168.45.4", protocol: "ftp", port: 21, type: "custom", password: "", user: "fixture-user", ftps: false });
  expect(calls.some((call) => call.url.includes("test-connection"))).toBe(false);
});
