import { NextResponse } from "next/server";
import { getScanProgress } from "@/lib/scan-progress";

export async function GET() {
  const progress = getScanProgress();

  if (!progress) {
    return NextResponse.json({
      scanning: false,
      progress: 0,
      status: "",
      gamesFound: 0,
      newGames: 0,
      updatedGames: 0,
      deviceName: "",
    });
  }

  return NextResponse.json(progress);
}
