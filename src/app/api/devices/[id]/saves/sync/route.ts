import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { deviceProfileFailure, DeviceProfileError, validDeviceNumber } from "@/lib/device-profiles";
import { createSaveSyncPlan, applySaveSyncPlan, getSaveSyncPlan } from "@/lib/save-sync";
import { readBoundedJson } from "@/lib/request-body";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };
async function deviceId(params: Params["params"]) { const value = (await params).id; const id = /^[1-9]\d{0,9}$/.test(value) ? Number(value) : NaN; if (!validDeviceNumber(id)) throw new DeviceProfileError("Ungültige Save-Geräte-ID."); return id; }
export async function GET(request: NextRequest, { params }: Params) {
  const authError = requireAuth(request); if (authError) return authError;
  try { const id = await deviceId(params); const plan = await getSaveSyncPlan(new URL(request.url).searchParams.get("planId") ?? ""); if (plan.deviceId !== id) throw new DeviceProfileError("Save-Sync-Plan gehört nicht zu diesem Gerät.", 404); return NextResponse.json(plan, { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return deviceProfileFailure(error); }
}
export async function POST(request: NextRequest, { params }: Params) {
  const authError = requireAuth(request); if (authError) return authError;
  try {
    const id = await deviceId(params); const input = await readBoundedJson(request, 128 * 1024);
    if (!input || typeof input !== "object" || Array.isArray(input) || !("action" in input)) throw new DeviceProfileError("Explizite Save-Sync-Aktion auswählen.");
    if (input.action === "apply") {
      if (Object.keys(input).some((key) => !["action", "planId"].includes(key)) || !("planId" in input) || typeof input.planId !== "string") throw new DeviceProfileError("Gespeicherten Save-Sync-Plan auswählen.");
      const plan = await getSaveSyncPlan(input.planId); if (plan.deviceId !== id) throw new DeviceProfileError("Save-Sync-Plan gehört nicht zu diesem Gerät.", 404);
      return NextResponse.json(await applySaveSyncPlan(input.planId, request), { headers: { "Cache-Control": "no-store" } });
    }
    if (input.action !== "preview" || Object.keys(input).some((key) => !["action", "masterDeviceId", "direction", "resolutions", "afterKey"].includes(key))) throw new DeviceProfileError("Ungültige Save-Sync-Vorschau.");
    const selection = Object.fromEntries(Object.entries(input).filter(([key]) => key !== "action"));
    return NextResponse.json(await createSaveSyncPlan({ ...selection, deviceId: id }, request), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return deviceProfileFailure(error); }
}
