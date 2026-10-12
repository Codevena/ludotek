import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { validateUploadBody, UploadInputError } from "@/lib/disc-inputs";
import { readBoundedJson } from "@/lib/request-body";
import { processUploadThroughJournal } from "@/lib/upload-journal";
import { deviceProfileFailure } from "@/lib/device-profiles";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  const authError = requireAuth(request); if (authError) return authError;
  try { return await processUploadThroughJournal(validateUploadBody(await readBoundedJson(request, 64 * 1024), true), request); }
  catch (error) {
    if (error instanceof UploadInputError) return Response.json({ error: error.message }, { status: error.status, headers: { "Cache-Control": "no-store" } });
    return deviceProfileFailure(error);
  }
}
