import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { randomUUID } from "crypto";
import { writeFile, mkdir, unlink, readdir, stat, rm } from "fs/promises";
import path from "path";
import { Open } from "unzipper";

const UPLOAD_BASE = "/tmp/ludotek-uploads";
const MAX_SESSION_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Remove upload sessions older than 24h. Runs in background, never throws. */
async function cleanupOldSessions() {
  try {
    const entries = await readdir(UPLOAD_BASE).catch(() => []);
    const now = Date.now();
    for (const entry of entries) {
      const sessionDir = path.join(UPLOAD_BASE, entry);
      try {
        const s = await stat(sessionDir);
        if (s.isDirectory() && now - s.mtimeMs > MAX_SESSION_AGE_MS) {
          await rm(sessionDir, { recursive: true, force: true });
        }
      } catch {
        // Skip entries we can't stat
      }
    }
  } catch {
    // Non-critical — cleanup is best-effort
  }
}

let lastCleanup = 0;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // At most once per hour

export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  // Best-effort cleanup of stale sessions (non-blocking, throttled, after auth)
  const now = Date.now();
  if (now - lastCleanup > CLEANUP_INTERVAL_MS) {
    lastCleanup = now;
    cleanupOldSessions();
  }

  try {
    const formData = await request.formData();
    const files = formData.getAll("files");

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    const sessionId = randomUUID();
    const sessionDir = path.join(UPLOAD_BASE, sessionId);
    await mkdir(sessionDir, { recursive: true });

    const savedFiles: { name: string; size: number; path: string }[] = [];

    for (const file of files) {
      if (!(file instanceof File)) {
        continue;
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      // Sanitize filename to prevent path traversal
      const safeName = path.basename(file.name);
      if (!safeName || safeName === "." || safeName === "..") continue;
      const filePath = path.join(sessionDir, safeName);
      await writeFile(filePath, buffer);

      if (safeName.toLowerCase().endsWith(".zip")) {
        // Extract ZIP contents, then remove the zip. Preserve the archive's
        // directory structure (sanitized against zip-slip) so entries that share
        // a basename across folders (e.g. disc1/track01.bin and disc2/track01.bin)
        // don't silently overwrite each other.
        const directory = await Open.file(filePath);
        for (const entry of directory.files) {
          if (entry.type !== "File") continue;
          const relParts = entry.path
            .split(/[/\\]/)
            .filter((p) => p && p !== "." && p !== "..");
          if (relParts.length === 0) continue;
          const relPath = relParts.join("/");
          const extractedPath = path.join(sessionDir, relPath);
          // Belt-and-suspenders: ensure the resolved path stays in the session dir
          if (!extractedPath.startsWith(sessionDir + path.sep)) continue;
          const content = await entry.buffer();
          await mkdir(path.dirname(extractedPath), { recursive: true });
          await writeFile(extractedPath, content);
          savedFiles.push({
            name: path.basename(relPath),
            size: content.length,
            path: extractedPath,
          });
        }
        await unlink(filePath);
      } else {
        savedFiles.push({
          name: safeName,
          size: buffer.length,
          path: filePath,
        });
      }
    }

    if (savedFiles.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    return NextResponse.json({ sessionId, files: savedFiles });
  } catch (err) {
    console.error("Upload failed:", err);
    return NextResponse.json(
      {
        error: `Upload failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      },
      { status: 500 }
    );
  }
}
