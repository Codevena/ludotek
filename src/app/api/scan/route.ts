import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { isScanRunning } from "@/lib/scan-progress";
import { runScanInBackground } from "@/lib/scan-runner";

export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  if (isScanRunning()) {
    return NextResponse.json(
      { error: "A scan is already running" },
      { status: 409 },
    );
  }

  // Fire and forget — scan runs in background
  runScanInBackground().catch((err) => console.error("Scan crashed:", err));

  return NextResponse.json({ success: true, message: "Scan started" });
}
