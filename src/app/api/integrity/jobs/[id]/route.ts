import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { integrityService, integrityErrorResponse } from "@/lib/device-integrity";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const error = requireAuth(request);
  if (error) return error;
  try {
    const result = await integrityService.snapshot((await params).id, Number(request.nextUrl.searchParams.get("afterId") ?? 0));
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (failure) { return integrityErrorResponse(failure); }
}
