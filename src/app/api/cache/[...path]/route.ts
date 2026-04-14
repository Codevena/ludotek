import { NextRequest, NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join, extname } from "path";

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

const DATA_DIR = join(process.cwd(), "data");

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
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
    if (!fullPath.startsWith(DATA_DIR)) {
      return NextResponse.json(
        { error: "Invalid path" },
        { status: 400 },
      );
    }

    if (!existsSync(fullPath)) {
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 },
      );
    }

    const buffer = readFileSync(fullPath);
    const ext = extname(fullPath).toLowerCase();
    const contentType = CONTENT_TYPES[ext] || "application/octet-stream";

    return new Response(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
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
