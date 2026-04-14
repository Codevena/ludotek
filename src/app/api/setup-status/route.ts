import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const devices = await prisma.device.findMany({
      select: { scanPaths: true },
    });

    const hasConfiguredDevice = devices.some((d) => {
      try {
        const paths = JSON.parse(d.scanPaths);
        return Array.isArray(paths) && paths.length > 0;
      } catch {
        return false;
      }
    });

    return NextResponse.json({ needsSetup: !hasConfiguredDevice });
  } catch (err) {
    console.error("Failed to check setup status:", err);
    return NextResponse.json({ needsSetup: false }, { status: 500 });
  }
}
