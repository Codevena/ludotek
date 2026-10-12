import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { FilePlanError } from "@/lib/file-plans";
import { filePlanFailure } from "@/lib/file-plan-api";
import { syncJournal } from "@/lib/sync-journal";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireAuth(request); if (denied) return denied;
  try {
    const raw = (await params).id;
    if (!/^[1-9]\d{0,9}$/.test(raw) || Number(raw) > 2147483647) throw new FilePlanError(400, "INVALID_ID", "Invalid queue ID");
    const result = await syncJournal.clear([Number(raw)], request);
    return Response.json({ deleted: result.cleared === 1 }, { status: result.cleared === 1 ? 200 : 404, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return filePlanFailure(error); }
}
