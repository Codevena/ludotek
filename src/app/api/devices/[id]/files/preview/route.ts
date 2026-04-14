import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createConnection } from "@/lib/connection";
import type { ConnectionConfig } from "@/lib/connection";
import { validateRemotePath, loadDevice } from "@/lib/path-validation";

const IMAGE_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp",
]);
const TEXT_EXTENSIONS = new Set([
  ".txt", ".log", ".cfg", ".ini", ".xml", ".json", ".m3u", ".md", ".yaml", ".yml",
]);
const MAX_TEXT_BYTES = 100 * 1024; // 100 KB
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

const MIME_MAP: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
  ".webp": "image/webp",
};

function getExtension(filePath: string): string {
  const dot = filePath.lastIndexOf(".");
  return dot === -1 ? "" : filePath.slice(dot).toLowerCase();
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const { id } = await params;
  const result = await loadDevice(id);
  if (result.error) return result.error;
  const { device } = result;

  const filePath = request.nextUrl.searchParams.get("path");
  if (!filePath) {
    return NextResponse.json({ error: "path is required" }, { status: 400 });
  }
  const pathError = validateRemotePath(filePath);
  if (pathError) return pathError;

  const ext = getExtension(filePath);

  let conn;
  try {
    conn = await createConnection({
      protocol: device.protocol,
      host: device.host,
      port: device.port,
      user: device.user,
      password: device.password,
    } as ConnectionConfig);

    if (IMAGE_EXTENSIONS.has(ext)) {
      const stats = await conn.stat(filePath);
      if (stats.size > MAX_IMAGE_BYTES) {
        return NextResponse.json(
          { error: `Image too large for preview (${(stats.size / (1024 * 1024)).toFixed(1)} MB, max 10 MB)` },
          { status: 413 },
        );
      }
      const data = await conn.readFile(filePath);
      const mime = MIME_MAP[ext] ?? "application/octet-stream";
      return new NextResponse(new Uint8Array(data), {
        headers: { "Content-Type": mime },
      });
    }

    if (TEXT_EXTENSIONS.has(ext)) {
      const data = await conn.readFile(filePath, MAX_TEXT_BYTES);
      const text = data.toString("utf-8");
      const stats = await conn.stat(filePath);
      return NextResponse.json({
        content: text,
        truncated: stats.size > MAX_TEXT_BYTES,
        size: stats.size,
      });
    }

    // Binary / unknown — metadata only
    const stats = await conn.stat(filePath);
    return NextResponse.json({
      name: filePath.split("/").pop(),
      size: stats.size,
      modifiedAt: stats.modifiedAt,
      type: "binary",
    });
  } catch (error) {
    console.error("preview failed:", error);
    const message = error instanceof Error ? error.message : "preview failed";
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    conn?.disconnect();
  }
}
