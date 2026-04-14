import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getScanProgress } from "@/lib/scan-progress";

export async function GET(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const progress = getScanProgress();

  if (!progress) {
    return NextResponse.json({
      scanning: false,
      progress: 0,
      status: "",
      gamesFound: 0,
      newGames: 0,
      updatedGames: 0,
      totalPaths: 0,
      deviceName: "",
    });
  }

  return NextResponse.json(progress);
}
