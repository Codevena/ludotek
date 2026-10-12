import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { readBoundedJson } from "@/lib/request-body";
import { filePlanFailure } from "@/lib/file-plan-api";
import { parseSyncIds, syncJournal } from "@/lib/sync-journal";

export async function POST(request: NextRequest) {
  const denied = requireAuth(request); if (denied) return denied;
  try {
    const ids = parseSyncIds(await readBoundedJson(request, 16 * 1024));
    return Response.json(await syncJournal.apply(ids, request), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return filePlanFailure(error); }
}
