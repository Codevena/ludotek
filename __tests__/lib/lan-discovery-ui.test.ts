// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LanDiscovery } from "@/components/lan-discovery";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const choices = [{ id: "a".repeat(64), name: "fixture", address: "192.168.45.2", subnet: "192.168.45.2/29", family: "IPv4", available: true, hostCount: 5 },
  { id: "b".repeat(64), name: "fixture-v6", address: "fd12::2", subnet: "fd12::2/64", family: "IPv6", available: false, hostCount: 0, reason: "IPv6-Subnetz ist zu groß." }];
const result = { host: "192.168.45.4", port: 22, protocol: "ssh", type: "custom", hint: "Modell bitte selbst prüfen." };
const sse = (events: unknown[]) => new Response(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""), { headers: { "Content-Type": "text/event-stream" } });

describe("LAN UI explicit start and selection", () => {
  it("loads choices without starting a scan, shows unsupported IPv6 and only starts after selection", async () => {
    const fetch = vi.fn(async (_url: string, options?: RequestInit) => options?.method === "POST"
      ? sse([{ type: "start", total: 10 }, { type: "result", result }, { type: "progress", completed: 10, total: 10 }, { type: "done", completed: 10, total: 10, results: [result], stopped: false }])
      : Response.json({ interfaces: choices }));
    vi.stubGlobal("fetch", fetch);
    const onSelect = vi.fn();
    render(React.createElement(LanDiscovery, { onSelect }));
    expect(await screen.findByText("IPv6-Subnetz ist zu groß.")).toBeTruthy();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect((screen.getByRole("button", { name: "LAN-Suche starten" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Privates lokales Subnetz"), { target: { value: choices[0].id } });
    fireEvent.click(screen.getByRole("button", { name: "LAN-Suche starten" }));
    expect(await screen.findByText("Suche abgeschlossen: 10/10 Verbindungen geprüft.")).toBeTruthy();
    expect(fetch.mock.calls[1][1]).toMatchObject({ method: "POST", body: JSON.stringify({ interfaceId: choices[0].id }) });
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "192.168.45.4 als Gerät vorbereiten" }));
    expect(onSelect).toHaveBeenCalledWith({ host: "192.168.45.4", port: 22, protocol: "ssh", type: "custom" });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("reports admission failure and never fabricates an empty successful discovery", async () => {
    vi.stubGlobal("fetch", async (_url: string, options?: RequestInit) => options?.method === "POST" ? Response.json({ error: "Job already running" }, { status: 409 }) : Response.json({ interfaces: choices }));
    render(React.createElement(LanDiscovery, { onSelect: vi.fn() }));
    await screen.findByText("IPv6-Subnetz ist zu groß.");
    fireEvent.change(screen.getByLabelText("Privates lokales Subnetz"), { target: { value: choices[0].id } });
    fireEvent.click(screen.getByRole("button", { name: "LAN-Suche starten" }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Job already running");
    expect(screen.queryByText(/Suche abgeschlossen/)).toBeNull();
  });

  it("preserves partial results and actual progress after stopped or premature EOF", async () => {
    vi.stubGlobal("fetch", async (_url: string, options?: RequestInit) => options?.method === "POST"
      ? sse([{ type: "start", total: 10 }, { type: "result", result }, { type: "progress", completed: 2, total: 10 }])
      : Response.json({ interfaces: choices }));
    render(React.createElement(LanDiscovery, { onSelect: vi.fn() }));
    await screen.findByText("IPv6-Subnetz ist zu groß.");
    fireEvent.change(screen.getByLabelText("Privates lokales Subnetz"), { target: { value: choices[0].id } });
    fireEvent.click(screen.getByRole("button", { name: "LAN-Suche starten" }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Die Suche wurde vor Abschluss unterbrochen.");
    expect(screen.getByText("2/10 Verbindungen geprüft.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "192.168.45.4 als Gerät vorbereiten" })).toBeTruthy();
  });

  it("cancel aborts the request and drains the stream instead of starting another scan", async () => {
    let signal: AbortSignal | undefined;
    const cancelled = vi.fn();
    const fetch = vi.fn(async (_url: string, options?: RequestInit) => {
      if (options?.method !== "POST") return Response.json({ interfaces: choices });
      signal = options.signal!;
      return new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: {"type":"start","total":10}\n\n'));
          signal?.addEventListener("abort", () => controller.error(new DOMException("Aborted", "AbortError")), { once: true });
        }, cancel: cancelled,
      }), { headers: { "Content-Type": "text/event-stream" } });
    });
    vi.stubGlobal("fetch", fetch);
    render(React.createElement(LanDiscovery, { onSelect: vi.fn() }));
    await screen.findByText("IPv6-Subnetz ist zu groß.");
    fireEvent.change(screen.getByLabelText("Privates lokales Subnetz"), { target: { value: choices[0].id } });
    fireEvent.click(screen.getByRole("button", { name: "LAN-Suche starten" }));
    fireEvent.click(await screen.findByRole("button", { name: "Suche abbrechen" }));
    await waitFor(() => expect(signal?.aborted).toBe(true));
    expect(await screen.findByText("Suche abgebrochen.")).toBeTruthy();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect((screen.getByRole("button", { name: "LAN-Suche starten" }) as HTMLButtonElement).disabled).toBe(false);
  });
});
