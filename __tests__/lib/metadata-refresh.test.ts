// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextRequest } from "next/server";

const dependencies = vi.hoisted(() => ({
  game: {} as Record<string, unknown>,
  settings: {} as Record<string, unknown>,
  findUnique: vi.fn(),
  update: vi.fn(),
  fetchIgdbById: vi.fn(),
  searchIgdb: vi.fn(),
  generateAi: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAuth: () => null }));
vi.mock("@/lib/prisma", () => ({
  prisma: { game: { findUnique: dependencies.findUnique, update: dependencies.update } },
}));
vi.mock("@/lib/encryption", () => ({ getDecryptedSettings: async () => dependencies.settings }));
vi.mock("@/lib/igdb", () => ({ fetchIgdbById: dependencies.fetchIgdbById, searchIgdb: dependencies.searchIgdb }));
vi.mock("@/lib/steamgriddb", () => ({ searchSteamGridDb: vi.fn() }));
vi.mock("@/lib/openrouter", () => ({ generateGameAiContent: dependencies.generateAi }));
vi.mock("@/lib/image-cache", () => ({ cacheGameImages: vi.fn() }));

import { POST } from "@/app/api/games/[id]/enrich/route";
import { RefreshMetadataButton } from "@/components/refresh-metadata-button";

const metadata = {
  igdbId: 42,
  coverUrl: "https://example.test/cover.jpg",
  igdbScore: 80,
  metacriticScore: 81,
  genres: ["Adventure"],
  developer: "Developer",
  publisher: "Publisher",
  releaseDate: new Date("2001-01-01T00:00:00Z"),
  summary: "Fresh summary",
  screenshotUrls: [],
  videoIds: [],
  artworkUrls: [],
  franchise: null,
  themes: [],
};

function enrich(body: unknown = {}, force = false, id = "1") {
  const request = new NextRequest(`http://localhost/api/games/${id}/enrich${force ? "?force=true" : ""}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return POST(request, { params: Promise.resolve({ id }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  dependencies.game = {
    id: 1,
    title: "Game",
    platform: "psx",
    platformLabel: "PlayStation",
    igdbId: 42,
    developer: "Old developer",
    genres: "[]",
    summary: "Old summary",
    releaseDate: null,
  };
  dependencies.settings = { igdbClientId: "test-id", igdbClientSecret: "test-secret", openrouterKey: "test-ai-key" };
  dependencies.findUnique.mockImplementation(async () => ({ ...dependencies.game }));
  dependencies.update.mockImplementation(async ({ data }) => {
    dependencies.game = { ...dependencies.game, ...data };
    return { ...dependencies.game };
  });
  dependencies.fetchIgdbById.mockResolvedValue(metadata);
  dependencies.searchIgdb.mockResolvedValue(metadata);
  dependencies.generateAi.mockResolvedValue({ funFacts: "New facts", story: "New story" });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("single-game metadata refresh", () => {
  it("forces a fresh lookup of the game's saved IGDB ID", async () => {
    const response = await enrich({}, true);

    expect(response.status).toBe(200);
    expect(dependencies.fetchIgdbById).toHaveBeenCalledWith(42, "test-id", "test-secret", { bypassCache: true });
    expect((await response.json()).game.summary).toBe("Fresh summary");
    expect(dependencies.searchIgdb).not.toHaveBeenCalled();
  });

  it("forces title search when the game has no saved IGDB ID", async () => {
    dependencies.game.igdbId = null;

    const response = await enrich({}, true);

    expect(response.status).toBe(200);
    expect(dependencies.searchIgdb).toHaveBeenCalledWith("Game", "psx", "test-id", "test-secret", { bypassCache: true });
    expect((await response.json()).game.summary).toBe("Fresh summary");
  });

  it("uses the selected ID and force flag instead of the previously saved ID", async () => {
    const response = await enrich({ igdbId: 99, generateAi: false }, true);

    expect(response.status).toBe(200);
    expect(dependencies.fetchIgdbById).toHaveBeenCalledWith(99, "test-id", "test-secret", { bypassCache: true });
  });

  it("keeps ordinary enrichment on the cache path", async () => {
    await enrich({ igdbId: 99 });

    expect(dependencies.fetchIgdbById).toHaveBeenCalledWith(99, "test-id", "test-secret", { bypassCache: false });
  });

  it("reports unavailable credentials without claiming metadata success or mutating the game", async () => {
    dependencies.settings = {};

    const response = await enrich({}, true);

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: expect.any(String) });
    expect(dependencies.update).not.toHaveBeenCalled();
    expect(dependencies.fetchIgdbById).not.toHaveBeenCalled();
  });

  it("reports no metadata match without claiming success or generating requested AI content", async () => {
    dependencies.fetchIgdbById.mockResolvedValue(null);

    const response = await enrich({ generateAi: true }, true);

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: expect.any(String) });
    expect(dependencies.update).not.toHaveBeenCalled();
    expect(dependencies.generateAi).not.toHaveBeenCalled();
  });

  it("reports provider failure without claiming success or changing metadata", async () => {
    dependencies.fetchIgdbById.mockRejectedValue(new Error("Provider failed"));
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const response = await enrich({}, true);

    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ error: expect.any(String) });
    expect(dependencies.update).not.toHaveBeenCalled();
  });

  it("generates AI-only content without requiring or querying IGDB", async () => {
    dependencies.settings = { openrouterKey: "test-ai-key" };

    const response = await enrich({ generateAi: true });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, game: { aiFunFacts: "New facts", aiStory: "New story" } });
    expect(dependencies.generateAi).toHaveBeenCalledTimes(1);
    expect(dependencies.fetchIgdbById).not.toHaveBeenCalled();
    expect(dependencies.searchIgdb).not.toHaveBeenCalled();
  });

  it("keeps AI-only requests independent of an available IGDB provider", async () => {
    const response = await enrich({ generateAi: true });

    expect(response.status).toBe(200);
    expect(dependencies.searchIgdb).not.toHaveBeenCalled();
    expect(dependencies.fetchIgdbById).not.toHaveBeenCalled();
  });

  it("reports missing AI credentials for an AI-only request", async () => {
    dependencies.settings = {};

    const response = await enrich({ generateAi: true });

    expect(response.status).toBe(503);
    expect(dependencies.update).not.toHaveBeenCalled();
  });

  it.each(["1junk", "1.5", "0", "-1", "9007199254740992"])("rejects invalid game ID %s before database or provider work", async (id) => {
    const response = await enrich({}, true, id);

    expect(response.status).toBe(400);
    expect(dependencies.findUnique).not.toHaveBeenCalled();
    expect(dependencies.fetchIgdbById).not.toHaveBeenCalled();
  });

  it.each([0, -1, 1.5, "42", null, Number.MAX_SAFE_INTEGER + 1])("rejects invalid IGDB ID %s before database or provider work", async (igdbId) => {
    const response = await enrich({ igdbId }, true);

    expect(response.status).toBe(400);
    expect(dependencies.findUnique).not.toHaveBeenCalled();
    expect(dependencies.fetchIgdbById).not.toHaveBeenCalled();
  });

  it("reports malformed JSON as a client error", async () => {
    const request = new NextRequest("http://localhost/api/games/1/enrich?force=true", {
      method: "POST", body: "{",
    });

    const response = await POST(request, { params: Promise.resolve({ id: "1" }) });

    expect(response.status).toBe(400);
    expect(dependencies.findUnique).not.toHaveBeenCalled();
  });
});

describe("metadata search result selection", () => {
  it("requests fresh metadata when the user picks an IGDB result", async () => {
    const fetch = vi.fn(async (url: string) => {
      if (url.includes("/search?")) {
        return Response.json({ results: [{ igdbId: 99, name: "Selected Game", rating: null, coverUrl: null, releaseDate: null, summary: null }] });
      }
      return Response.json({ error: "Test stops before reload" }, { status: 404 });
    });
    vi.stubGlobal("fetch", fetch);
    render(createElement(RefreshMetadataButton, { gameId: 1, gameTitle: "Game" }));

    fireEvent.click(screen.getByRole("button", { name: "Refresh Metadata" }));
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    fireEvent.click(await screen.findByRole("button", { name: /Selected Game/ }));

    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/games/1/enrich?force=true", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ igdbId: 99, generateAi: false }),
    }));
    expect(await screen.findByText("Test stops before reload")).toBeTruthy();
  });
});
