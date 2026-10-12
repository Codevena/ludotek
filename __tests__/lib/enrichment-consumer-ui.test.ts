// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import DiscoverPage from "@/app/(main)/discover/page";
import UploadPage from "@/app/(main)/admin/upload/page";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams("surprise=true&platforms=snes") }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function sse(events: Record<string, unknown>[]) {
  return new Response(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""), { headers: { "Content-Type": "text/event-stream" } });
}

describe("optional metadata and discovery stop consumers", () => {
  it("finishes Discover loading on a budget stop and retains the recommendations already received", async () => {
    vi.stubGlobal("fetch", async (url: string) => {
      if (url === "/api/platforms") return Response.json([]);
      if (url.startsWith("/api/discover/genres")) return Response.json({ genres: [], themes: [] });
      if (url === "/api/discover") return sse([
        { type: "generating", message: "Loading wishlist…" },
        { type: "recommendations", tab: "library", games: [{ title: "Toy recommendation", platform: "snes", platformLabel: "SNES", reason: "Fixture reason", vibeTag: "Adventure", dbId: 1 }] },
        { type: "stopped", stopped: true, message: "Provider long-term budget exhausted" },
      ]);
      throw new Error(`Unexpected request ${url}`);
    });
    render(React.createElement(DiscoverPage));
    expect(await screen.findByText("Provider long-term budget exhausted")).toBeTruthy();
    expect(screen.getByText("Toy recommendation")).toBeTruthy();
    expect(screen.queryByText("Loading wishlist…")).toBeNull();
    expect(screen.getByRole("button", { name: "Neue Empfehlungen generieren" })).toBeTruthy();
  });

  it.each(["enrich-skipped", "enrich-error"])("shows %s on the actual upload page while retaining transfer success", async (eventType) => {
    vi.stubGlobal("fetch", async (url: string) => {
      if (url === "/api/auth") return Response.json({ authRequired: false, configured: true, authenticated: true, mode: "local" });
      if (url === "/api/upload") return Response.json({ sessionId: "fixture-session" });
      if (url === "/api/upload/detect") return Response.json({ games: [{ id: "toy-game", title: "Toy upload", type: "single", discCount: 1, files: [{ name: "Toy.sfc", size: 3, path: "/fixture/Toy.sfc" }], conversion: "none", totalSize: 3 }] });
      if (url === "/api/upload/process") return sse([
        { type: "start", totalGames: 1 },
        { type: "game-start", gameId: "toy-game", step: "transfer" },
        { type: "game-step", gameId: "toy-game", step: "enrich" },
        { type: eventType, gameId: "toy-game", reason: "Admission store unavailable" },
        { type: "game-done", gameId: "toy-game", dbId: 1, coverUrl: null },
        { type: "done", succeeded: 1, failed: 0 },
      ]);
      throw new Error(`Unexpected request ${url}`);
    });
    const { container } = render(React.createElement(UploadPage));
    fireEvent.click(await screen.findByText(/Manual mode — select platform first/));
    fireEvent.click(screen.getByRole("button", { name: /Super Nintendo/ }));
    const input = container.querySelector('input[type="file"]')!;
    fireEvent.change(input, { target: { files: [new File(["toy"], "Toy.sfc")] } });
    fireEvent.click(await screen.findByRole("button", { name: /Upload to Steam Deck/ }));
    expect(await screen.findByText(/Admission store unavailable/)).toBeTruthy();
    expect(screen.getByText("1 succeeded")).toBeTruthy();
    expect(screen.queryByText("1 failed")).toBeNull();
    await waitFor(() => expect(screen.getByRole("img", { name: "Metadata warning" })).toBeTruthy());
  });
});
