# ROM Upload Feature — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upload ROMs via web UI to the Steam Deck with automatic CHD/RVZ conversion, multi-disc detection, and auto-enrichment.

**Architecture:** Three backend libs (upload-detector, converter, uploader) compose into a pipeline orchestrated by SSE-streaming API routes. The frontend is a dedicated `/admin/upload` page with dropzone, preview, and progress components. Files are uploaded to server temp storage, analyzed, optionally converted, then transferred via SFTP.

**Tech Stack:** Next.js 14 (App Router), TypeScript, ssh2 (already installed), unzipper (new dep), Tailwind CSS, Vitest for tests.

**Spec:** `docs/superpowers/specs/2026-04-13-rom-upload-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src/lib/upload-detector.ts` | Analyze files, group into games, detect multi-disc, determine conversion needs |
| `src/lib/converter.ts` | Wrap chdman/DolphinTool, parse progress from stderr |
| `src/lib/uploader.ts` | SFTP transfer to Steam Deck + M3U playlist generation |
| `src/app/api/upload/route.ts` | POST: multipart file upload to temp dir |
| `src/app/api/upload/detect/route.ts` | POST: analyze uploaded files, return detected games |
| `src/app/api/upload/process/route.ts` | POST: run pipeline (convert -> transfer -> scan -> enrich), SSE stream |
| `src/app/admin/upload/page.tsx` | Upload page with dropzone, preview, progress |
| `src/components/upload-dropzone.tsx` | Drag & drop zone + file/folder browse buttons |
| `src/components/upload-preview.tsx` | Detected games list with conversion indicators |
| `src/components/upload-progress.tsx` | Pipeline progress view with per-game status |
| `src/__tests__/upload-detector.test.ts` | Tests for detection engine |
| `src/__tests__/converter.test.ts` | Tests for converter |
| `src/__tests__/uploader.test.ts` | Tests for uploader (M3U generation) |

### Modified Files
| File | Change |
|------|--------|
| `package.json` | Add `unzipper` dependency |
| `src/app/admin/page.tsx` | Add "Upload ROMs" link/button |
| `Dockerfile` | Add `mame-tools` package |
| `docker-compose.yml` | Add `upload-temp` volume |

---

### Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install unzipper**

```bash
cd /Users/markus/Desktop/game-vault
pnpm add unzipper
pnpm add -D @types/unzipper
```

- [ ] **Step 2: Verify installation**

```bash
pnpm build
```

Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add unzipper dependency for ROM upload feature"
```

---

### Task 2: Upload Detection Engine

**Files:**
- Create: `src/lib/upload-detector.ts`
- Create: `src/__tests__/upload-detector.test.ts`

This is the core logic — pure functions, no I/O, highly testable.

- [ ] **Step 1: Write failing tests for single-ROM detection**

```ts
// src/__tests__/upload-detector.test.ts
import { describe, it, expect } from "vitest";
import { detectGames, type UploadedFile } from "@/lib/upload-detector";

describe("detectGames", () => {
  describe("single ROMs", () => {
    it("detects a single SNES ROM with no conversion", () => {
      const files: UploadedFile[] = [
        { name: "Super Mario World.sfc", size: 524288, path: "/tmp/uploads/session1/Super Mario World.sfc" },
      ];
      const result = detectGames(files, "snes");
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        title: "Super Mario World",
        type: "single",
        conversion: "none",
        files: [{ name: "Super Mario World.sfc", size: 524288 }],
      });
    });

    it("detects a single PSX ISO that needs CHD conversion", () => {
      const files: UploadedFile[] = [
        { name: "Crash Bandicoot.iso", size: 600000000, path: "/tmp/uploads/session1/Crash Bandicoot.iso" },
      ];
      const result = detectGames(files, "psx");
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        title: "Crash Bandicoot",
        type: "single",
        conversion: "chd",
      });
    });

    it("detects a GameCube ISO that needs RVZ conversion", () => {
      const files: UploadedFile[] = [
        { name: "Metroid Prime.iso", size: 1400000000, path: "/tmp/uploads/session1/Metroid Prime.iso" },
      ];
      const result = detectGames(files, "gc");
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        title: "Metroid Prime",
        type: "single",
        conversion: "rvz",
      });
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test src/__tests__/upload-detector.test.ts
```

Expected: FAIL — module `@/lib/upload-detector` does not exist.

- [ ] **Step 3: Implement single-ROM detection**

```ts
// src/lib/upload-detector.ts

export interface UploadedFile {
  name: string;
  size: number;
  path: string;
}

export interface DetectedGame {
  id: string;
  title: string;
  type: "single" | "multi-disc";
  discCount: number;
  files: { name: string; size: number; disc?: number; path: string }[];
  conversion: "none" | "chd" | "rvz";
  totalSize: number;
}

// Platforms where .bin+.cue / .iso / .gdi need CHD conversion
const CHD_PLATFORMS = new Set(["psx", "ps2", "dreamcast", "saturn", "segacd"]);
// Platforms where .iso needs RVZ conversion
const RVZ_PLATFORMS = new Set(["gc"]);

const CHD_EXTENSIONS = new Set([".bin", ".iso", ".cdi", ".gdi"]);
const CUE_LIKE = new Set([".cue", ".gdi"]);

// Matches (Disc 1), (Disk 2), (CD 3) etc.
const DISC_PATTERN = /\((?:Disc|Disk|CD)\s*(\d+)\)/i;

function getExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot >= 0 ? filename.slice(dot).toLowerCase() : "";
}

function stripExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot >= 0 ? filename.slice(0, dot) : filename;
}

function cleanTitle(filename: string): string {
  let name = stripExtension(filename);
  // Remove disc tags for grouping
  name = name.replace(DISC_PATTERN, "");
  // Remove region/version tags: (USA), (Europe), (v1.0), etc.
  name = name.replace(/\s*\([^)]*\)/g, "");
  // Remove bracket tags: [!], [b], etc.
  name = name.replace(/\s*\[[^\]]*\]/g, "");
  return name.trim();
}

function getDiscNumber(filename: string): number | undefined {
  const match = filename.match(DISC_PATTERN);
  return match ? parseInt(match[1], 10) : undefined;
}

function determineConversion(platform: string, files: UploadedFile[]): "none" | "chd" | "rvz" {
  const extensions = files.map((f) => getExtension(f.name));
  const hasConvertible = extensions.some((ext) => CHD_EXTENSIONS.has(ext) || CUE_LIKE.has(ext));

  if (RVZ_PLATFORMS.has(platform) && extensions.some((ext) => ext === ".iso")) {
    return "rvz";
  }
  if (CHD_PLATFORMS.has(platform) && hasConvertible) {
    return "chd";
  }
  return "none";
}

let idCounter = 0;

export function detectGames(files: UploadedFile[], platform: string): DetectedGame[] {
  // Group files by cleaned title
  const groups = new Map<string, { files: UploadedFile[]; discs: Map<number, UploadedFile[]> }>();

  for (const file of files) {
    const ext = getExtension(file.name);
    // Skip metadata files
    if ([".txt", ".xml", ".json", ".png", ".jpg", ".log", ".sub", ".idx", ".sbi"].includes(ext)) {
      continue;
    }

    const title = cleanTitle(file.name);
    if (!title) continue;

    if (!groups.has(title)) {
      groups.set(title, { files: [], discs: new Map() });
    }
    const group = groups.get(title)!;
    group.files.push(file);

    const discNum = getDiscNumber(file.name);
    if (discNum !== undefined) {
      if (!group.discs.has(discNum)) {
        group.discs.set(discNum, []);
      }
      group.discs.get(discNum)!.push(file);
    }
  }

  const games: DetectedGame[] = [];

  for (const [title, group] of groups) {
    const isMultiDisc = group.discs.size > 1;
    const discCount = isMultiDisc ? group.discs.size : 1;
    const conversion = determineConversion(platform, group.files);
    const totalSize = group.files.reduce((sum, f) => sum + f.size, 0);

    idCounter++;
    games.push({
      id: `temp-${idCounter}`,
      title,
      type: isMultiDisc ? "multi-disc" : "single",
      discCount,
      files: group.files.map((f) => ({
        name: f.name,
        size: f.size,
        disc: getDiscNumber(f.name),
        path: f.path,
      })),
      conversion,
      totalSize,
    });
  }

  return games;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test src/__tests__/upload-detector.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 5: Write failing tests for multi-disc detection**

Add to `src/__tests__/upload-detector.test.ts`:

```ts
  describe("multi-disc games", () => {
    it("groups bin+cue pairs into multi-disc game", () => {
      const files: UploadedFile[] = [
        { name: "FF9 (Disc 1).bin", size: 540000000, path: "/tmp/u/FF9 (Disc 1).bin" },
        { name: "FF9 (Disc 1).cue", size: 120, path: "/tmp/u/FF9 (Disc 1).cue" },
        { name: "FF9 (Disc 2).bin", size: 520000000, path: "/tmp/u/FF9 (Disc 2).bin" },
        { name: "FF9 (Disc 2).cue", size: 120, path: "/tmp/u/FF9 (Disc 2).cue" },
        { name: "FF9 (Disc 3).bin", size: 510000000, path: "/tmp/u/FF9 (Disc 3).bin" },
        { name: "FF9 (Disc 3).cue", size: 120, path: "/tmp/u/FF9 (Disc 3).cue" },
        { name: "FF9 (Disc 4).bin", size: 500000000, path: "/tmp/u/FF9 (Disc 4).bin" },
        { name: "FF9 (Disc 4).cue", size: 120, path: "/tmp/u/FF9 (Disc 4).cue" },
      ];
      const result = detectGames(files, "psx");
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        title: "FF9",
        type: "multi-disc",
        discCount: 4,
        conversion: "chd",
      });
      expect(result[0].files).toHaveLength(8);
    });

    it("detects Disk and CD variants", () => {
      const files: UploadedFile[] = [
        { name: "Game (Disk 1).bin", size: 500000000, path: "/tmp/u/Game (Disk 1).bin" },
        { name: "Game (Disk 1).cue", size: 100, path: "/tmp/u/Game (Disk 1).cue" },
        { name: "Game (Disk 2).bin", size: 500000000, path: "/tmp/u/Game (Disk 2).bin" },
        { name: "Game (Disk 2).cue", size: 100, path: "/tmp/u/Game (Disk 2).cue" },
      ];
      const result = detectGames(files, "psx");
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("multi-disc");
      expect(result[0].discCount).toBe(2);
    });

    it("separates different games into different groups", () => {
      const files: UploadedFile[] = [
        { name: "GameA (Disc 1).bin", size: 500000000, path: "/tmp/u/GameA (Disc 1).bin" },
        { name: "GameA (Disc 1).cue", size: 100, path: "/tmp/u/GameA (Disc 1).cue" },
        { name: "GameA (Disc 2).bin", size: 500000000, path: "/tmp/u/GameA (Disc 2).bin" },
        { name: "GameA (Disc 2).cue", size: 100, path: "/tmp/u/GameA (Disc 2).cue" },
        { name: "GameB.iso", size: 700000000, path: "/tmp/u/GameB.iso" },
      ];
      const result = detectGames(files, "psx");
      expect(result).toHaveLength(2);
      const gameA = result.find((g) => g.title === "GameA");
      const gameB = result.find((g) => g.title === "GameB");
      expect(gameA?.type).toBe("multi-disc");
      expect(gameB?.type).toBe("single");
    });
  });

  describe("edge cases", () => {
    it("skips metadata files", () => {
      const files: UploadedFile[] = [
        { name: "Game.sfc", size: 524288, path: "/tmp/u/Game.sfc" },
        { name: "metadata.txt", size: 100, path: "/tmp/u/metadata.txt" },
        { name: "cover.png", size: 50000, path: "/tmp/u/cover.png" },
      ];
      const result = detectGames(files, "snes");
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("Game");
    });

    it("returns empty array for no valid files", () => {
      const files: UploadedFile[] = [
        { name: "readme.txt", size: 100, path: "/tmp/u/readme.txt" },
      ];
      const result = detectGames(files, "snes");
      expect(result).toHaveLength(0);
    });
  });
```

- [ ] **Step 6: Run tests**

```bash
pnpm test src/__tests__/upload-detector.test.ts
```

Expected: All tests pass (the implementation from Step 3 already handles these cases).

- [ ] **Step 7: Commit**

```bash
git add src/lib/upload-detector.ts src/__tests__/upload-detector.test.ts
git commit -m "feat: add upload detection engine with multi-disc grouping"
```

---

### Task 3: Converter Module

**Files:**
- Create: `src/lib/converter.ts`
- Create: `src/__tests__/converter.test.ts`

Wraps chdman and DolphinTool CLI commands with progress parsing.

- [ ] **Step 1: Write failing test for progress parsing**

```ts
// src/__tests__/converter.test.ts
import { describe, it, expect } from "vitest";
import { parseChdmanProgress } from "@/lib/converter";

describe("parseChdmanProgress", () => {
  it("extracts percentage from chdman output", () => {
    expect(parseChdmanProgress("Compressing, 45.2% complete...")).toBe(45.2);
  });

  it("extracts 100% from done output", () => {
    expect(parseChdmanProgress("Compressing, 100.0% complete... (ratio=55.2%)")).toBe(100.0);
  });

  it("returns null for non-progress output", () => {
    expect(parseChdmanProgress("chdman - MAME Compressed Hunks of Data")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseChdmanProgress("")).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test src/__tests__/converter.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement converter**

```ts
// src/lib/converter.ts
import { spawn } from "child_process";

export interface ConvertJob {
  inputPath: string;
  outputPath: string;
  format: "chd" | "rvz";
  onProgress?: (percent: number) => void;
}

const CHDMAN_PROGRESS_RE = /Compressing,\s+([\d.]+)%\s+complete/;

export function parseChdmanProgress(line: string): number | null {
  const match = line.match(CHDMAN_PROGRESS_RE);
  return match ? parseFloat(match[1]) : null;
}

function getConvertCommand(job: ConvertJob): { cmd: string; args: string[] } {
  if (job.format === "chd") {
    return {
      cmd: "chdman",
      args: ["createcd", "-i", job.inputPath, "-o", job.outputPath],
    };
  }
  // rvz via DolphinTool
  return {
    cmd: "DolphinTool",
    args: ["convert", "-i", job.inputPath, "-o", job.outputPath, "-f", "rvz", "-b", "131072", "-c", "zstd", "-l", "5"],
  };
}

export async function convert(job: ConvertJob): Promise<void> {
  const { cmd, args } = getConvertCommand(job);

  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args);
    let stderr = "";

    proc.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stderr += text;

      if (job.onProgress) {
        // chdman outputs progress on stderr, line by line
        const lines = text.split("\r");
        for (const line of lines) {
          const pct = parseChdmanProgress(line);
          if (pct !== null) {
            job.onProgress(pct);
          }
        }
      }
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${cmd} exited with code ${code}: ${stderr.slice(-500)}`));
      }
    });

    proc.on("error", (err) => {
      reject(new Error(`Failed to start ${cmd}: ${err.message}`));
    });
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test src/__tests__/converter.test.ts
```

Expected: All 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/converter.ts src/__tests__/converter.test.ts
git commit -m "feat: add CHD/RVZ converter with progress parsing"
```

---

### Task 4: Uploader Module (SFTP + M3U)

**Files:**
- Create: `src/lib/uploader.ts`
- Create: `src/__tests__/uploader.test.ts`

SFTP transfer using ssh2 (already in project) and M3U playlist generation.

- [ ] **Step 1: Write failing tests for M3U generation**

```ts
// src/__tests__/uploader.test.ts
import { describe, it, expect } from "vitest";
import { generateM3u, getTransferPath } from "@/lib/uploader";

describe("generateM3u", () => {
  it("generates M3U with EmuVirtual paths for PSX", () => {
    const result = generateM3u("Final Fantasy IX", "psx", [
      "Final Fantasy IX (Disc 1).chd",
      "Final Fantasy IX (Disc 2).chd",
      "Final Fantasy IX (Disc 3).chd",
      "Final Fantasy IX (Disc 4).chd",
    ]);
    expect(result).toBe(
      "/home/deck/EmuVirtual/Emulation/roms/psx-multidisc/Final Fantasy IX (Disc 1).chd\n" +
      "/home/deck/EmuVirtual/Emulation/roms/psx-multidisc/Final Fantasy IX (Disc 2).chd\n" +
      "/home/deck/EmuVirtual/Emulation/roms/psx-multidisc/Final Fantasy IX (Disc 3).chd\n" +
      "/home/deck/EmuVirtual/Emulation/roms/psx-multidisc/Final Fantasy IX (Disc 4).chd\n"
    );
  });

  it("uses direct SD path for Saturn", () => {
    const result = generateM3u("Panzer Dragoon Saga", "saturn", [
      "Panzer Dragoon Saga (Disc 1).chd",
      "Panzer Dragoon Saga (Disc 2).chd",
    ]);
    expect(result).toContain("/run/media/deck/SD/Emulation/roms/saturn-multidisc/");
    expect(result).not.toContain("EmuVirtual");
  });
});

describe("getTransferPath", () => {
  it("returns multidisc path for multi-disc games", () => {
    expect(getTransferPath("psx", true)).toBe(
      "/run/media/deck/SD/Emulation/roms/psx-multidisc/"
    );
  });

  it("returns standard path for single ROMs", () => {
    expect(getTransferPath("snes", false)).toBe(
      "/run/media/deck/SD/Emulation/roms/snes/"
    );
  });

  it("returns platform base path for M3U files", () => {
    expect(getTransferPath("psx", false)).toBe(
      "/run/media/deck/SD/Emulation/roms/psx/"
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test src/__tests__/uploader.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement uploader**

```ts
// src/lib/uploader.ts
import { Client } from "ssh2";

const ROM_BASE = "/run/media/deck/SD/Emulation/roms";

// EmuVirtual symlink base path used by EmuDeck for M3U playlists
const EMUVIRTUAL_BASE = "/home/deck/EmuVirtual/Emulation/roms";

// Saturn uses direct SD path instead of EmuVirtual
const DIRECT_SD_PLATFORMS = new Set(["saturn"]);

export function getTransferPath(platform: string, isMultiDisc: boolean): string {
  const suffix = isMultiDisc ? `-multidisc` : "";
  return `${ROM_BASE}/${platform}${suffix}/`;
}

function getM3uBasePath(platform: string): string {
  if (DIRECT_SD_PLATFORMS.has(platform)) {
    return `${ROM_BASE}/${platform}-multidisc/`;
  }
  return `${EMUVIRTUAL_BASE}/${platform}-multidisc/`;
}

export function generateM3u(title: string, platform: string, discFilenames: string[]): string {
  const basePath = getM3uBasePath(platform);
  return discFilenames.map((f) => `${basePath}${f}\n`).join("");
}

export interface TransferJob {
  localPath: string;
  remotePath: string;
  onProgress?: (bytesTransferred: number, totalBytes: number) => void;
}

function sftpMkdir(sftp: import("ssh2").SFTPWrapper, dir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    sftp.mkdir(dir, (err) => {
      if (err && (err as NodeJS.ErrnoException).code !== "FAILURE") {
        // FAILURE usually means dir already exists
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

function sftpWrite(sftp: import("ssh2").SFTPWrapper, remotePath: string, content: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const stream = sftp.createWriteStream(remotePath);
    stream.on("close", resolve);
    stream.on("error", reject);
    stream.end(content);
  });
}

function sftpTransferFile(
  sftp: import("ssh2").SFTPWrapper,
  localPath: string,
  remotePath: string,
  onProgress?: (bytes: number, total: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const readStream = require("fs").createReadStream(localPath);
    const writeStream = sftp.createWriteStream(remotePath);

    let transferred = 0;
    const stat = require("fs").statSync(localPath);
    const totalBytes = stat.size;

    readStream.on("data", (chunk: Buffer) => {
      transferred += chunk.length;
      onProgress?.(transferred, totalBytes);
    });

    writeStream.on("close", resolve);
    writeStream.on("error", reject);
    readStream.on("error", reject);

    readStream.pipe(writeStream);
  });
}

export async function transferFiles(
  host: string,
  user: string,
  password: string,
  jobs: TransferJob[]
): Promise<void> {
  const conn = new Client();

  return new Promise((resolve, reject) => {
    conn.on("ready", () => {
      conn.sftp(async (err, sftp) => {
        if (err) { conn.end(); return reject(err); }

        try {
          // Ensure remote directories exist
          const dirs = new Set(jobs.map((j) => j.remotePath.slice(0, j.remotePath.lastIndexOf("/") + 1)));
          for (const dir of dirs) {
            await sftpMkdir(sftp, dir).catch(() => {}); // ignore if exists
          }

          for (const job of jobs) {
            await sftpTransferFile(sftp, job.localPath, job.remotePath, job.onProgress);
          }

          conn.end();
          resolve();
        } catch (transferErr) {
          conn.end();
          reject(transferErr);
        }
      });
    });

    conn.on("error", reject);
    conn.connect({ host, port: 22, username: user, password });
  });
}

export async function transferM3u(
  host: string,
  user: string,
  password: string,
  m3uFilename: string,
  m3uContent: string,
  platform: string
): Promise<void> {
  const conn = new Client();
  const remotePath = `${getTransferPath(platform, false)}${m3uFilename}`;

  return new Promise((resolve, reject) => {
    conn.on("ready", () => {
      conn.sftp(async (err, sftp) => {
        if (err) { conn.end(); return reject(err); }
        try {
          await sftpWrite(sftp, remotePath, m3uContent);
          conn.end();
          resolve();
        } catch (writeErr) {
          conn.end();
          reject(writeErr);
        }
      });
    });

    conn.on("error", reject);
    conn.connect({ host, port: 22, username: user, password });
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test src/__tests__/uploader.test.ts
```

Expected: All 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/uploader.ts src/__tests__/uploader.test.ts
git commit -m "feat: add SFTP uploader with M3U playlist generation"
```

---

### Task 5: File Upload API Route

**Files:**
- Create: `src/app/api/upload/route.ts`

Handles multipart file upload to temp directory. Extracts ZIPs server-side.

- [ ] **Step 1: Implement the upload route**

```ts
// src/app/api/upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import { randomUUID } from "crypto";
import { createReadStream } from "fs";
import { Open } from "unzipper";
import path from "path";

const UPLOAD_BASE = "/tmp/game-vault-uploads";

export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  try {
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    if (files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    const sessionId = randomUUID();
    const sessionDir = path.join(UPLOAD_BASE, sessionId);
    await mkdir(sessionDir, { recursive: true });

    const savedFiles: { name: string; size: number; path: string }[] = [];

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const ext = path.extname(file.name).toLowerCase();

      if (ext === ".zip") {
        // Extract ZIP contents into session dir
        const zipPath = path.join(sessionDir, file.name);
        await writeFile(zipPath, buffer);

        const directory = await Open.file(zipPath);
        for (const entry of directory.files) {
          if (entry.type === "File") {
            const entryName = path.basename(entry.path);
            const entryPath = path.join(sessionDir, entryName);
            const content = await entry.buffer();
            await writeFile(entryPath, content);
            savedFiles.push({ name: entryName, size: content.length, path: entryPath });
          }
        }

        // Remove the zip after extraction
        const { unlink } = await import("fs/promises");
        await unlink(zipPath);
      } else {
        const filePath = path.join(sessionDir, file.name);
        await writeFile(filePath, buffer);
        savedFiles.push({ name: file.name, size: buffer.length, path: filePath });
      }
    }

    return NextResponse.json({ sessionId, files: savedFiles });
  } catch (err) {
    console.error("Upload failed:", err);
    return NextResponse.json(
      { error: `Upload failed: ${err instanceof Error ? err.message : "Unknown error"}` },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Verify type-check passes**

```bash
pnpm build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/upload/route.ts
git commit -m "feat: add file upload API route with ZIP extraction"
```

---

### Task 6: Detection API Route

**Files:**
- Create: `src/app/api/upload/detect/route.ts`

Calls the detection engine on uploaded session files.

- [ ] **Step 1: Implement the detect route**

```ts
// src/app/api/upload/detect/route.ts
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
    const { sessionId, platform } = await request.json();

    if (!sessionId || !platform) {
      return NextResponse.json({ error: "sessionId and platform are required" }, { status: 400 });
    }

    const sessionDir = path.join(UPLOAD_BASE, sessionId);

    // Security: prevent path traversal
    if (!sessionDir.startsWith(UPLOAD_BASE)) {
      return NextResponse.json({ error: "Invalid sessionId" }, { status: 400 });
    }

    const entries = await readdir(sessionDir);
    const files: UploadedFile[] = [];

    for (const entry of entries) {
      const filePath = path.join(sessionDir, entry);
      const fileStat = await stat(filePath);
      if (fileStat.isFile()) {
        files.push({ name: entry, size: fileStat.size, path: filePath });
      }
    }

    const games = detectGames(files, platform);

    return NextResponse.json({ games });
  } catch (err) {
    console.error("Detection failed:", err);
    return NextResponse.json(
      { error: `Detection failed: ${err instanceof Error ? err.message : "Unknown error"}` },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Verify type-check passes**

```bash
pnpm build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/upload/detect/route.ts
git commit -m "feat: add game detection API route"
```

---

### Task 7: Processing Pipeline API Route (SSE)

**Files:**
- Create: `src/app/api/upload/process/route.ts`

Orchestrates the full pipeline: convert -> transfer -> scan -> enrich. Streams progress via SSE following the existing pattern from `/api/enrich/route.ts`.

- [ ] **Step 1: Implement the pipeline route**

```ts
// src/app/api/upload/process/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { detectGames } from "@/lib/upload-detector";
import { convert } from "@/lib/converter";
import { transferFiles, generateM3u, getTransferPath, transferM3u } from "@/lib/uploader";
import { searchIgdb } from "@/lib/igdb";
import { searchSteamGridDb } from "@/lib/steamgriddb";
import { readdir, stat, rm } from "fs/promises";
import path from "path";

const UPLOAD_BASE = "/tmp/game-vault-uploads";

interface ProcessRequest {
  sessionId: string;
  platform: string;
  gameIds: string[];
}

export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  let body: ProcessRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { sessionId, platform, gameIds } = body;
  if (!sessionId || !platform || !gameIds?.length) {
    return NextResponse.json({ error: "sessionId, platform, and gameIds are required" }, { status: 400 });
  }

  const sessionDir = path.join(UPLOAD_BASE, sessionId);
  if (!sessionDir.startsWith(UPLOAD_BASE)) {
    return NextResponse.json({ error: "Invalid sessionId" }, { status: 400 });
  }

  const settings = await prisma.settings.findFirst({ where: { id: 1 } });
  if (!settings?.deckHost || !settings?.deckUser) {
    return NextResponse.json({ error: "Steam Deck SSH not configured" }, { status: 400 });
  }

  // Re-detect games from session files
  const entries = await readdir(sessionDir);
  const uploadedFiles = [];
  for (const entry of entries) {
    const filePath = path.join(sessionDir, entry);
    const fileStat = await stat(filePath);
    if (fileStat.isFile()) {
      uploadedFiles.push({ name: entry, size: fileStat.size, path: filePath });
    }
  }

  const allGames = detectGames(uploadedFiles, platform);
  const games = allGames.filter((g) => gameIds.includes(g.id));

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        try {
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // Stream closed
        }
      };

      send({ type: "start", totalGames: games.length });

      let succeeded = 0;
      let failed = 0;

      for (const game of games) {
        if (request.signal.aborted) break;

        try {
          // --- STEP 1: Convert ---
          send({ type: "game-start", gameId: game.id, title: game.title, step: "convert" });

          const convertedPaths: string[] = [];

          if (game.conversion !== "none") {
            // Find cue/gdi files (these are the input for chdman)
            // For single ISOs, use the ISO directly
            const inputFiles = game.files.filter((f) => {
              const ext = path.extname(f.name).toLowerCase();
              if (game.conversion === "chd") {
                return ext === ".cue" || ext === ".gdi" || ext === ".iso";
              }
              return ext === ".iso"; // rvz
            });

            for (const inputFile of inputFiles) {
              const baseName = path.basename(inputFile.name, path.extname(inputFile.name));
              const outExt = game.conversion === "chd" ? ".chd" : ".rvz";
              const outputPath = path.join(sessionDir, baseName + outExt);

              send({ type: "convert-progress", gameId: game.id, file: inputFile.name, percent: 0 });

              await convert({
                inputPath: inputFile.path,
                outputPath,
                format: game.conversion,
                onProgress: (pct) => {
                  send({ type: "convert-progress", gameId: game.id, file: inputFile.name, percent: Math.round(pct) });
                },
              });

              convertedPaths.push(outputPath);
              send({ type: "convert-done", gameId: game.id, file: inputFile.name });
            }
          }

          // --- STEP 2: Transfer ---
          send({ type: "game-step", gameId: game.id, step: "transfer" });

          const isMultiDisc = game.type === "multi-disc";
          const remoteDir = getTransferPath(platform, isMultiDisc);

          // Determine which files to transfer
          const filesToTransfer = convertedPaths.length > 0
            ? convertedPaths.map((p) => ({ localPath: p, remotePath: remoteDir + path.basename(p) }))
            : game.files.map((f) => ({ localPath: f.path, remotePath: remoteDir + f.name }));

          await transferFiles(
            settings.deckHost,
            settings.deckUser,
            settings.deckPassword,
            filesToTransfer.map((f) => ({
              ...f,
              onProgress: (bytes, total) => {
                send({ type: "transfer-progress", gameId: game.id, percent: Math.round((bytes / total) * 100) });
              },
            }))
          );

          // M3U for multi-disc games
          if (isMultiDisc) {
            const discFiles = filesToTransfer
              .map((f) => path.basename(f.remotePath))
              .sort();
            const m3uContent = generateM3u(game.title, platform, discFiles);
            const m3uFilename = `${game.title}.m3u`;
            await transferM3u(settings.deckHost, settings.deckUser, settings.deckPassword, m3uFilename, m3uContent, platform);
          }

          // --- STEP 3: Scan (add to DB) ---
          send({ type: "game-step", gameId: game.id, step: "scan" });

          const platformConfig = (await import("@/lib/platforms")).PLATFORM_CONFIG;
          const platDef = platformConfig.find((p) => p.id === platform);
          const platformLabel = platDef?.label || platform;

          const transferredFileName = filesToTransfer.length > 0
            ? path.basename(filesToTransfer[0].remotePath)
            : game.files[0].name;

          const dbGame = await prisma.game.upsert({
            where: {
              originalFile_platform: {
                originalFile: transferredFileName,
                platform,
              },
            },
            update: { title: game.title },
            create: {
              title: game.title,
              originalFile: transferredFileName,
              platform,
              platformLabel,
              source: "rom",
            },
          });

          // Update platform game counts
          const count = await prisma.game.count({ where: { platform } });
          await prisma.platform.upsert({
            where: { id: platform },
            update: { gameCount: count },
            create: {
              id: platform,
              label: platformLabel,
              icon: platDef?.icon || "🎮",
              color: platDef?.color || "#6366f1",
              gameCount: count,
              sortOrder: platDef?.sortOrder || 99,
            },
          });

          // --- STEP 4: Enrich ---
          send({ type: "game-step", gameId: game.id, step: "enrich" });

          let coverUrl: string | null = null;
          if (settings.igdbClientId && settings.igdbClientSecret) {
            try {
              const igdbData = await searchIgdb(game.title, platform, settings.igdbClientId, settings.igdbClientSecret);
              if (igdbData) {
                coverUrl = igdbData.coverUrl;
                if (!coverUrl && settings.steamgriddbKey) {
                  coverUrl = await searchSteamGridDb(game.title, settings.steamgriddbKey);
                }
                await prisma.game.update({
                  where: { id: dbGame.id },
                  data: {
                    igdbId: igdbData.igdbId,
                    coverUrl,
                    igdbScore: igdbData.igdbScore,
                    metacriticScore: igdbData.metacriticScore,
                    genres: JSON.stringify(igdbData.genres),
                    developer: igdbData.developer,
                    publisher: igdbData.publisher,
                    releaseDate: igdbData.releaseDate,
                    summary: igdbData.summary,
                    screenshotUrls: JSON.stringify(igdbData.screenshotUrls),
                  },
                });
              }
            } catch (err) {
              console.warn(`IGDB enrichment failed for "${game.title}":`, err);
              // Non-fatal — game is still uploaded
            }
          }

          send({
            type: "game-done",
            gameId: game.id,
            dbId: dbGame.id,
            title: game.title,
            coverUrl,
          });
          succeeded++;
        } catch (err) {
          console.error(`Pipeline failed for "${game.title}":`, err);
          send({
            type: "game-error",
            gameId: game.id,
            title: game.title,
            error: err instanceof Error ? err.message : "Unknown error",
          });
          failed++;
        }
      }

      // Cleanup temp files
      try {
        await rm(sessionDir, { recursive: true, force: true });
      } catch {
        console.warn(`Failed to clean up ${sessionDir}`);
      }

      send({ type: "done", processed: games.length, succeeded, failed });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

- [ ] **Step 2: Verify type-check passes**

```bash
pnpm build
```

Expected: Build succeeds. Fix any type errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/upload/process/route.ts
git commit -m "feat: add upload processing pipeline with SSE progress streaming"
```

---

### Task 8: Upload Dropzone Component

**Files:**
- Create: `src/components/upload-dropzone.tsx`

Drag & drop zone with file/folder browse buttons.

- [ ] **Step 1: Implement the dropzone component**

```tsx
// src/components/upload-dropzone.tsx
"use client";

import { useState, useRef, useCallback } from "react";

interface UploadDropzoneProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
}

export default function UploadDropzone({ onFilesSelected, disabled }: UploadDropzoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (disabled) return;

      const items = e.dataTransfer.items;
      const files: File[] = [];

      // Collect all files (including from folders)
      const promises: Promise<void>[] = [];
      for (let i = 0; i < items.length; i++) {
        const entry = items[i].webkitGetAsEntry?.();
        if (entry) {
          promises.push(traverseEntry(entry, files));
        } else {
          const file = items[i].getAsFile();
          if (file) files.push(file);
        }
      }

      Promise.all(promises).then(() => {
        if (files.length > 0) onFilesSelected(files);
      });
    },
    [onFilesSelected, disabled]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (fileList && fileList.length > 0) {
      onFilesSelected(Array.from(fileList));
    }
    e.target.value = "";
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-all duration-200
        ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
        ${dragOver ? "border-vault-amber bg-vault-amber/5" : "border-vault-border hover:border-vault-muted"}`}
    >
      <div className="space-y-4">
        <div className="text-4xl">
          {dragOver ? "📂" : "🎮"}
        </div>
        <div>
          <p className="text-vault-text font-medium">
            {dragOver ? "Drop files here" : "Drag & drop ROMs here"}
          </p>
          <p className="text-vault-muted text-sm mt-1">
            Single files, ZIP archives, or entire folders
          </p>
        </div>
        <div className="flex gap-3 justify-center">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="px-4 py-2 bg-vault-surface border border-vault-border rounded-lg text-sm text-vault-text hover:border-vault-amber transition-colors disabled:opacity-50"
          >
            Browse Files
          </button>
          <button
            type="button"
            onClick={() => folderInputRef.current?.click()}
            disabled={disabled}
            className="px-4 py-2 bg-vault-surface border border-vault-border rounded-lg text-sm text-vault-text hover:border-vault-amber transition-colors disabled:opacity-50"
          >
            Browse Folder
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="*"
        onChange={handleFileChange}
        className="hidden"
      />
      {/* @ts-expect-error webkitdirectory is not in React types */}
      <input
        ref={folderInputRef}
        type="file"
        webkitdirectory=""
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}

async function traverseEntry(entry: FileSystemEntry, files: File[]): Promise<void> {
  if (entry.isFile) {
    const file = await new Promise<File>((resolve) =>
      (entry as FileSystemFileEntry).file(resolve)
    );
    files.push(file);
  } else if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    const entries = await new Promise<FileSystemEntry[]>((resolve) =>
      reader.readEntries(resolve)
    );
    await Promise.all(entries.map((e) => traverseEntry(e, files)));
  }
}
```

- [ ] **Step 2: Verify type-check passes**

```bash
pnpm build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/upload-dropzone.tsx
git commit -m "feat: add drag & drop upload dropzone component"
```

---

### Task 9: Upload Preview Component

**Files:**
- Create: `src/components/upload-preview.tsx`

Shows detected games with conversion indicators and disc counts.

- [ ] **Step 1: Implement the preview component**

```tsx
// src/components/upload-preview.tsx
"use client";

import type { DetectedGame } from "@/lib/upload-detector";

interface UploadPreviewProps {
  games: DetectedGame[];
  onConfirm: (gameIds: string[]) => void;
  disabled?: boolean;
}

function formatSize(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(0)} MB`;
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(0)} KB`;
  return `${bytes} B`;
}

function conversionLabel(conversion: string): { text: string; color: string } {
  switch (conversion) {
    case "chd":
      return { text: "Will convert to .chd", color: "text-blue-400" };
    case "rvz":
      return { text: "Will convert to .rvz", color: "text-purple-400" };
    default:
      return { text: "No conversion needed", color: "text-vault-muted" };
  }
}

export default function UploadPreview({ games, onConfirm, disabled }: UploadPreviewProps) {
  const totalSize = games.reduce((sum, g) => sum + g.totalSize, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-lg font-bold text-vault-text">
          Detected Games ({games.length})
        </h3>
        <span className="text-vault-muted text-sm">
          Total: {formatSize(totalSize)}
        </span>
      </div>

      <div className="space-y-2">
        {games.map((game) => {
          const conv = conversionLabel(game.conversion);
          return (
            <div key={game.id} className="card flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-vault-text font-medium truncate">{game.title}</span>
                  {game.type === "multi-disc" && (
                    <span className="px-2 py-0.5 bg-vault-amber/20 text-vault-amber text-xs rounded-full font-medium shrink-0">
                      {game.discCount} Discs
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs">
                  <span className={conv.color}>{conv.text}</span>
                  <span className="text-vault-muted">{formatSize(game.totalSize)}</span>
                  {game.type === "multi-disc" && (
                    <span className="text-vault-muted">{game.files.length} files</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={() => onConfirm(games.map((g) => g.id))}
        disabled={disabled || games.length === 0}
        className="w-full px-6 py-3 rounded-lg font-medium text-sm bg-vault-amber text-black hover:bg-vault-amber-hover transition-all disabled:opacity-50"
      >
        Upload to Steam Deck ({formatSize(totalSize)})
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Verify type-check passes**

```bash
pnpm build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/upload-preview.tsx
git commit -m "feat: add upload preview component with game detection display"
```

---

### Task 10: Upload Progress Component

**Files:**
- Create: `src/components/upload-progress.tsx`

Real-time pipeline progress view — per-game status, current phase, overall progress.

- [ ] **Step 1: Implement the progress component**

```tsx
// src/components/upload-progress.tsx
"use client";

import Link from "next/link";

export interface GameProgress {
  gameId: string;
  title: string;
  status: "queued" | "processing" | "done" | "failed";
  step?: "convert" | "transfer" | "scan" | "enrich";
  convertPercent?: number;
  transferPercent?: number;
  error?: string;
  dbId?: number;
  coverUrl?: string | null;
}

interface UploadProgressProps {
  games: GameProgress[];
  totalGames: number;
  isComplete: boolean;
  succeeded: number;
  failed: number;
}

const STEPS = ["convert", "transfer", "scan", "enrich"] as const;

function stepLabel(step: string): string {
  switch (step) {
    case "convert": return "Converting";
    case "transfer": return "Transferring";
    case "scan": return "Scanning";
    case "enrich": return "Enriching";
    default: return step;
  }
}

function StatusIcon({ status }: { status: GameProgress["status"] }) {
  switch (status) {
    case "done": return <span className="text-green-400">&#10003;</span>;
    case "processing": return <span className="w-3 h-3 rounded-full bg-vault-amber animate-pulse inline-block" />;
    case "failed": return <span className="text-red-400">&#10007;</span>;
    default: return <span className="text-vault-muted">&#8943;</span>;
  }
}

export default function UploadProgress({ games, totalGames, isComplete, succeeded, failed }: UploadProgressProps) {
  const completedCount = games.filter((g) => g.status === "done" || g.status === "failed").length;
  const overallPercent = totalGames > 0 ? Math.round((completedCount / totalGames) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Overall progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-vault-text font-medium">
            {isComplete ? "Upload Complete" : "Uploading to Steam Deck..."}
          </span>
          <span className="text-vault-muted">
            {completedCount}/{totalGames} games
          </span>
        </div>
        <div className="w-full bg-vault-bg rounded-full h-3 overflow-hidden">
          <div
            className="h-full bg-vault-amber rounded-full transition-all duration-500"
            style={{ width: `${overallPercent}%` }}
          />
        </div>
      </div>

      {/* Per-game status */}
      <div className="space-y-2">
        {games.map((game) => (
          <div key={game.gameId} className={`card transition-all ${game.status === "processing" ? "border-vault-amber/50" : ""}`}>
            <div className="flex items-center gap-3">
              <StatusIcon status={game.status} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-vault-text text-sm font-medium truncate">{game.title}</span>
                  {game.step && game.status === "processing" && (
                    <span className="text-vault-amber text-xs font-medium shrink-0">
                      {stepLabel(game.step)}
                    </span>
                  )}
                </div>

                {/* Pipeline phase indicators */}
                {game.status === "processing" && (
                  <div className="flex gap-1 mt-2">
                    {STEPS.map((s) => {
                      const isActive = game.step === s;
                      const isDone = STEPS.indexOf(s) < STEPS.indexOf(game.step || "convert");
                      return (
                        <div
                          key={s}
                          className={`h-1 flex-1 rounded-full transition-all ${
                            isActive ? "bg-vault-amber" : isDone ? "bg-green-500" : "bg-vault-border"
                          }`}
                        />
                      );
                    })}
                  </div>
                )}

                {/* Convert/transfer sub-progress */}
                {game.status === "processing" && game.step === "convert" && game.convertPercent !== undefined && (
                  <div className="mt-1">
                    <div className="w-full bg-vault-bg rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all duration-200"
                        style={{ width: `${game.convertPercent}%` }}
                      />
                    </div>
                    <span className="text-vault-muted text-xs">{game.convertPercent}%</span>
                  </div>
                )}
                {game.status === "processing" && game.step === "transfer" && game.transferPercent !== undefined && (
                  <div className="mt-1">
                    <div className="w-full bg-vault-bg rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full transition-all duration-200"
                        style={{ width: `${game.transferPercent}%` }}
                      />
                    </div>
                    <span className="text-vault-muted text-xs">{game.transferPercent}%</span>
                  </div>
                )}

                {/* Error message */}
                {game.error && (
                  <p className="text-red-400 text-xs mt-1">{game.error}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Completion summary */}
      {isComplete && (
        <div className="card border-green-500/30 space-y-3">
          <div className="flex gap-4 text-sm">
            <span className="text-green-400">{succeeded} succeeded</span>
            {failed > 0 && <span className="text-red-400">{failed} failed</span>}
          </div>
          <div className="flex gap-3">
            <Link href="/" className="px-4 py-2 bg-vault-amber text-black rounded-lg text-sm font-medium hover:bg-vault-amber-hover transition-all">
              View Library
            </Link>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-vault-surface border border-vault-border rounded-lg text-sm text-vault-text hover:border-vault-amber transition-colors"
            >
              Upload More
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify type-check passes**

```bash
pnpm build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/upload-progress.tsx
git commit -m "feat: add upload progress component with pipeline visualization"
```

---

### Task 11: Upload Page

**Files:**
- Create: `src/app/admin/upload/page.tsx`

The main page that composes all upload components — platform selection, dropzone, preview, and progress. Follows the same auth pattern as the admin page.

- [ ] **Step 1: Implement the upload page**

```tsx
// src/app/admin/upload/page.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import UploadDropzone from "@/components/upload-dropzone";
import UploadPreview from "@/components/upload-preview";
import UploadProgress, { type GameProgress } from "@/components/upload-progress";
import type { DetectedGame } from "@/lib/upload-detector";
import { PLATFORM_CONFIG } from "@/lib/platforms";

type Phase = "select" | "upload" | "preview" | "processing" | "done";

export default function UploadPage() {
  const [phase, setPhase] = useState<Phase>("select");
  const [platform, setPlatform] = useState<string>("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [detectedGames, setDetectedGames] = useState<DetectedGame[]>([]);
  const [gameProgress, setGameProgress] = useState<GameProgress[]>([]);
  const [totalGames, setTotalGames] = useState(0);
  const [succeeded, setSucceeded] = useState(0);
  const [failed, setFailed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Auth check — reuse cookie from admin page
  const [authenticated, setAuthenticated] = useState(false);
  const [authRequired, setAuthRequired] = useState<boolean | null>(null);
  const [tokenInput, setTokenInput] = useState("");
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((data) => {
        setAuthRequired(data.authRequired);
        if (!data.authRequired) {
          setAuthenticated(true);
        } else {
          fetch("/api/settings")
            .then((r) => { if (r.ok) setAuthenticated(true); })
            .catch(() => {});
        }
      });
  }, []);

  async function handleLogin() {
    setAuthError("");
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: tokenInput }),
    });
    if (res.ok) setAuthenticated(true);
    else setAuthError("Invalid token");
  }

  async function handleFilesSelected(files: File[]) {
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      for (const file of files) {
        formData.append("files", file);
      }

      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      if (!uploadRes.ok) {
        const data = await uploadRes.json();
        throw new Error(data.error || "Upload failed");
      }
      const { sessionId: sid } = await uploadRes.json();
      setSessionId(sid);

      // Detect games
      const detectRes = await fetch("/api/upload/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sid, platform }),
      });
      if (!detectRes.ok) {
        const data = await detectRes.json();
        throw new Error(data.error || "Detection failed");
      }
      const { games } = await detectRes.json();
      setDetectedGames(games);
      setPhase("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }

    setUploading(false);
  }

  async function handleConfirm(gameIds: string[]) {
    if (!sessionId) return;
    setPhase("processing");
    setError(null);

    // Initialize progress state
    const initialProgress: GameProgress[] = detectedGames
      .filter((g) => gameIds.includes(g.id))
      .map((g) => ({ gameId: g.id, title: g.title, status: "queued" as const }));
    setGameProgress(initialProgress);

    try {
      const res = await fetch("/api/upload/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, platform, gameIds }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Processing failed");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));

            switch (data.type) {
              case "start":
                setTotalGames(data.totalGames);
                break;

              case "game-start":
                setGameProgress((prev) =>
                  prev.map((g) =>
                    g.gameId === data.gameId
                      ? { ...g, status: "processing", step: data.step }
                      : g
                  )
                );
                break;

              case "convert-progress":
                setGameProgress((prev) =>
                  prev.map((g) =>
                    g.gameId === data.gameId
                      ? { ...g, convertPercent: data.percent }
                      : g
                  )
                );
                break;

              case "game-step":
                setGameProgress((prev) =>
                  prev.map((g) =>
                    g.gameId === data.gameId
                      ? { ...g, step: data.step, convertPercent: undefined, transferPercent: undefined }
                      : g
                  )
                );
                break;

              case "transfer-progress":
                setGameProgress((prev) =>
                  prev.map((g) =>
                    g.gameId === data.gameId
                      ? { ...g, transferPercent: data.percent }
                      : g
                  )
                );
                break;

              case "game-done":
                setGameProgress((prev) =>
                  prev.map((g) =>
                    g.gameId === data.gameId
                      ? { ...g, status: "done", dbId: data.dbId, coverUrl: data.coverUrl }
                      : g
                  )
                );
                break;

              case "game-error":
                setGameProgress((prev) =>
                  prev.map((g) =>
                    g.gameId === data.gameId
                      ? { ...g, status: "failed", error: data.error }
                      : g
                  )
                );
                break;

              case "done":
                setSucceeded(data.succeeded);
                setFailed(data.failed);
                setPhase("done");
                break;
            }
          } catch {
            // Skip malformed events
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }

  const inputClass = "w-full bg-vault-bg border border-vault-border rounded-lg px-4 py-2 text-sm text-vault-text focus:outline-none focus:border-vault-amber transition-colors";

  // Loading
  if (authRequired === null) {
    return (
      <div className="max-w-3xl mx-auto flex items-center justify-center py-20">
        <div className="w-6 h-6 rounded-full bg-vault-amber animate-pulse" />
      </div>
    );
  }

  // Auth gate
  if (authRequired && !authenticated) {
    return (
      <div className="max-w-sm mx-auto py-20">
        <h1 className="font-heading text-2xl font-bold mb-6 text-center">Admin Login</h1>
        <div className="card space-y-4">
          <div>
            <label className="text-vault-muted text-xs mb-1 block">Admin Token</label>
            <input type="password" value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              placeholder="Enter admin token..."
              className={inputClass} />
          </div>
          {authError && <p className="text-red-400 text-sm">{authError}</p>}
          <button onClick={handleLogin}
            className="w-full px-6 py-3 rounded-lg font-medium text-sm bg-vault-amber text-black hover:bg-vault-amber-hover transition-all">
            Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <Link href="/admin" className="text-vault-muted hover:text-vault-text text-sm mb-6 inline-block">
        &larr; Back to Admin
      </Link>

      <h1 className="font-heading text-2xl font-bold mb-8">Upload ROMs</h1>

      {error && (
        <div className="card mb-6 border-red-500/50">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Phase: Platform Selection */}
      {phase === "select" && (
        <div className="space-y-6">
          <div>
            <h3 className="font-heading text-sm font-semibold text-vault-amber uppercase tracking-wide mb-3">
              Select Platform
            </h3>
            <div className="flex flex-wrap gap-2">
              {PLATFORM_CONFIG.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { setPlatform(p.id); setPhase("upload"); }}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all
                    ${platform === p.id
                      ? "bg-vault-amber text-black border-vault-amber"
                      : "bg-vault-surface text-vault-text border-vault-border hover:border-vault-amber"}`}
                >
                  {p.icon} {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Phase: Upload */}
      {phase === "upload" && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setPhase("select"); setPlatform(""); }}
              className="text-vault-muted hover:text-vault-text text-sm"
            >
              &larr; Change Platform
            </button>
            <span className="text-vault-amber text-sm font-medium">
              {PLATFORM_CONFIG.find((p) => p.id === platform)?.icon}{" "}
              {PLATFORM_CONFIG.find((p) => p.id === platform)?.label}
            </span>
          </div>

          <UploadDropzone onFilesSelected={handleFilesSelected} disabled={uploading} />

          {uploading && (
            <div className="flex items-center gap-3 justify-center">
              <div className="w-4 h-4 rounded-full bg-vault-amber animate-pulse" />
              <span className="text-vault-muted text-sm">Uploading and analyzing files...</span>
            </div>
          )}
        </div>
      )}

      {/* Phase: Preview */}
      {phase === "preview" && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setPhase("upload"); setDetectedGames([]); setSessionId(null); }}
              className="text-vault-muted hover:text-vault-text text-sm"
            >
              &larr; Upload Different Files
            </button>
            <span className="text-vault-amber text-sm font-medium">
              {PLATFORM_CONFIG.find((p) => p.id === platform)?.icon}{" "}
              {PLATFORM_CONFIG.find((p) => p.id === platform)?.label}
            </span>
          </div>

          <UploadPreview games={detectedGames} onConfirm={handleConfirm} />
        </div>
      )}

      {/* Phase: Processing / Done */}
      {(phase === "processing" || phase === "done") && (
        <UploadProgress
          games={gameProgress}
          totalGames={totalGames}
          isComplete={phase === "done"}
          succeeded={succeeded}
          failed={failed}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify type-check passes**

```bash
pnpm build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/upload/page.tsx
git commit -m "feat: add ROM upload page with full pipeline UI"
```

---

### Task 12: Admin Page Link

**Files:**
- Modify: `src/app/admin/page.tsx`

Add a link/button to the upload page in the admin actions grid.

- [ ] **Step 1: Add upload link to admin page**

In `src/app/admin/page.tsx`, add a Link import (already has it) and add an upload button in the actions grid. After the existing `<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">` block (around line 295-305), add a new full-width upload link:

```tsx
      {/* Upload Link */}
      <Link
        href="/admin/upload"
        className={`${btnClass} bg-emerald-600 text-white hover:bg-emerald-500 block text-center mb-8`}
      >
        Upload ROMs
      </Link>
```

This goes right after the `grid-cols-2` button grid (line 305) and before the `{/* Live Progress */}` section.

- [ ] **Step 2: Verify type-check passes**

```bash
pnpm build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/page.tsx
git commit -m "feat: add Upload ROMs link to admin page"
```

---

### Task 13: Docker Changes

**Files:**
- Modify: `Dockerfile`
- Modify: `docker-compose.yml`

Add mame-tools for chdman and upload-temp volume for staging files.

- [ ] **Step 1: Update Dockerfile**

In the `FROM base AS runner` section, after `WORKDIR /app`, add mame-tools:

```dockerfile
RUN apk add --no-cache mame-tools
```

- [ ] **Step 2: Update docker-compose.yml**

Add the upload-temp volume:

```yaml
    volumes:
      - game-data:/app/prisma
      - upload-temp:/tmp/game-vault-uploads

volumes:
  game-data:
  upload-temp:
```

- [ ] **Step 3: Verify Docker build works**

```bash
docker compose build
```

Expected: Build succeeds (mame-tools installs, volume configured).

- [ ] **Step 4: Commit**

```bash
git add Dockerfile docker-compose.yml
git commit -m "feat: add mame-tools and upload temp volume for ROM conversion"
```

---

### Task 14: Manual Integration Test

No new files — this is a test pass across the full feature.

- [ ] **Step 1: Run all unit tests**

```bash
pnpm test
```

Expected: All tests pass.

- [ ] **Step 2: Run type-check**

```bash
pnpm build
```

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 3: Start dev server and test UI flow**

```bash
pnpm dev
```

Test in browser:
1. Navigate to `/admin` — verify "Upload ROMs" button is visible
2. Click "Upload ROMs" — verify platform selection chips render
3. Select a platform (e.g., SNES) — verify dropzone appears
4. Drop or browse a small test file — verify detection preview shows
5. Verify "Upload to Steam Deck" button shows total size
6. (If Steam Deck is available) Click upload — verify SSE progress stream works

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: integration fixes for ROM upload feature"
```
