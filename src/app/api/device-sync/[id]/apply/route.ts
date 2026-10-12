import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { deviceProfileFailure } from "@/lib/device-profiles";
import { applyDeviceSyncPlan } from "@/lib/device-profile-sync";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = requireAuth(request); if (authError) return authError;
  try { return NextResponse.json(await applyDeviceSyncPlan((await params).id, request), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return deviceProfileFailure(error); }
}
