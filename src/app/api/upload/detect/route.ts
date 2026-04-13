import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { detectGames, type UploadedFile } from "@/lib/upload-detector";
import { readdir, stat } from "fs/promises";
import path from "path";

const UPLOAD_BASE = "/tmp/game-vault-uploads";

export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { sessionId, platform } = body as {
      sessionId?: string;
      platform?: string;
    };

    if (!sessionId || !platform) {
      return NextResponse.json(
        { error: "Missing required fields: sessionId, platform" },
        { status: 400 }
      );
    }

    // Path traversal prevention
    const sessionDir = path.resolve(UPLOAD_BASE, sessionId);
    if (!sessionDir.startsWith(UPLOAD_BASE + path.sep)) {
      return NextResponse.json(
        { error: "Invalid sessionId" },
        { status: 400 }
      );
    }

    const entries = await readdir(sessionDir);
    const files: UploadedFile[] = [];

    for (const entry of entries) {
      const filePath = path.join(sessionDir, entry);
      const fileStat = await stat(filePath);
      if (fileStat.isFile()) {
        files.push({
          name: entry,
          size: fileStat.size,
          path: filePath,
        });
      }
    }

    const games = detectGames(files, platform);

    return NextResponse.json({ games });
  } catch (err) {
    console.error("Detection failed:", err);
    return NextResponse.json(
      {
        error: `Detection failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      },
      { status: 500 }
    );
  }
}
