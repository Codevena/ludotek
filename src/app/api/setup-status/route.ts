import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
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
}
