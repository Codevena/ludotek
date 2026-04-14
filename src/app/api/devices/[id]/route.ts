import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const PASSWORD_MASK = "********";

function maskPassword<T extends { password: string }>(
  device: T,
): Omit<T, "password"> & { password: string } {
  return { ...device, password: PASSWORD_MASK };
}

function parseDeviceId(id: string): number | null {
  const parsed = parseInt(id, 10);
  return isNaN(parsed) ? null : parsed;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const { id } = await params;
  const deviceId = parseDeviceId(id);
  if (deviceId === null) {
    return NextResponse.json({ error: "Invalid device ID" }, { status: 400 });
  }

  const device = await prisma.device.findUnique({ where: { id: deviceId } });
  if (!device) {
    return NextResponse.json({ error: "Device not found" }, { status: 404 });
  }

  return NextResponse.json(maskPassword(device));
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const { id } = await params;
  const deviceId = parseDeviceId(id);
  if (deviceId === null) {
    return NextResponse.json({ error: "Invalid device ID" }, { status: 400 });
  }

  try {
    const body = await request.json();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: Record<string, any> = {};

    if (body.name !== undefined) data.name = body.name;
    if (body.type !== undefined) {
      if (!["steamdeck", "android", "local", "custom"].includes(body.type)) {
        return NextResponse.json({ error: "Invalid device type" }, { status: 400 });
      }
      data.type = body.type;
    }
    if (body.protocol !== undefined) {
      if (!["ssh", "ftp", "local"].includes(body.protocol)) {
        return NextResponse.json({ error: "Invalid protocol" }, { status: 400 });
      }
      data.protocol = body.protocol;
    }
    if (body.host !== undefined) data.host = body.host;
    if (body.port !== undefined) {
      const port = Number(body.port);
      if (port < 1 || port > 65535) {
        return NextResponse.json({ error: "Invalid port number" }, { status: 400 });
      }
      data.port = port;
    }
    if (body.user !== undefined) data.user = body.user;

    // Don't overwrite password if the masked placeholder is sent back
    if (body.password !== undefined && body.password !== PASSWORD_MASK) {
      data.password = body.password;
    }

    if (body.scanPaths !== undefined) {
      data.scanPaths = Array.isArray(body.scanPaths)
        ? JSON.stringify(body.scanPaths)
        : body.scanPaths;
    }

    if (body.blacklist !== undefined) {
      data.blacklist = Array.isArray(body.blacklist)
        ? JSON.stringify(body.blacklist)
        : body.blacklist;
    }

    const device = await prisma.device.update({
      where: { id: deviceId },
      data,
    });

    return NextResponse.json(maskPassword(device));
  } catch (error) {
    console.error("Failed to update device:", error);
    return NextResponse.json(
      { error: "Device not found or update failed" },
      { status: 404 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const { id } = await params;
  const deviceId = parseDeviceId(id);
  if (deviceId === null) {
    return NextResponse.json({ error: "Invalid device ID" }, { status: 400 });
  }

  try {
    // Clear activeDeviceId if this device was the active one
    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    if (settings?.activeDeviceId === Number(id)) {
      await prisma.settings.update({
        where: { id: 1 },
        data: { activeDeviceId: null },
      });
    }

    await prisma.device.delete({ where: { id: deviceId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete device:", error);
    return NextResponse.json(
      { error: "Device not found" },
      { status: 404 },
    );
  }
}
