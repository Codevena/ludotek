import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { randomUUID } from "crypto";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import { Open } from "unzipper";

const UPLOAD_BASE = "/tmp/game-vault-uploads";

export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

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
      const filePath = path.join(sessionDir, safeName);
      await writeFile(filePath, buffer);

      if (safeName.toLowerCase().endsWith(".zip")) {
        // Extract ZIP contents, then remove the zip
        const directory = await Open.file(filePath);
        for (const entry of directory.files) {
          if (entry.type === "File") {
            const content = await entry.buffer();
            const extractedName = path.basename(entry.path);
            const extractedPath = path.join(sessionDir, extractedName);
            await writeFile(extractedPath, content);
            savedFiles.push({
              name: extractedName,
              size: content.length,
              path: extractedPath,
            });
          }
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
