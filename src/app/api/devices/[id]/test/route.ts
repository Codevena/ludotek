import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getDecryptedDevice } from "@/lib/encryption";
import { createConnection } from "@/lib/connection";
import type { ConnectionConfig } from "@/lib/connection";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const { id } = await params;
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "Invalid device ID" }, { status: 400 });
  }
  const deviceId = parseInt(id, 10);
  if (isNaN(deviceId)) {
    return NextResponse.json({ error: "Invalid device ID" }, { status: 400 });
  }

  const device = await getDecryptedDevice(deviceId);
  if (!device) {
    return NextResponse.json({ error: "Device not found" }, { status: 404 });
  }

  try {
    const conn = await createConnection({
      protocol: device.protocol,
      host: device.host,
      port: device.port,
      user: device.user,
      password: device.password,
    } as ConnectionConfig);
    conn.disconnect();
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Connection failed";
    return NextResponse.json({ ok: false, error: message });
  }
}
