import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { deviceProfileFailure, DeviceProfileError, validDeviceNumber } from "@/lib/device-profiles";
import { prepareSaveRestore, validSavePath, validSaveVersionId } from "@/lib/device-saves";
import { readBoundedJson } from "@/lib/request-body";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = requireAuth(request); if (authError) return authError;
  try {
    const versionId = (await params).id; const input = await readBoundedJson(request, 32 * 1024);
    if (!validSaveVersionId(versionId) || !input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).some((key) => !["targetDeviceId", "targetPath"].includes(key)) || !("targetDeviceId" in input) || !validDeviceNumber(input.targetDeviceId) || !("targetPath" in input) || !validSavePath(input.targetPath)) throw new DeviceProfileError("Eine vorhandene Version und ein Ziel innerhalb deklarierter Save-Wurzeln auswählen.");
    return NextResponse.json(await prepareSaveRestore({ versionId, targetDeviceId: input.targetDeviceId, targetPath: input.targetPath }, request), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return deviceProfileFailure(error); }
}
