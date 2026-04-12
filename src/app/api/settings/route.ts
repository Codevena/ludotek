import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const settings = await prisma.settings.findFirst({ where: { id: 1 } });

  if (!settings) {
    return NextResponse.json({ error: "Settings not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...settings,
    deckPassword: settings.deckPassword ? "********" : "",
    igdbClientSecret: settings.igdbClientSecret ? "********" : "",
    openrouterKey: settings.openrouterKey ? "********" : "",
    steamApiKey: settings.steamApiKey ? "********" : "",
  });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();

  const data: Record<string, string> = {};
  const fields = [
    "deckHost", "deckUser", "deckPassword",
    "igdbClientId", "igdbClientSecret", "steamgriddbKey",
    "openrouterKey", "steamApiKey",
  ];

  for (const field of fields) {
    if (body[field] !== undefined && body[field] !== "********") {
      data[field] = body[field];
    }
  }

  const settings = await prisma.settings.update({
    where: { id: 1 },
    data,
  });

  return NextResponse.json({ success: true, settings: { ...settings, deckPassword: "********" } });
}
