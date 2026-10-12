import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { deviceProfileFailure, DeviceProfileError } from "@/lib/device-profiles";
import { getSaveVersions } from "@/lib/device-saves";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const authError = requireAuth(request); if (authError) return authError;
  try {
    const query = new URL(request.url).searchParams;
    const number = (key: string) => { const value = query.get(key); if (value === null) return undefined; if (!/^\d{1,10}$/.test(value)) throw new DeviceProfileError("Ungültige Versionsseite."); return Number(value); };
    return NextResponse.json(await getSaveVersions({ deviceId: number("deviceId"), gameId: number("gameId"), fileKey: query.get("fileKey") ?? undefined, offset: number("offset"), take: number("take") }), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return deviceProfileFailure(error); }
}
