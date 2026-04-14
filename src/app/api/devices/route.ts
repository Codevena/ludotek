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

  return NextResponse.json({ devices: devices.map(maskPassword) });
}

export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();

    const { name } = body;
    if (!name) {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400 },
      );
    }

    const type: string = body.type ?? "custom";
    if (!["steamdeck", "android", "local", "custom"].includes(type)) {
      return NextResponse.json({ error: "Invalid device type" }, { status: 400 });
    }
    const protocol: string = body.protocol ?? "ssh";
    if (!["ssh", "ftp", "local"].includes(protocol)) {
      return NextResponse.json({ error: "Invalid protocol (must be ssh, ftp, or local)" }, { status: 400 });
    }

    // Local devices don't need host/user/port
    if (protocol !== "local" && (!body.host || !body.user)) {
      return NextResponse.json(
        { error: "host and user are required for remote devices" },
        { status: 400 },
      );
    }

    const host: string = body.host ?? "localhost";
    const user: string = body.user ?? "";
    const port: number = protocol === "local" ? 0 : (Number(body.port) || (protocol === "ftp" ? 21 : 22));
    if (protocol !== "local" && (port < 1 || port > 65535)) {
      return NextResponse.json({ error: "Invalid port number" }, { status: 400 });
    }
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
