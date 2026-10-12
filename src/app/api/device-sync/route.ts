import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { readBoundedJson } from "@/lib/request-body";
import { deviceProfileFailure } from "@/lib/device-profiles";
import { createDeviceSyncPlan } from "@/lib/device-profile-sync";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  const authError = requireAuth(request); if (authError) return authError;
  try { return NextResponse.json(await createDeviceSyncPlan(await readBoundedJson(request, 128 * 1024), request), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return deviceProfileFailure(error); }
}
