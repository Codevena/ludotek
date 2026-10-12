import type { Prisma } from "@prisma/client";

/** Cursors identify an already-selected row, rather than an offset into changing filters. */
export function parseEnrichmentCursor(request: Request): number | null {
  const values = new URL(request.url).searchParams.getAll("afterId");
  if (!values.length) return 0;
  if (values.length !== 1 || !/^\d+$/.test(values[0])) return null;
  const cursor = Number(values[0]);
  return Number.isSafeInteger(cursor) && cursor >= 0 ? cursor : null;
}

export function enrichmentBatchWhere(where: Prisma.GameWhereInput, afterId: number): Prisma.GameWhereInput {
  return { ...where, id: { gt: afterId } };
}

export function enrichmentNextCursor(games: readonly { id: number }[], afterId: number): number {
  return games.length ? games[games.length - 1].id : afterId;
}
