import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { deviceProfileFailure, getDeviceProfile, PROFILE_TEMPLATES, saveDeviceProfile } from "@/lib/device-profiles";
import { readBoundedJson } from "@/lib/request-body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };
function numberId(value: string) { return /^[1-9]\d{0,9}$/.test(value) ? Number(value) : NaN; }
export async function GET(request: NextRequest, { params }: Params) {
  const authError = requireAuth(request); if (authError) return authError;
  try { return NextResponse.json({ ...await getDeviceProfile(numberId((await params).id)), templates: PROFILE_TEMPLATES }, { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return deviceProfileFailure(error); }
}
export async function PUT(request: NextRequest, { params }: Params) {
  const authError = requireAuth(request); if (authError) return authError;
  try { return NextResponse.json(await saveDeviceProfile(numberId((await params).id), await readBoundedJson(request, 64 * 1024), request), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return deviceProfileFailure(error); }
}
