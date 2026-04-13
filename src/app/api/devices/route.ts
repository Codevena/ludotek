import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const PASSWORD_MASK = "********";

const STEAMDECK_BLACKLIST = [
  "Proton *",
  "SteamLinuxRuntime*",
  "Steamworks Common Redistributables",
  "SteamworksShared",
];

function maskPassword<T extends { password: string }>(
  device: T,
): Omit<T, "password"> & { password: string } {
  return { ...device, password: PASSWORD_MASK };
}

export async function GET(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const devices = await prisma.device.findMany({
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(devices.map(maskPassword));
}

export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();

    const { name, host, user } = body;
    if (!name || !host || !user) {
      return NextResponse.json(
        { error: "name, host, and user are required" },
        { status: 400 },
      );
    }

    const type: string = body.type ?? "custom";
    const protocol: string = body.protocol ?? "ssh";
    const port: number =
      body.port ?? (protocol === "ftp" ? 21 : 22);
    const password: string = body.password ?? "";

    const blacklist =
      type === "steamdeck" ? STEAMDECK_BLACKLIST : [];

    const device = await prisma.device.create({
      data: {
        name,
        type,
        protocol,
        host,
        port,
        user,
        password,
        blacklist: JSON.stringify(blacklist),
      },
    });

    return NextResponse.json(maskPassword(device), { status: 201 });
  } catch (error) {
    console.error("Failed to create device:", error);
    return NextResponse.json(
      { error: "Failed to create device" },
      { status: 500 },
    );
  }
}
