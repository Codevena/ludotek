import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join, extname, sep } from "path";
import { requireAuth } from "@/lib/auth";

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

const DATA_DIR = join(process.cwd(), "data");

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const authError = requireAuth(request);
  if (authError) return authError;

  try {
    const { path: segments } = await params;
    const filePath = segments.join("/");

    // Path traversal prevention
    if (filePath.includes("..") || filePath.includes("\0")) {
      return NextResponse.json(
        { error: "Invalid path" },
        { status: 400 },
      );
    }

    const fullPath = join(DATA_DIR, filePath);

    // Ensure resolved path stays within data directory
    if (!fullPath.startsWith(DATA_DIR + sep)) {
      return NextResponse.json(
        { error: "Invalid path" },
        { status: 400 },
      );
    }

    // Only serve known image types — never hidden/dot files (e.g. .encryption-key)
    // or arbitrary binaries from the data directory (defence-in-depth alongside auth).
    const ext = extname(fullPath).toLowerCase();
    const contentType = CONTENT_TYPES[ext];
    if (!contentType) {
      return NextResponse.json(
        { error: "Invalid path" },
        { status: 400 },
      );
    }

    let buffer: Buffer;
    try {
      buffer = await readFile(fullPath);
    } catch (err) {
      // Avoids the existsSync/readFile TOCTOU: a concurrent cache clear yields ENOENT.
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return NextResponse.json(
          { error: "File not found" },
          { status: 404 },
        );
      }
      throw err;
    }

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        // `private` (not `public`): this route is auth-gated, so shared/CDN
        // caches must not store and re-serve the response to other clients.
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Cache file serve error:", error);
    return NextResponse.json(
      { error: "Failed to serve file" },
      { status: 500 },
    );
  }
}
