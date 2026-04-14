import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { isScanRunning } from "@/lib/scan-progress";
import { runScanInBackground } from "@/lib/scan-runner";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const { id } = await params;
  const deviceId = parseInt(id, 10);
  if (isNaN(deviceId)) {
    return NextResponse.json({ error: "Invalid device ID" }, { status: 400 });
  }

  const device = await prisma.device.findUnique({ where: { id: deviceId } });
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
  runScanInBackground(deviceId);

  return NextResponse.json({ success: true, message: `Scan started for ${device.name}` });
}
