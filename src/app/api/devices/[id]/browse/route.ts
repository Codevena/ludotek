import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getDecryptedDevice } from "@/lib/encryption";
import { createConnection, buildBrowseResult } from "@/lib/connection";
import type { ConnectionConfig } from "@/lib/connection";
import { validateRemotePath } from "@/lib/path-validation";
import { getLocalBrowseLocation, LocalPathError } from "@/lib/local-paths";

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

  const path = request.nextUrl.searchParams.get("path") ?? "/";
  const pathError = validateRemotePath(path, true);
  if (pathError) return pathError;

  let conn;
  try {
    conn = await createConnection({
      protocol: device.protocol,
      host: device.host,
      port: device.port,
      user: device.user,
      password: device.password,
      ftps: device.ftps,
    } as ConnectionConfig);

    const location = device.protocol === "local" ? await getLocalBrowseLocation(path) : null;
    const entries = await conn.listDirDetailed(location?.path ?? path);
    return NextResponse.json(location ? { ...location, entries } : buildBrowseResult(path, entries));
  } catch (error) {
    if (error instanceof LocalPathError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Browse failed:", error);
    const message =
      error instanceof Error ? error.message : "Connection failed";
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    conn?.disconnect();
  }
}
