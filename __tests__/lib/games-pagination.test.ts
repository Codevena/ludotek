import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const database = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[] }));
vi.mock("@/lib/prisma", () => {
  const client = {
    game: {
      findMany: vi.fn(async (query: {
        where?: { id?: { in: number[] }; devices?: { some: { deviceId: number } } };
        select?: Record<string, boolean>;
        skip?: number;
        take?: number;
      }) => {
        let rows = database.rows.filter((row) =>
          !query.where?.id || query.where.id.in.includes(row.id as number),
        );
        if (query.where?.devices) {
          const deviceId = query.where.devices.some.deviceId;
          rows = rows.filter((row) => (row.devices as { device: { id: number } }[]).some((association) => association.device.id === deviceId));
        }
        rows = rows.slice(query.skip ?? 0, query.take === undefined ? undefined : (query.skip ?? 0) + query.take);
        return rows.map((row) => query.select
          ? Object.fromEntries(Object.keys(query.select).filter((key) => query.select![key]).map((key) => [key, row[key]]))
          : structuredClone(row));
      }),
      count: vi.fn(async () => database.rows.length),
    },
  };
  return { prisma: { ...client, $transaction: async (callback: (transaction: typeof client) => Promise<unknown>) => callback(client) } };
});

import { GET } from "@/app/api/games/route";

function game(id: number, title: string, igdbId: number | null, deviceId = id, platform = "psx") {
  return {
    id, title, igdbId, platform, platformLabel: "PlayStation", originalFile: `${title}-${id}.chd`,
    source: "rom", coverUrl: null, localCoverPath: null,
    devices: [{ device: { id: deviceId, name: `Device ${deviceId}`, type: "custom" } }],
  };
}

async function page(number: number, extra = "") {
  const response = await GET(new NextRequest(`http://localhost/api/games?page=${number}&limit=2${extra}`));
  expect(response.status).toBe(200);
  return response.json() as Promise<{
    games: { id: number; devices: { id: number }[] }[];
    pagination: { total: number; totalPages: number };
  }>;
}

beforeEach(() => {
  database.rows = [game(1, "A", 10), game(2, "A", 10), game(3, "B", 20), game(4, "B", 20), game(5, "C", 30), game(6, "D", 40)];
});

describe("game catalog pagination", () => {
  it("paginates four unique games from six raw records into two full nonoverlapping pages", async () => {
    const first = await page(1);
    const second = await page(2);
    expect(first.games.map((g) => g.id)).toEqual([1, 3]);
    expect(second.games.map((g) => g.id)).toEqual([5, 6]);
    expect(first.pagination).toMatchObject({ total: 4, totalPages: 2 });
    expect(second.pagination).toMatchObject({ total: 4, totalPages: 2 });
  });

  it("merges device associations even when duplicate records would fall on another raw page", async () => {
    database.rows = [game(1, "A", 10), game(2, "B", 20), game(3, "C", 30), game(4, "A", 10)];
    const first = await page(1);
    expect(first.games[0].devices.map((d) => d.id)).toEqual([1, 4]);
  });

  it("keeps platform versions with a shared IGDB identifier as separate games", async () => {
    database.rows = [game(1, "A", 10), game(2, "A", 10, 2, "ps2")];
    const first = await page(1);
    expect(first.games.map((g) => g.id)).toEqual([1, 2]);
    expect(first.pagination.total).toBe(2);
  });

  it("combines transitive title and identifier aliases using the same grouping for totals", async () => {
    database.rows = [game(1, "Alias", null), game(2, "Alias", 10), game(3, "Alternate", 10), game(4, "Other", 20)];
    const first = await page(1);
    expect(first.games.map((g) => g.id)).toEqual([1, 4]);
    expect(first.games[0].devices.map((d) => d.id)).toEqual([1, 2, 3]);
    expect(first.pagination.total).toBe(2);
  });

  it("returns an empty page past the unique result set while preserving its exact total", async () => {
    const third = await page(3);
    expect(third.games).toEqual([]);
    expect(third.pagination.total).toBe(4);
  });

  it("retains raw pagination when a specific device is selected", async () => {
    database.rows = [game(1, "A", 10, 1), game(2, "A", 10, 1), game(3, "B", 20, 1), game(4, "B", 20, 1), game(5, "C", 30, 1), game(6, "D", 40, 1)];
    const first = await page(1, "&deviceId=1");
    expect(first.games.map((g) => g.id)).toEqual([1, 2]);
    expect(first.pagination.total).toBe(6);
  });
});
