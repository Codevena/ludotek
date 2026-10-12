import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { deviceProfileFailure, DeviceProfileError, validDeviceNumber } from "@/lib/device-profiles";
import { acquireSaveContext, readSaveInventory, streamSaveBackup, validSavePath } from "@/lib/device-saves";
import { readBoundedJson } from "@/lib/request-body";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };
async function deviceId(params: Params["params"]) { const value = (await params).id; const id = /^[1-9]\d{0,9}$/.test(value) ? Number(value) : NaN; if (!validDeviceNumber(id)) throw new DeviceProfileError("Ungültige Geräte-ID."); return id; }
export async function GET(request: NextRequest, { params }: Params) {
  const authError = requireAuth(request); if (authError) return authError;
  try {
    const id = await deviceId(params); const context = await acquireSaveContext([id], request);
    try { return NextResponse.json(await readSaveInventory(context, id), { headers: { "Cache-Control": "no-store" } }); }
    finally { await context.close(); }
  } catch (error) { return deviceProfileFailure(error); }
}
export async function POST(request: NextRequest, { params }: Params) {
  const authError = requireAuth(request); if (authError) return authError;
  try {
    const id = await deviceId(params); const input = await readBoundedJson(request, 32 * 1024);
    if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).some((key) => !["filePath", "gameId"].includes(key)) || !("filePath" in input) || !validSavePath(input.filePath) || ("gameId" in input && !validDeviceNumber(input.gameId))) throw new DeviceProfileError("Eine tatsächliche Save-Datei und optional ein vorhandenes Spiel auswählen.");
    return await streamSaveBackup({ deviceId: id, filePath: input.filePath, ...("gameId" in input ? { gameId: input.gameId as number } : {}) }, request);
  } catch (error) { return deviceProfileFailure(error); }
}
