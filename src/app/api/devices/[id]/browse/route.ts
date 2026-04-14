import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createConnection, buildBrowseResult } from "@/lib/connection";
import type { ConnectionConfig } from "@/lib/connection";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const { id } = await params;
  const deviceId = parseInt(id, 10);
  if (isNaN(deviceId)) {
    return NextResponse.json({ error: "Invalid device ID" }, { status: 400 });
  }

  const device = await prisma.device.findUnique({ where: { id: deviceId } });
  if (!device) {
    return NextResponse.json({ error: "Device not found" }, { status: 404 });
  }

  const path = request.nextUrl.searchParams.get("path") ?? "/";

  let conn;
  try {
    conn = await createConnection({
      protocol: device.protocol,
      host: device.host,
      port: device.port,
      user: device.user,
      password: device.password,
    } as ConnectionConfig);

    const entries = await conn.listDirDetailed(path);
    return NextResponse.json(buildBrowseResult(path, entries));
  } catch (error) {
    console.error("Browse failed:", error);
    const message =
      error instanceof Error ? error.message : "Connection failed";
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    conn?.disconnect();
  }
}
