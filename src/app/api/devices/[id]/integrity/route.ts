import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { integrityService, integrityErrorResponse, readIntegrityBody, parseIntegrityStart, IntegrityInputError } from "@/lib/device-integrity";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

function deviceId(id: string): number {
  if (!/^[1-9]\d{0,9}$/.test(id)) throw new IntegrityInputError("Invalid device ID");
  return Number(id);
}

export async function GET(request: NextRequest, context: Context) {
  const error = requireAuth(request);
  if (error) return error;
  try {
    const id = deviceId((await context.params).id);
    const result = await integrityService.overview(id, Number(request.nextUrl.searchParams.get("afterFileId") ?? 0), request.nextUrl.searchParams.get("q") ?? "", request.nextUrl.searchParams.get("beforeJobId") ?? undefined);
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (failure) { return integrityErrorResponse(failure); }
}

export async function POST(request: NextRequest, context: Context) {
  const error = requireAuth(request);
  if (error) return error;
  try {
    const id = deviceId((await context.params).id);
    const bytes = await readIntegrityBody(request, 64 * 1024);
    let body: unknown;
    try { body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
    catch { throw new IntegrityInputError("Invalid JSON body"); }
    const job = await integrityService.start(id, parseIntegrityStart(body));
    return Response.json({ job }, { status: 202, headers: { "Cache-Control": "no-store" } });
  } catch (failure) { return integrityErrorResponse(failure); }
}
