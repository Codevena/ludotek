import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const settings = await prisma.settings.findFirst({
      where: { id: 1 },
      select: { romSearchUrl: true },
    });

    return NextResponse.json({
      romSearchUrl: settings?.romSearchUrl || "",
    });
  } catch (error) {
    console.error("Failed to get ROM search URL:", error);
    return NextResponse.json({ romSearchUrl: "" });
  }
}
