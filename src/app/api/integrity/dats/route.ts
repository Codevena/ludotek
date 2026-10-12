import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { integrityService, integrityErrorResponse, readIntegrityBody, INTEGRITY_DAT_BYTES } from "@/lib/device-integrity";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const error = requireAuth(request);
  if (error) return error;
  try {
    const params = request.nextUrl.searchParams;
    const sourceId = params.get("sourceId");
    const result = sourceId
      ? await integrityService.sourceRoms(sourceId, Number(params.get("afterIndex") ?? -1), params.get("q") ?? "")
      : await integrityService.sources(params.get("afterId") ?? "");
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (failure) { return integrityErrorResponse(failure); }
}

export async function POST(request: NextRequest) {
  const error = requireAuth(request);
  if (error) return error;
  try {
    const bytes = await readIntegrityBody(request, INTEGRITY_DAT_BYTES);
    const source = await integrityService.importDat(bytes, request.nextUrl.searchParams.get("name") ?? undefined);
    return Response.json({ source }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (failure) { return integrityErrorResponse(failure); }
}
