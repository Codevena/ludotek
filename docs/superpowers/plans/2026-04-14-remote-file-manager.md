# Remote File Manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dual-panel file manager at `/files` (Total Commander style) with CRUD operations, cross-device transfer with progress, file preview, and multi-select.

**Architecture:** Two independent `FilePanel` components side-by-side, each connected to a device. The existing `DeviceConnection` interface in `src/lib/connection.ts` gets extended with `mkdir`, `rename`, `remove`, `readFile`, `writeFile`, and `stat` methods. File operations are exposed via REST API routes under `/api/devices/[id]/files/*`. Cross-device transfer relays files through the server (source → buffer → target) with an in-memory progress store polled by the frontend. A `TransferBar` at the bottom shows progress.

**Tech Stack:** Next.js 14 (App Router), Prisma 6 (SQLite), ssh2 SFTP, basic-ftp, React state + polling, Tailwind CSS

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/lib/connection.ts` | MODIFY — Extend `DeviceConnection` with `mkdir`, `rename`, `remove`, `readFile`, `writeFile`, `stat`; add `DetailedDirEntry` and `FileStat` types |
| `src/lib/transfer-progress.ts` | NEW — In-memory transfer progress store (singleton Map, get/set/clear) |
| `src/app/api/devices/[id]/browse/route.ts` | MODIFY — Return `DetailedDirEntry[]` with size and modifiedAt |
| `src/app/api/devices/[id]/files/mkdir/route.ts` | NEW — POST creates a folder |
| `src/app/api/devices/[id]/files/rename/route.ts` | NEW — POST renames a file/folder |
| `src/app/api/devices/[id]/files/route.ts` | NEW — DELETE removes files/folders |
| `src/app/api/devices/[id]/files/preview/route.ts` | NEW — GET returns file content (image binary, text, or metadata) |
| `src/app/api/devices/transfer/route.ts` | NEW — POST starts a cross-device transfer |
| `src/app/api/devices/transfer/status/route.ts` | NEW — GET returns transfer progress |
| `src/components/file-panel.tsx` | NEW — Single panel: device selector, path bar, file list with checkboxes, action buttons |
| `src/components/file-preview-modal.tsx` | NEW — Modal for file preview (images, text, metadata) |
| `src/components/transfer-bar.tsx` | NEW — Sticky transfer progress bar at bottom of page |
| `src/app/files/page.tsx` | NEW — Dual-panel file manager page |
| `src/components/layout/header.tsx` | MODIFY — Add "Files" nav link |

---

### Task 1: Extend DeviceConnection Interface + SSH Implementation

**Files:**
- Modify: `src/lib/connection.ts`

- [ ] **Step 1: Add new types to connection.ts**

Add these types after the existing `BrowseResult` interface:

```typescript
export interface DetailedDirEntry {
  name: string;
  type: "dir" | "file";
  size: number;
  modifiedAt?: string;
}

export interface FileStat {
  size: number;
  modifiedAt?: string;
  isDirectory: boolean;
}
```

- [ ] **Step 2: Extend the DeviceConnection interface**

Update the `DeviceConnection` interface:

```typescript
export interface DeviceConnection {
  listDir(path: string): Promise<DirEntry[]>;
  listDirDetailed(path: string): Promise<DetailedDirEntry[]>;
  mkdir(path: string): Promise<void>;
  rename(oldPath: string, newPath: string): Promise<void>;
  remove(path: string): Promise<void>;
  readFile(path: string, maxBytes?: number): Promise<Buffer>;
  writeFile(remotePath: string, data: Buffer): Promise<void>;
  stat(path: string): Promise<FileStat>;
  disconnect(): void;
}
```

- [ ] **Step 3: Add SFTP helper to SshConnection**

Add a private method that gets an SFTP session from the SSH client. Add this inside the `SshConnection` class before `listDir`:

```typescript
private getSftp(): Promise<import("ssh2").SFTPWrapper> {
  return new Promise((resolve, reject) => {
    this.conn.sftp((err, sftp) => {
      if (err) return reject(err);
      resolve(sftp);
    });
  });
}
```

- [ ] **Step 4: Implement SSH listDirDetailed**

Add to `SshConnection`:

```typescript
async listDirDetailed(path: string): Promise<DetailedDirEntry[]> {
  const sftp = await this.getSftp();
  return new Promise((resolve, reject) => {
    sftp.readdir(path, (err, list) => {
      if (err) return reject(err);
      const entries: DetailedDirEntry[] = list
        .filter((item) => item.filename !== "." && item.filename !== "..")
        .slice(0, MAX_ENTRIES)
        .map((item) => ({
          name: item.filename,
          type: item.attrs.isDirectory() ? "dir" as const : "file" as const,
          size: item.attrs.size,
          modifiedAt: item.attrs.mtime
            ? new Date(item.attrs.mtime * 1000).toISOString()
            : undefined,
        }));
      resolve(sortEntries(entries) as DetailedDirEntry[]);
    });
  });
}
```

- [ ] **Step 5: Implement SSH mkdir**

```typescript
async mkdir(path: string): Promise<void> {
  const sftp = await this.getSftp();
  return new Promise((resolve, reject) => {
    sftp.mkdir(path, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}
```

- [ ] **Step 6: Implement SSH rename**

```typescript
async rename(oldPath: string, newPath: string): Promise<void> {
  const sftp = await this.getSftp();
  return new Promise((resolve, reject) => {
    sftp.rename(oldPath, newPath, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}
```

- [ ] **Step 7: Implement SSH remove**

Uses SFTP for files and `rm -rf` via exec for directories (since SFTP `rmdir` only removes empty dirs):

```typescript
async remove(path: string): Promise<void> {
  const sftp = await this.getSftp();
  const stats = await this.stat(path);
  if (stats.isDirectory) {
    const safePath = path.replace(/[`$\\;"'|&<>(){}!\n\r]/g, "");
    await sshExec(this.conn, `rm -rf -- "${safePath}"`);
  } else {
    return new Promise((resolve, reject) => {
      sftp.unlink(path, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }
}
```

- [ ] **Step 8: Implement SSH readFile**

```typescript
async readFile(path: string, maxBytes?: number): Promise<Buffer> {
  const sftp = await this.getSftp();
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalSize = 0;
    const limit = maxBytes ?? Infinity;

    const stream = sftp.createReadStream(path);
    stream.on("data", (chunk: Buffer) => {
      totalSize += chunk.length;
      if (totalSize <= limit) {
        chunks.push(chunk);
      } else {
        const overshoot = totalSize - limit;
        chunks.push(chunk.subarray(0, chunk.length - overshoot));
        stream.destroy();
      }
    });
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("close", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}
```

- [ ] **Step 9: Implement SSH writeFile**

```typescript
async writeFile(remotePath: string, data: Buffer): Promise<void> {
  const sftp = await this.getSftp();
  return new Promise((resolve, reject) => {
    const stream = sftp.createWriteStream(remotePath);
    stream.on("close", () => resolve());
    stream.on("error", reject);
    stream.end(data);
  });
}
```

- [ ] **Step 10: Implement SSH stat**

```typescript
async stat(path: string): Promise<FileStat> {
  const sftp = await this.getSftp();
  return new Promise((resolve, reject) => {
    sftp.stat(path, (err, attrs) => {
      if (err) return reject(err);
      resolve({
        size: attrs.size,
        modifiedAt: attrs.mtime
          ? new Date(attrs.mtime * 1000).toISOString()
          : undefined,
        isDirectory: attrs.isDirectory(),
      });
    });
  });
}
```

- [ ] **Step 11: Run type check**

Run: `pnpm build`
Expected: Type errors for `FtpConnection` not implementing the new methods (that's expected — Task 2 fixes it).

- [ ] **Step 12: Commit**

```bash
git add src/lib/connection.ts
git commit -m "feat(connection): extend DeviceConnection with CRUD + SFTP implementation"
```

---

### Task 2: FTP Implementation of New DeviceConnection Methods

**Files:**
- Modify: `src/lib/connection.ts`

- [ ] **Step 1: Implement FTP listDirDetailed**

Add to `FtpConnection`:

```typescript
async listDirDetailed(path: string): Promise<DetailedDirEntry[]> {
  const items = await this.client.list(path);
  const entries: DetailedDirEntry[] = items
    .filter((item) => item.name && item.name !== "." && item.name !== "..")
    .slice(0, MAX_ENTRIES)
    .map((item) => ({
      name: item.name,
      type: item.isDirectory ? "dir" as const : "file" as const,
      size: item.size,
      modifiedAt: item.rawModifiedAt
        ? new Date(item.rawModifiedAt).toISOString()
        : undefined,
    }));
  return sortEntries(entries) as DetailedDirEntry[];
}
```

- [ ] **Step 2: Implement FTP mkdir**

```typescript
async mkdir(path: string): Promise<void> {
  await this.client.ensureDir(path);
}
```

- [ ] **Step 3: Implement FTP rename**

```typescript
async rename(oldPath: string, newPath: string): Promise<void> {
  await this.client.rename(oldPath, newPath);
}
```

- [ ] **Step 4: Implement FTP remove**

```typescript
async remove(path: string): Promise<void> {
  try {
    await this.client.remove(path);
  } catch {
    await this.client.removeDir(path);
  }
}
```

- [ ] **Step 5: Implement FTP readFile**

```typescript
async readFile(path: string, maxBytes?: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let totalSize = 0;
  const limit = maxBytes ?? Infinity;
  const writable = new (await import("stream")).Writable({
    write(chunk: Buffer, _encoding, callback) {
      totalSize += chunk.length;
      if (totalSize <= limit) {
        chunks.push(chunk);
      } else {
        const overshoot = totalSize - limit;
        chunks.push(chunk.subarray(0, chunk.length - overshoot));
      }
      callback();
    },
  });
  await this.client.downloadTo(writable, path);
  return Buffer.concat(chunks);
}
```

- [ ] **Step 6: Implement FTP writeFile**

```typescript
async writeFile(remotePath: string, data: Buffer): Promise<void> {
  const { Readable } = await import("stream");
  const readable = Readable.from(data);
  await this.client.uploadFrom(readable, remotePath);
}
```

- [ ] **Step 7: Implement FTP stat**

```typescript
async stat(path: string): Promise<FileStat> {
  const size = await this.client.size(path);
  let modifiedAt: string | undefined;
  try {
    const lastMod = await this.client.lastMod(path);
    modifiedAt = lastMod.toISOString();
  } catch {
    // Some FTP servers don't support MDTM
  }
  return { size, modifiedAt, isDirectory: false };
}
```

- [ ] **Step 8: Run type check**

Run: `pnpm build`
Expected: PASS — both SSH and FTP implement all methods.

- [ ] **Step 9: Commit**

```bash
git add src/lib/connection.ts
git commit -m "feat(connection): add FTP implementation for file CRUD methods"
```

---

### Task 3: Update Browse API to Return Detailed Entries

**Files:**
- Modify: `src/app/api/devices/[id]/browse/route.ts`
- Modify: `src/lib/connection.ts` (update `buildBrowseResult`)

- [ ] **Step 1: Update BrowseResult type**

In `src/lib/connection.ts`, update the `BrowseResult` interface:

```typescript
export interface BrowseResult {
  path: string;
  parent: string | null;
  entries: DetailedDirEntry[];
}
```

- [ ] **Step 2: Update buildBrowseResult signature**

```typescript
export function buildBrowseResult(path: string, entries: DetailedDirEntry[]): BrowseResult {
  const normalized = path === "" ? "/" : path;
  let parent: string | null = null;

  if (normalized !== "/") {
    const idx = normalized.lastIndexOf("/");
    parent = idx <= 0 ? "/" : normalized.slice(0, idx);
  }

  return { path: normalized, parent, entries };
}
```

- [ ] **Step 3: Update browse route to use listDirDetailed**

In `src/app/api/devices/[id]/browse/route.ts`, change the call from `conn.listDir(path)` to `conn.listDirDetailed(path)`:

```typescript
    const entries = await conn.listDirDetailed(path);
    return NextResponse.json(buildBrowseResult(path, entries));
```

- [ ] **Step 4: Run type check**

Run: `pnpm build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/connection.ts src/app/api/devices/[id]/browse/route.ts
git commit -m "feat(browse): return detailed entries with size and modifiedAt"
```

---

### Task 4: Path Validation Helper

**Files:**
- Create: `src/lib/path-validation.ts`

- [ ] **Step 1: Create path validation utility**

```typescript
import { NextResponse } from "next/server";

/**
 * Validate a remote file path. Rejects directory traversal and empty paths.
 * Returns null if valid, or a NextResponse error if invalid.
 */
export function validateRemotePath(path: string): NextResponse | null {
  if (!path || path.trim() === "") {
    return NextResponse.json({ error: "Path is required" }, { status: 400 });
  }
  if (path.includes("..")) {
    return NextResponse.json(
      { error: "Path must not contain '..'" },
      { status: 400 },
    );
  }
  return null;
}

/**
 * Load a device by ID from Prisma, returning the device or a NextResponse error.
 */
export async function loadDevice(
  id: string,
): Promise<
  | { device: import("@prisma/client").Device; error?: never }
  | { device?: never; error: NextResponse }
> {
  const { prisma } = await import("@/lib/prisma");
  const deviceId = parseInt(id, 10);
  if (isNaN(deviceId)) {
    return {
      error: NextResponse.json({ error: "Invalid device ID" }, { status: 400 }),
    };
  }
  const device = await prisma.device.findUnique({ where: { id: deviceId } });
  if (!device) {
    return {
      error: NextResponse.json({ error: "Device not found" }, { status: 404 }),
    };
  }
  return { device };
}
```

- [ ] **Step 2: Run type check**

Run: `pnpm build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/path-validation.ts
git commit -m "feat: add path validation and device loader helpers"
```

---

### Task 5: Mkdir API Route

**Files:**
- Create: `src/app/api/devices/[id]/files/mkdir/route.ts`

- [ ] **Step 1: Create mkdir route**

```typescript
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
```

- [ ] **Step 2: Run type check**

Run: `pnpm build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/api/devices/[id]/files/mkdir/route.ts
git commit -m "feat(api): add mkdir endpoint for remote devices"
```

---

### Task 6: Rename API Route

**Files:**
- Create: `src/app/api/devices/[id]/files/rename/route.ts`

- [ ] **Step 1: Create rename route**

```typescript
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
  if (!body?.oldPath || !body?.newPath) {
    return NextResponse.json(
      { error: "oldPath and newPath are required" },
      { status: 400 },
    );
  }

  const oldPathError = validateRemotePath(body.oldPath);
  if (oldPathError) return oldPathError;
  const newPathError = validateRemotePath(body.newPath);
  if (newPathError) return newPathError;

  let conn;
  try {
    conn = await createConnection({
      protocol: device.protocol,
      host: device.host,
      port: device.port,
      user: device.user,
      password: device.password,
    } as ConnectionConfig);
    await conn.rename(body.oldPath, body.newPath);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("rename failed:", error);
    const message = error instanceof Error ? error.message : "rename failed";
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    conn?.disconnect();
  }
}
```

- [ ] **Step 2: Run type check**

Run: `pnpm build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/api/devices/[id]/files/rename/route.ts
git commit -m "feat(api): add rename endpoint for remote devices"
```

---

### Task 7: Delete Files API Route

**Files:**
- Create: `src/app/api/devices/[id]/files/route.ts`

- [ ] **Step 1: Create delete route**

```typescript
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
      return NextResponse.json(
        { ok: false, errors },
        { status: 207 },
      );
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
```

- [ ] **Step 2: Run type check**

Run: `pnpm build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/api/devices/[id]/files/route.ts
git commit -m "feat(api): add delete endpoint for remote device files"
```

---

### Task 8: File Preview API Route

**Files:**
- Create: `src/app/api/devices/[id]/files/preview/route.ts`

- [ ] **Step 1: Create preview route**

```typescript
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
      const data = await conn.readFile(filePath);
      const mime = MIME_MAP[ext] ?? "application/octet-stream";
      return new NextResponse(data, {
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
```

- [ ] **Step 2: Run type check**

Run: `pnpm build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/api/devices/[id]/files/preview/route.ts
git commit -m "feat(api): add file preview endpoint with image/text/binary support"
```

---

### Task 9: Transfer Progress Store

**Files:**
- Create: `src/lib/transfer-progress.ts`

- [ ] **Step 1: Create transfer progress singleton**

```typescript
export interface TransferProgress {
  transferring: boolean;
  currentFile: string;
  progress: number; // 0-100 for current file
  completedFiles: number;
  totalFiles: number;
  mode: "copy" | "move";
  error?: string;
}

const DEFAULT_PROGRESS: TransferProgress = {
  transferring: false,
  currentFile: "",
  progress: 0,
  completedFiles: 0,
  totalFiles: 0,
  mode: "copy",
};

let transferProgress: TransferProgress = { ...DEFAULT_PROGRESS };

export function getTransferProgress(): TransferProgress {
  return { ...transferProgress };
}

export function setTransferProgress(
  update: Partial<TransferProgress>,
): void {
  transferProgress = { ...transferProgress, ...update };
}

export function clearTransferProgress(): void {
  transferProgress = { ...DEFAULT_PROGRESS };
}
```

- [ ] **Step 2: Run type check**

Run: `pnpm build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/transfer-progress.ts
git commit -m "feat: add in-memory transfer progress store"
```

---

### Task 10: Transfer API Routes

**Files:**
- Create: `src/app/api/devices/transfer/route.ts`
- Create: `src/app/api/devices/transfer/status/route.ts`

- [ ] **Step 1: Create transfer status route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getTransferProgress } from "@/lib/transfer-progress";

export async function GET(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  return NextResponse.json(getTransferProgress());
}
```

- [ ] **Step 2: Create transfer route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createConnection } from "@/lib/connection";
import type { ConnectionConfig, DeviceConnection } from "@/lib/connection";
import { validateRemotePath } from "@/lib/path-validation";
import {
  getTransferProgress,
  setTransferProgress,
  clearTransferProgress,
} from "@/lib/transfer-progress";

const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2 GB
const FILE_TIMEOUT = 10 * 60 * 1000; // 10 minutes

function configFromDevice(device: {
  protocol: string;
  host: string;
  port: number;
  user: string;
  password: string;
}): ConnectionConfig {
  return {
    protocol: device.protocol as "ssh" | "ftp",
    host: device.host,
    port: device.port,
    user: device.user,
    password: device.password,
  };
}

async function runTransfer(
  sourceConn: DeviceConnection,
  targetConn: DeviceConnection,
  files: string[],
  targetPath: string,
  mode: "copy" | "move",
): Promise<void> {
  setTransferProgress({
    transferring: true,
    totalFiles: files.length,
    completedFiles: 0,
    mode,
    error: undefined,
  });

  for (let i = 0; i < files.length; i++) {
    const filePath = files[i];
    const fileName = filePath.split("/").pop() ?? filePath;
    setTransferProgress({
      currentFile: fileName,
      progress: 0,
      completedFiles: i,
    });

    try {
      // Check file size
      const stats = await sourceConn.stat(filePath);
      if (stats.isDirectory) {
        // Skip directories for now — only transfer files
        continue;
      }
      if (stats.size > MAX_FILE_SIZE) {
        setTransferProgress({
          error: `${fileName} exceeds 2 GB limit`,
          transferring: false,
        });
        return;
      }

      // Read from source
      const data = await Promise.race([
        sourceConn.readFile(filePath),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Timeout reading ${fileName}`)),
            FILE_TIMEOUT,
          ),
        ),
      ]);

      setTransferProgress({ progress: 50 });

      // Write to target
      const destPath =
        targetPath.endsWith("/")
          ? `${targetPath}${fileName}`
          : `${targetPath}/${fileName}`;
      await Promise.race([
        targetConn.writeFile(destPath, data),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Timeout writing ${fileName}`)),
            FILE_TIMEOUT,
          ),
        ),
      ]);

      setTransferProgress({ progress: 100, completedFiles: i + 1 });

      // Delete source if mode is "move"
      if (mode === "move") {
        await sourceConn.remove(filePath);
      }
    } catch (err) {
      setTransferProgress({
        error: `${fileName}: ${err instanceof Error ? err.message : "transfer failed"}`,
        transferring: false,
      });
      return;
    }
  }

  setTransferProgress({ transferring: false, progress: 100 });
}

export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  // Prevent concurrent transfers
  const current = getTransferProgress();
  if (current.transferring) {
    return NextResponse.json(
      { error: "A transfer is already in progress" },
      { status: 409 },
    );
  }

  const body = await request.json().catch(() => null);
  if (
    !body?.sourceDeviceId ||
    !body?.targetDeviceId ||
    !body?.targetPath ||
    !Array.isArray(body?.files) ||
    body.files.length === 0
  ) {
    return NextResponse.json(
      {
        error:
          "sourceDeviceId, targetDeviceId, targetPath, and files[] are required",
      },
      { status: 400 },
    );
  }

  const mode: "copy" | "move" =
    body.mode === "move" ? "move" : "copy";

  for (const f of body.files) {
    const pathError = validateRemotePath(f);
    if (pathError) return pathError;
  }
  const targetPathError = validateRemotePath(body.targetPath);
  if (targetPathError) return targetPathError;

  const [sourceDevice, targetDevice] = await Promise.all([
    prisma.device.findUnique({ where: { id: body.sourceDeviceId } }),
    prisma.device.findUnique({ where: { id: body.targetDeviceId } }),
  ]);

  if (!sourceDevice) {
    return NextResponse.json(
      { error: "Source device not found" },
      { status: 404 },
    );
  }
  if (!targetDevice) {
    return NextResponse.json(
      { error: "Target device not found" },
      { status: 404 },
    );
  }

  let sourceConn: DeviceConnection | undefined;
  let targetConn: DeviceConnection | undefined;

  try {
    sourceConn = await createConnection(configFromDevice(sourceDevice));
    targetConn = await createConnection(configFromDevice(targetDevice));
  } catch (error) {
    sourceConn?.disconnect();
    targetConn?.disconnect();
    const message =
      error instanceof Error ? error.message : "Connection failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // Run transfer in background — don't await
  const sc = sourceConn;
  const tc = targetConn;
  runTransfer(sc, tc, body.files, body.targetPath, mode)
    .catch((err) => {
      console.error("Transfer failed:", err);
      setTransferProgress({
        transferring: false,
        error: err instanceof Error ? err.message : "Transfer failed",
      });
    })
    .finally(() => {
      sc.disconnect();
      tc.disconnect();
    });

  return NextResponse.json({ ok: true, message: "Transfer started" });
}
```

- [ ] **Step 3: Run type check**

Run: `pnpm build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/app/api/devices/transfer/route.ts src/app/api/devices/transfer/status/route.ts
git commit -m "feat(api): add cross-device transfer with progress polling"
```

---

### Task 11: FilePanel Component

**Files:**
- Create: `src/components/file-panel.tsx`

- [ ] **Step 1: Create the FilePanel component**

This is the core UI panel — device selector, path bar, file list with checkboxes, size display, and action buttons. Each instance is independent (left or right).

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";

interface DetailedEntry {
  name: string;
  type: "dir" | "file";
  size: number;
  modifiedAt?: string;
}

interface DeviceOption {
  id: number;
  name: string;
}

interface FilePanelProps {
  side: "left" | "right";
  devices: DeviceOption[];
  selectedDeviceId: number | null;
  onDeviceChange: (id: number | null) => void;
  onSelectionChange: (paths: string[], deviceId: number) => void;
  currentPath: string;
  onPathChange: (path: string) => void;
  onPreview: (deviceId: number, filePath: string) => void;
  onRefresh?: () => void;
  refreshKey?: number;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function FilePanel({
  side,
  devices,
  selectedDeviceId,
  onDeviceChange,
  onSelectionChange,
  currentPath,
  onPathChange,
  onPreview,
  refreshKey,
}: FilePanelProps) {
  const [entries, setEntries] = useState<DetailedEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mkdirMode, setMkdirMode] = useState(false);
  const [mkdirName, setMkdirName] = useState("");
  const [renameTarget, setRenameTarget] = useState<string | null>(null);
  const [renameName, setRenameName] = useState("");

  const browse = useCallback(
    async (path: string) => {
      if (!selectedDeviceId) return;
      setLoading(true);
      setError(null);
      setSelected(new Set());
      try {
        const res = await fetch(
          `/api/devices/${selectedDeviceId}/browse?path=${encodeURIComponent(path)}`,
        );
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error ?? `Browse failed (${res.status})`);
        }
        const data = await res.json();
        setEntries(data.entries ?? []);
        onPathChange(path);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to browse");
        setEntries([]);
      } finally {
        setLoading(false);
      }
    },
    [selectedDeviceId, onPathChange],
  );

  useEffect(() => {
    if (selectedDeviceId) {
      browse(currentPath);
    } else {
      setEntries([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDeviceId, refreshKey]);

  useEffect(() => {
    if (selectedDeviceId) {
      onSelectionChange(Array.from(selected).map((name) => {
        return currentPath === "/" ? `/${name}` : `${currentPath}/${name}`;
      }), selectedDeviceId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  function toggleSelect(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === entries.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(entries.map((e) => e.name)));
    }
  }

  function navigateToParent() {
    if (currentPath === "/") return;
    const parts = currentPath.split("/").filter(Boolean);
    parts.pop();
    browse(parts.length === 0 ? "/" : `/${parts.join("/")}`);
  }

  async function handleMkdir() {
    if (!selectedDeviceId || !mkdirName.trim()) return;
    const newPath =
      currentPath === "/"
        ? `/${mkdirName.trim()}`
        : `${currentPath}/${mkdirName.trim()}`;
    try {
      const res = await fetch(
        `/api/devices/${selectedDeviceId}/files/mkdir`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: newPath }),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "mkdir failed");
      }
      setMkdirMode(false);
      setMkdirName("");
      browse(currentPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "mkdir failed");
    }
  }

  async function handleRename() {
    if (!selectedDeviceId || !renameTarget || !renameName.trim()) return;
    const oldPath =
      currentPath === "/"
        ? `/${renameTarget}`
        : `${currentPath}/${renameTarget}`;
    const newPath =
      currentPath === "/"
        ? `/${renameName.trim()}`
        : `${currentPath}/${renameName.trim()}`;
    try {
      const res = await fetch(
        `/api/devices/${selectedDeviceId}/files/rename`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ oldPath, newPath }),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "rename failed");
      }
      setRenameTarget(null);
      setRenameName("");
      browse(currentPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "rename failed");
    }
  }

  async function handleDelete() {
    if (!selectedDeviceId || selected.size === 0) return;
    const paths = Array.from(selected).map((name) =>
      currentPath === "/" ? `/${name}` : `${currentPath}/${name}`,
    );
    if (
      !confirm(
        `Delete ${paths.length} item${paths.length > 1 ? "s" : ""}? This cannot be undone.`,
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/devices/${selectedDeviceId}/files`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paths }),
      });
      if (!res.ok && res.status !== 207) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "delete failed");
      }
      setSelected(new Set());
      browse(currentPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "delete failed");
    }
  }

  const selectedCount = selected.size;
  const selectedSize = entries
    .filter((e) => selected.has(e.name))
    .reduce((sum, e) => sum + e.size, 0);

  return (
    <div className="flex flex-col rounded-xl border border-vault-border bg-vault-surface overflow-hidden min-h-[500px]">
      {/* Device selector */}
      <div className="px-3 py-2 border-b border-vault-border bg-vault-bg">
        <select
          value={selectedDeviceId ?? ""}
          onChange={(e) =>
            onDeviceChange(e.target.value ? Number(e.target.value) : null)
          }
          className="w-full bg-vault-surface border border-vault-border rounded-lg px-2 py-1.5 text-sm text-vault-text focus:outline-none focus:border-vault-amber/50"
        >
          <option value="">Select device...</option>
          {devices.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      {/* Path bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-vault-border bg-vault-bg">
        <button
          type="button"
          onClick={navigateToParent}
          disabled={currentPath === "/" || !selectedDeviceId}
          className="px-2 py-1 text-sm rounded border border-vault-border text-vault-muted hover:border-vault-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title="Go to parent"
        >
          &larr;
        </button>
        <button
          type="button"
          onClick={() => browse("/")}
          disabled={currentPath === "/" || !selectedDeviceId}
          className="px-2 py-1 text-sm rounded border border-vault-border text-vault-muted hover:border-vault-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title="Go to root"
        >
          /
        </button>
        <span
          className="text-sm text-vault-text truncate flex-1"
          title={currentPath}
        >
          {currentPath}
        </span>
      </div>

      {/* Select All header */}
      {selectedDeviceId && entries.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-vault-border/50 bg-vault-bg/50">
          <input
            type="checkbox"
            checked={selected.size === entries.length && entries.length > 0}
            onChange={toggleSelectAll}
            className="accent-vault-amber"
          />
          <span className="text-xs text-vault-muted">
            {selectedCount > 0
              ? `${selectedCount} selected (${formatSize(selectedSize)})`
              : "Select all"}
          </span>
        </div>
      )}

      {/* File list */}
      <div className="flex-1 overflow-y-auto max-h-[400px]">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="h-5 w-5 border-2 border-vault-amber border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && error && (
          <div className="px-4 py-6 text-center text-sm text-red-400">
            {error}
          </div>
        )}

        {!loading && !error && !selectedDeviceId && (
          <div className="px-4 py-6 text-center text-sm text-vault-muted">
            Select a device to browse files
          </div>
        )}

        {!loading && !error && selectedDeviceId && entries.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-vault-muted">
            Empty directory
          </div>
        )}

        {/* Inline mkdir input */}
        {mkdirMode && (
          <div className="flex items-center gap-2 px-3 py-2 border-b border-vault-border/50 bg-vault-amber/5">
            <span>📁</span>
            <input
              autoFocus
              value={mkdirName}
              onChange={(e) => setMkdirName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleMkdir();
                if (e.key === "Escape") {
                  setMkdirMode(false);
                  setMkdirName("");
                }
              }}
              placeholder="Folder name..."
              className="flex-1 bg-transparent border-b border-vault-amber/50 text-sm text-vault-text focus:outline-none"
            />
          </div>
        )}

        {!loading &&
          !error &&
          entries.map((entry) => (
            <div
              key={entry.name}
              className="flex items-center gap-2 px-3 py-2 text-sm border-b border-vault-border/50 last:border-b-0 hover:bg-vault-amber/5"
            >
              <input
                type="checkbox"
                checked={selected.has(entry.name)}
                onChange={() => toggleSelect(entry.name)}
                className="accent-vault-amber"
              />
              <span>{entry.type === "dir" ? "📁" : "📄"}</span>
              {renameTarget === entry.name ? (
                <input
                  autoFocus
                  value={renameName}
                  onChange={(e) => setRenameName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRename();
                    if (e.key === "Escape") {
                      setRenameTarget(null);
                      setRenameName("");
                    }
                  }}
                  className="flex-1 bg-transparent border-b border-vault-amber/50 text-sm text-vault-text focus:outline-none"
                />
              ) : (
                <span
                  className={`truncate flex-1 ${
                    entry.type === "dir"
                      ? "cursor-pointer text-vault-text hover:text-vault-amber"
                      : "cursor-pointer text-vault-muted hover:text-vault-text"
                  }`}
                  onClick={() => {
                    if (entry.type === "dir") {
                      const nextPath =
                        currentPath === "/"
                          ? `/${entry.name}`
                          : `${currentPath}/${entry.name}`;
                      browse(nextPath);
                    } else if (selectedDeviceId) {
                      const filePath =
                        currentPath === "/"
                          ? `/${entry.name}`
                          : `${currentPath}/${entry.name}`;
                      onPreview(selectedDeviceId, filePath);
                    }
                  }}
                >
                  {entry.name}
                </span>
              )}
              <span className="text-xs text-vault-muted whitespace-nowrap">
                {entry.type === "dir" ? "—" : formatSize(entry.size)}
              </span>
            </div>
          ))}
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-t border-vault-border bg-vault-bg">
        <button
          type="button"
          onClick={() => {
            setMkdirMode(true);
            setMkdirName("");
          }}
          disabled={!selectedDeviceId}
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-vault-surface border border-vault-border text-vault-muted hover:text-vault-text hover:border-vault-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          New Folder
        </button>
        <button
          type="button"
          onClick={() => {
            if (selectedCount === 1) {
              const name = Array.from(selected)[0];
              setRenameTarget(name);
              setRenameName(name);
            }
          }}
          disabled={selectedCount !== 1}
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-vault-surface border border-vault-border text-vault-muted hover:text-vault-text hover:border-vault-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Rename
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={selectedCount === 0}
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run type check**

Run: `pnpm build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/file-panel.tsx
git commit -m "feat: add FilePanel component with browse, mkdir, rename, delete"
```

---

### Task 12: File Preview Modal

**Files:**
- Create: `src/components/file-preview-modal.tsx`

- [ ] **Step 1: Create the preview modal component**

```typescript
"use client";

import { useState, useEffect } from "react";

interface FilePreviewModalProps {
  deviceId: number;
  filePath: string;
  onClose: () => void;
}

const IMAGE_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp",
]);
const TEXT_EXTENSIONS = new Set([
  ".txt", ".log", ".cfg", ".ini", ".xml", ".json", ".m3u", ".md", ".yaml", ".yml",
]);

function getExtension(path: string): string {
  const dot = path.lastIndexOf(".");
  return dot === -1 ? "" : path.slice(dot).toLowerCase();
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function FilePreviewModal({
  deviceId,
  filePath,
  onClose,
}: FilePreviewModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<{
    name: string;
    size: number;
    modifiedAt?: string;
  } | null>(null);

  const ext = getExtension(filePath);
  const fileName = filePath.split("/").pop() ?? filePath;
  const isImage = IMAGE_EXTENSIONS.has(ext);
  const isText = TEXT_EXTENSIONS.has(ext);

  useEffect(() => {
    const url = `/api/devices/${deviceId}/files/preview?path=${encodeURIComponent(filePath)}`;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(url);
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error ?? `Preview failed (${res.status})`);
        }

        if (isImage) {
          const blob = await res.blob();
          setImageUrl(URL.createObjectURL(blob));
        } else if (isText) {
          const data = await res.json();
          setTextContent(data.content);
          setTruncated(data.truncated ?? false);
        } else {
          const data = await res.json();
          setMetadata({
            name: data.name ?? fileName,
            size: data.size ?? 0,
            modifiedAt: data.modifiedAt,
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Preview failed");
      } finally {
        setLoading(false);
      }
    }

    load();

    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId, filePath]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-vault-surface border border-vault-border rounded-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-vault-border">
          <h3 className="text-sm font-medium text-vault-text truncate">
            {fileName}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-vault-muted hover:text-vault-text transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="h-5 w-5 border-2 border-vault-amber border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!loading && error && (
            <div className="text-center text-sm text-red-400">{error}</div>
          )}

          {!loading && !error && imageUrl && (
            <img
              src={imageUrl}
              alt={fileName}
              className="max-w-full h-auto rounded-lg mx-auto"
            />
          )}

          {!loading && !error && textContent !== null && (
            <div>
              <pre className="text-xs text-vault-text bg-vault-bg rounded-lg p-4 overflow-x-auto whitespace-pre-wrap font-mono">
                {textContent}
              </pre>
              {truncated && (
                <p className="text-xs text-vault-muted mt-2 text-center">
                  File truncated at 100 KB...
                </p>
              )}
            </div>
          )}

          {!loading && !error && metadata && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-vault-muted">Filename</span>
                <span className="text-vault-text">{metadata.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-vault-muted">Size</span>
                <span className="text-vault-text">
                  {formatSize(metadata.size)}
                </span>
              </div>
              {metadata.modifiedAt && (
                <div className="flex justify-between">
                  <span className="text-vault-muted">Modified</span>
                  <span className="text-vault-text">
                    {new Date(metadata.modifiedAt).toLocaleString()}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-vault-muted">Type</span>
                <span className="text-vault-text">Binary file</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run type check**

Run: `pnpm build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/file-preview-modal.tsx
git commit -m "feat: add FilePreviewModal for image/text/binary preview"
```

---

### Task 13: TransferBar Component

**Files:**
- Create: `src/components/transfer-bar.tsx`

- [ ] **Step 1: Create the transfer progress bar component**

```typescript
"use client";

import { useState, useEffect, useRef } from "react";

interface TransferProgress {
  transferring: boolean;
  currentFile: string;
  progress: number;
  completedFiles: number;
  totalFiles: number;
  mode: "copy" | "move";
  error?: string;
}

export function TransferBar() {
  const [progress, setProgress] = useState<TransferProgress | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    async function poll() {
      try {
        const res = await fetch("/api/devices/transfer/status");
        if (res.ok) {
          const data: TransferProgress = await res.json();
          setProgress(data);

          // Stop polling when not transferring and no error to display
          if (!data.transferring && !data.error) {
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
          }
        }
      } catch {
        // Silently ignore polling errors
      }
    }

    // Start polling
    poll();
    intervalRef.current = setInterval(poll, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Re-start polling whenever a transfer kicks off externally
  function startPolling() {
    if (intervalRef.current) return;
    intervalRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/devices/transfer/status");
        if (res.ok) {
          const data: TransferProgress = await res.json();
          setProgress(data);
          if (!data.transferring && !data.error) {
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
          }
        }
      } catch {
        // ignore
      }
    }, 1000);
  }

  // Expose startPolling on window for the page to trigger
  useEffect(() => {
    (window as Record<string, unknown>).__transferBarPoll = startPolling;
    return () => {
      delete (window as Record<string, unknown>).__transferBarPoll;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!progress || (!progress.transferring && !progress.error)) {
    return null;
  }

  const pct = progress.totalFiles > 0
    ? Math.round(
        ((progress.completedFiles + progress.progress / 100) /
          progress.totalFiles) *
          100,
      )
    : 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-vault-surface border-t border-vault-border px-6 py-3">
      {progress.error ? (
        <div className="text-sm text-red-400">{progress.error}</div>
      ) : (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-vault-muted">
            <span>
              {progress.mode === "copy" ? "Copying" : "Moving"}{" "}
              {progress.currentFile}...{" "}
              ({progress.completedFiles}/{progress.totalFiles} files)
            </span>
            <span>{pct}%</span>
          </div>
          <div className="h-2 bg-vault-bg rounded-full overflow-hidden">
            <div
              className="h-full bg-vault-amber rounded-full transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Run type check**

Run: `pnpm build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/transfer-bar.tsx
git commit -m "feat: add TransferBar component with polling progress display"
```

---

### Task 14: Files Page (Dual-Panel Layout)

**Files:**
- Create: `src/app/files/page.tsx`

- [ ] **Step 1: Create the dual-panel file manager page**

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import { FilePanel } from "@/components/file-panel";
import { FilePreviewModal } from "@/components/file-preview-modal";
import { TransferBar } from "@/components/transfer-bar";

interface DeviceOption {
  id: number;
  name: string;
}

export default function FilesPage() {
  const [devices, setDevices] = useState<DeviceOption[]>([]);
  const [leftDeviceId, setLeftDeviceId] = useState<number | null>(null);
  const [rightDeviceId, setRightDeviceId] = useState<number | null>(null);
  const [leftPath, setLeftPath] = useState("/");
  const [rightPath, setRightPath] = useState("/");
  const [leftSelection, setLeftSelection] = useState<string[]>([]);
  const [rightSelection, setRightSelection] = useState<string[]>([]);
  const [leftSelectionDeviceId, setLeftSelectionDeviceId] = useState<number | null>(null);
  const [rightSelectionDeviceId, setRightSelectionDeviceId] = useState<number | null>(null);
  const [preview, setPreview] = useState<{
    deviceId: number;
    filePath: string;
  } | null>(null);
  const [refreshLeft, setRefreshLeft] = useState(0);
  const [refreshRight, setRefreshRight] = useState(0);
  const [transferring, setTransferring] = useState(false);

  useEffect(() => {
    async function loadDevices() {
      try {
        const res = await fetch("/api/devices");
        if (res.ok) {
          const data = await res.json();
          const devs = (data.devices || []).map(
            (d: { id: number; name: string }) => ({
              id: d.id,
              name: d.name,
            }),
          );
          setDevices(devs);
          if (devs.length >= 1) setLeftDeviceId(devs[0].id);
          if (devs.length >= 2) setRightDeviceId(devs[1].id);
        }
      } catch (err) {
        console.error("Failed to load devices:", err);
      }
    }
    loadDevices();
  }, []);

  const handleLeftSelection = useCallback(
    (paths: string[], deviceId: number) => {
      setLeftSelection(paths);
      setLeftSelectionDeviceId(deviceId);
    },
    [],
  );

  const handleRightSelection = useCallback(
    (paths: string[], deviceId: number) => {
      setRightSelection(paths);
      setRightSelectionDeviceId(deviceId);
    },
    [],
  );

  async function startTransfer(
    direction: "left-to-right" | "right-to-left",
    mode: "copy" | "move",
  ) {
    const sourceDeviceId =
      direction === "left-to-right"
        ? leftSelectionDeviceId
        : rightSelectionDeviceId;
    const targetDeviceId =
      direction === "left-to-right" ? rightDeviceId : leftDeviceId;
    const files =
      direction === "left-to-right" ? leftSelection : rightSelection;
    const targetPath =
      direction === "left-to-right" ? rightPath : leftPath;

    if (!sourceDeviceId || !targetDeviceId || files.length === 0) return;

    setTransferring(true);
    try {
      const res = await fetch("/api/devices/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceDeviceId,
          targetDeviceId,
          targetPath,
          files,
          mode,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        alert(data?.error ?? "Transfer failed to start");
        setTransferring(false);
        return;
      }

      // Trigger TransferBar polling
      const pollFn = (window as Record<string, unknown>).__transferBarPoll;
      if (typeof pollFn === "function") (pollFn as () => void)();

      // Poll until transfer is done, then refresh panels
      const poll = setInterval(async () => {
        try {
          const statusRes = await fetch("/api/devices/transfer/status");
          if (statusRes.ok) {
            const status = await statusRes.json();
            if (!status.transferring) {
              clearInterval(poll);
              setTransferring(false);
              setRefreshLeft((n) => n + 1);
              setRefreshRight((n) => n + 1);
            }
          }
        } catch {
          // ignore
        }
      }, 1000);
    } catch (err) {
      console.error("Transfer failed:", err);
      setTransferring(false);
    }
  }

  const canTransferRight =
    leftSelection.length > 0 && leftDeviceId && rightDeviceId;
  const canTransferLeft =
    rightSelection.length > 0 && leftDeviceId && rightDeviceId;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-vault-text">File Manager</h1>

      {/* Transfer buttons */}
      <div className="flex items-center justify-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => startTransfer("left-to-right", "copy")}
          disabled={!canTransferRight || transferring}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-vault-amber/20 text-vault-amber border border-vault-amber/30 hover:bg-vault-amber/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Copy →
        </button>
        <button
          type="button"
          onClick={() => startTransfer("left-to-right", "move")}
          disabled={!canTransferRight || transferring}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-vault-amber/20 text-vault-amber border border-vault-amber/30 hover:bg-vault-amber/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Move →
        </button>
        <button
          type="button"
          onClick={() => startTransfer("right-to-left", "copy")}
          disabled={!canTransferLeft || transferring}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-vault-amber/20 text-vault-amber border border-vault-amber/30 hover:bg-vault-amber/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ← Copy
        </button>
        <button
          type="button"
          onClick={() => startTransfer("right-to-left", "move")}
          disabled={!canTransferLeft || transferring}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-vault-amber/20 text-vault-amber border border-vault-amber/30 hover:bg-vault-amber/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ← Move
        </button>
      </div>

      {/* Dual panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <FilePanel
          side="left"
          devices={devices}
          selectedDeviceId={leftDeviceId}
          onDeviceChange={setLeftDeviceId}
          onSelectionChange={handleLeftSelection}
          currentPath={leftPath}
          onPathChange={setLeftPath}
          onPreview={(deviceId, path) => setPreview({ deviceId, filePath: path })}
          refreshKey={refreshLeft}
        />
        <FilePanel
          side="right"
          devices={devices}
          selectedDeviceId={rightDeviceId}
          onDeviceChange={setRightDeviceId}
          onSelectionChange={handleRightSelection}
          currentPath={rightPath}
          onPathChange={setRightPath}
          onPreview={(deviceId, path) => setPreview({ deviceId, filePath: path })}
          refreshKey={refreshRight}
        />
      </div>

      {/* Preview modal */}
      {preview && (
        <FilePreviewModal
          deviceId={preview.deviceId}
          filePath={preview.filePath}
          onClose={() => setPreview(null)}
        />
      )}

      {/* Transfer progress */}
      <TransferBar />
    </div>
  );
}
```

- [ ] **Step 2: Run type check**

Run: `pnpm build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/files/page.tsx
git commit -m "feat: add dual-panel file manager page at /files"
```

---

### Task 15: Add Files Link to Header

**Files:**
- Modify: `src/components/layout/header.tsx`

- [ ] **Step 1: Add Files link between Devices and Upload**

In `src/components/layout/header.tsx`, add this link after the Devices link and before the Upload link:

```typescript
      <Link
        href="/files"
        className="px-4 py-2 text-sm font-medium text-vault-muted hover:text-vault-text transition-colors"
      >
        Files
      </Link>
```

- [ ] **Step 2: Run type check**

Run: `pnpm build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/header.tsx
git commit -m "feat: add Files nav link to header"
```

---

### Task 16: Build Verification + Final Type Check

- [ ] **Step 1: Run full build**

Run: `pnpm build`
Expected: PASS — zero errors

- [ ] **Step 2: Manual test checklist**

Start dev server with `pnpm dev` and verify:
1. `/files` page loads with two panels side by side on desktop
2. Each panel shows device selector dropdown with available devices
3. Selecting a device loads the root directory listing with file sizes
4. Clicking a folder navigates into it
5. Back/root buttons work
6. Checkboxes select items, "Select all" works, count and size shown
7. "New Folder" shows inline input, Enter creates, Escape cancels
8. "Rename" shows inline edit when exactly 1 selected
9. "Delete" confirms and removes selected items
10. Clicking a file opens the preview modal (images render, text shows in code block)
11. Transfer buttons ("Copy →", "Move →", etc.) start transfer with progress bar
12. "Files" link appears in header between "Devices" and "Upload"
13. Mobile layout stacks panels vertically

- [ ] **Step 3: Commit any fixes from manual testing**

```bash
git add -u
git commit -m "fix: address issues from manual file manager testing"
```
