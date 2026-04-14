import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

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
    steamgriddbKey: settings.steamgriddbKey ? "********" : "",
  });
}

export async function PUT(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const data: Record<string, string> = {};
  const fields = [
    "deckHost", "deckUser", "deckPassword",
    "igdbClientId", "igdbClientSecret", "steamgriddbKey",
    "openrouterKey", "steamApiKey", "aiLanguage", "romSearchUrl",
  ];

  for (const field of fields) {
    const value = body[field];
    if (value !== undefined && value !== "********") {
      if (typeof value !== "string") {
        return NextResponse.json({ error: `Field "${field}" must be a string` }, { status: 400 });
      }
      data[field] = value;
    }
  }

  // Handle activeDeviceId (integer, not string)
  if (body.activeDeviceId !== undefined) {
    if (body.activeDeviceId === null) {
      (data as Record<string, unknown>).activeDeviceId = null;
    } else {
      const numVal = Number(body.activeDeviceId);
      if (!Number.isInteger(numVal)) {
        return NextResponse.json({ error: "activeDeviceId must be an integer or null" }, { status: 400 });
      }
      (data as Record<string, unknown>).activeDeviceId = numVal;
    }
  }

  const settings = await prisma.settings.update({
    where: { id: 1 },
    data,
  });

  return NextResponse.json({
    success: true,
    settings: {
      ...settings,
      deckPassword: settings.deckPassword ? "********" : "",
      igdbClientSecret: settings.igdbClientSecret ? "********" : "",
      openrouterKey: settings.openrouterKey ? "********" : "",
      steamApiKey: settings.steamApiKey ? "********" : "",
      steamgriddbKey: settings.steamgriddbKey ? "********" : "",
    },
  });
}
