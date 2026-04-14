import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createConnection } from "@/lib/connection";
import type { ConnectionConfig } from "@/lib/connection";
import { validateRemotePath, loadDevice } from "@/lib/path-validation";

export async function DELETE(
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
  if (!body?.paths || !Array.isArray(body.paths) || body.paths.length === 0) {
    return NextResponse.json(
      { error: "paths array is required" },
      { status: 400 },
    );
  }

  for (const p of body.paths) {
    const pathError = validateRemotePath(p);
    if (pathError) return pathError;
  }

  let conn;
  try {
    conn = await createConnection({
      protocol: device.protocol,
      host: device.host,
      port: device.port,
      user: device.user,
      password: device.password,
    } as ConnectionConfig);

    const errors: string[] = [];
    for (const p of body.paths) {
      try {
        await conn.remove(p);
      } catch (err) {
        errors.push(
          `${p}: ${err instanceof Error ? err.message : "delete failed"}`,
        );
      }
    }

    if (errors.length > 0) {
      return NextResponse.json({ ok: false, errors }, { status: 207 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("delete failed:", error);
    const message = error instanceof Error ? error.message : "delete failed";
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    conn?.disconnect();
  }
}
