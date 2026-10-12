import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { readBoundedJson } from "@/lib/request-body";
import { filePlanFailure } from "@/lib/file-plan-api";
import { parseSyncIds, syncJournal } from "@/lib/sync-journal";

export async function GET(request: NextRequest) {
  const denied = requireAuth(request); if (denied) return denied;
  try {
    return Response.json(await syncJournal.list(Number(request.nextUrl.searchParams.get("afterId") ?? 0)), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return filePlanFailure(error); }
}

export async function POST(request: NextRequest) {
  const denied = requireAuth(request); if (denied) return denied;
  try {
    const result = await syncJournal.stage(await readBoundedJson(request, 16 * 1024), request);
    return Response.json(result, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return filePlanFailure(error); }
}

export async function DELETE(request: NextRequest) {
  const denied = requireAuth(request); if (denied) return denied;
  try {
    const ids = request.body ? parseSyncIds(await readBoundedJson(request, 16 * 1024)) : undefined;
    return Response.json(await syncJournal.clear(ids, request), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return filePlanFailure(error); }
}
