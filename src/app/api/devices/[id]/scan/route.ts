import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getDecryptedDevice } from "@/lib/encryption";
import { isScanRunning } from "@/lib/scan-progress";
import { runScanInBackground } from "@/lib/scan-runner";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const { id } = await params;
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "Invalid device ID" }, { status: 400 });
  }
  const deviceId = parseInt(id, 10);
  if (isNaN(deviceId)) {
    return NextResponse.json({ error: "Invalid device ID" }, { status: 400 });
  }

  const device = await getDecryptedDevice(deviceId);
  if (!device) {
    return NextResponse.json({ error: "Device not found" }, { status: 404 });
  }

  if (isScanRunning()) {
    return NextResponse.json(
      { error: "A scan is already running" },
      { status: 409 },
    );
  }

  // Fire and forget — scan runs in background
  runScanInBackground(deviceId).catch((err) => console.error("Scan crashed:", err));

  return NextResponse.json({ success: true, message: `Scan started for ${device.name}` });
}
