import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createConnection } from "@/lib/connection";
import type { ConnectionConfig } from "@/lib/connection";
import { validateRemotePath, loadDevice } from "@/lib/path-validation";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const { id } = await params;
  const result = await loadDevice(id);
  if (result.error) return result.error;
  const { device } = result;

  const body = await request.json().catch(() => null);
  if (!body?.path) {
    return NextResponse.json({ error: "path is required" }, { status: 400 });
  }

  const pathError = validateRemotePath(body.path);
  if (pathError) return pathError;

  let conn;
  try {
    conn = await createConnection({
      protocol: device.protocol,
      host: device.host,
      port: device.port,
      user: device.user,
      password: device.password,
    } as ConnectionConfig);
    await conn.mkdir(body.path);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("mkdir failed:", error);
    const message = error instanceof Error ? error.message : "mkdir failed";
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    conn?.disconnect();
  }
}
