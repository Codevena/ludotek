import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const deps = vi.hoisted(() => ({ auth: vi.fn(), settings: vi.fn(), unique: vi.fn(), find: vi.fn(), dispatch: vi.fn(), token: vi.fn(), acquire: vi.fn(), close: vi.fn(), assert: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireAuth: deps.auth }));
vi.mock("@/lib/encryption", () => ({ getDecryptedSettings: deps.settings }));
vi.mock("@/lib/prisma", () => ({ prisma: { game: { findUnique: deps.unique, findMany: deps.find } } }));
vi.mock("@/lib/provider-budget", () => ({ providerFetch: deps.dispatch }));
vi.mock("@/lib/job-admission", async (original) => ({ ...await original<typeof import("@/lib/job-admission")>(), acquireScopedJob: deps.acquire }));
vi.mock("@/lib/igdb", () => ({ IGDB_PLATFORM_MAP: { snes: 19 }, getIgdbToken: deps.token, sanitizeApicalypseString: (value: string) => value.replace(/["\\]/g, ""), searchIgdb: vi.fn() }));

import { GET as search } from "@/app/api/games/[id]/search/route";
import { POST as discover } from "@/app/api/discover/route";

const discoveryRequest = (body: unknown = { platforms: ["snes"], genres: ["Adventure"] }) => new NextRequest("http://localhost:3000/api/discover", { method: "POST", body: JSON.stringify(body) });
const searchRequest = (query = "Toy") => new NextRequest(`http://localhost:3000/api/games/1/search?q=${encodeURIComponent(query)}`);

beforeEach(() => {
  vi.clearAllMocks();
  deps.auth.mockReturnValue(null);
  deps.settings.mockResolvedValue({ igdbClientId: "toy", igdbClientSecret: "toy", openrouterKey: "toy" });
  deps.unique.mockResolvedValue({ id: 1, title: "Toy", platform: "snes" });
  deps.find.mockResolvedValue([{ id: 1, title: "Toy", platform: "snes", platformLabel: "SNES", genres: "[]", themes: "[]", igdbScore: 90 }]);
  deps.token.mockResolvedValue("toy");
  deps.close.mockResolvedValue(undefined);
  deps.assert.mockResolvedValue(undefined);
  deps.acquire.mockResolvedValue({ signal: new AbortController().signal, close: deps.close, assertActive: deps.assert, abort: () => {}, run: (work: () => Promise<unknown>) => work() });
  deps.dispatch.mockImplementation(async (_provider: string, url: string) => url.includes("openrouter") ? Response.json({ choices: [{ message: { content: "[]" } }] }) : Response.json([]));
});

describe("provider route entry guards", () => {
  it.each(["search", "discover"])("rejects unauthorized %s before credentials, DB or dispatch", async (route) => {
    deps.auth.mockReturnValue(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
    const response = route === "search" ? await search(searchRequest(), { params: Promise.resolve({ id: "1" }) }) : await discover(discoveryRequest());
    expect(response.status).toBe(401);
    expect(deps.settings).not.toHaveBeenCalled();
    expect(deps.unique).not.toHaveBeenCalled();
    expect(deps.find).not.toHaveBeenCalled();
    expect(deps.dispatch).not.toHaveBeenCalled();
  });

  it.each(["1junk", "-1", "0", "9007199254740992"])("rejects invalid search ID %s before any work", async (id) => {
    expect((await search(searchRequest(), { params: Promise.resolve({ id }) })).status).toBe(400);
    expect(deps.unique).not.toHaveBeenCalled();
    expect(deps.settings).not.toHaveBeenCalled();
  });

  it("rejects oversized search input before DB or provider work", async () => {
    expect((await search(searchRequest("x".repeat(201)), { params: Promise.resolve({ id: "1" }) })).status).toBe(400);
    expect(deps.unique).not.toHaveBeenCalled();
    expect(deps.dispatch).not.toHaveBeenCalled();
  });

  it("budgets each games and covers dispatch with the request abort signal", async () => {
    deps.dispatch.mockResolvedValueOnce(Response.json([{ id: 1, name: "Toy", cover: 7 }]))
      .mockResolvedValueOnce(Response.json([{ id: 7, image_id: "toy" }]));
    const request = searchRequest();
    const response = await search(request, { params: Promise.resolve({ id: "1" }) });
    expect(response.status).toBe(200);
    expect(deps.dispatch).toHaveBeenCalledTimes(2);
    for (const call of deps.dispatch.mock.calls) {
      expect(call[0]).toBe("igdb");
      expect(call[3].signal).toBe(request.signal);
    }
  });

  it.each([null, [], { platforms: ["unknown"], genres: ["Adventure"] }, { platforms: ["snes"], genres: "Adventure" }, { platforms: ["snes"], genres: ["x".repeat(81)] }])("rejects malformed recommendation filters before admission or credentials: %j", async (body) => {
    expect((await discover(discoveryRequest(body))).status).toBe(400);
    expect(deps.acquire).not.toHaveBeenCalled();
    expect(deps.settings).not.toHaveBeenCalled();
    expect(deps.dispatch).not.toHaveBeenCalled();
  });

  it("uses a scoped job and bounded OpenRouter prompt for recommendations", async () => {
    const response = await discover(discoveryRequest());
    const output = await response.text();
    expect(deps.acquire).toHaveBeenCalledWith("discover", expect.any(Request));
    expect(deps.dispatch).toHaveBeenCalledOnce();
    expect(deps.dispatch.mock.calls[0][0]).toBe("openrouter");
    const body = JSON.parse(deps.dispatch.mock.calls[0][2].body);
    expect(body.max_tokens).toBe(2000);
    expect(body.messages[0].content.length).toBeLessThanOrEqual(64000);
    expect(output).toContain('"type":"done"');
    expect(deps.close).toHaveBeenCalledOnce();
  });
});
