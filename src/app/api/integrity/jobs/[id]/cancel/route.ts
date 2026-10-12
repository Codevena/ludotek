import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { integrityService, integrityErrorResponse } from "@/lib/device-integrity";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const error = requireAuth(request);
  if (error) return error;
  try {
    const result = await integrityService.cancel((await params).id);
    return Response.json(result, { status: result.job.status === "running" ? 202 : 200, headers: { "Cache-Control": "no-store" } });
  } catch (failure) { return integrityErrorResponse(failure); }
}
