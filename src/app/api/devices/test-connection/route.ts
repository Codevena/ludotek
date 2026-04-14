import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createConnection } from "@/lib/connection";
import type { ConnectionConfig } from "@/lib/connection";

export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { protocol, host, port, user, password } = body;

    if (protocol === "local") {
      // Local connections always work — just verify filesystem access
      const fs = await import("fs/promises");
      await fs.access("/");
      return NextResponse.json({ ok: true });
    }

    if (!host || !user) {
      return NextResponse.json(
        { error: "host and user are required" },
        { status: 400 },
      );
    }

    const config: ConnectionConfig = {
      protocol: protocol ?? "ssh",
      host,
      port: port ?? (protocol === "ftp" ? 21 : 22),
      user,
      password: password ?? "",
    };

    const conn = await createConnection(config);
    conn.disconnect();
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Connection failed";
    return NextResponse.json({ ok: false, error: message });
  }
}
