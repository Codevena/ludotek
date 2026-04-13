# Device Management & Remote File Browser — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Multi-device management with SSH/FTP remote file browser, configurable scan paths, and editable Steam blacklist.

**Architecture:** New `Device` Prisma model replaces hardcoded scan paths. A connection abstraction layer supports SSH and FTP. A remote file browser API lets users navigate device file systems from the web UI. The scanner is refactored to iterate over devices and their configured paths.

**Tech Stack:** Next.js 14, Prisma 6.x (SQLite), ssh2, basic-ftp (new), React, Tailwind CSS

---

## File Structure

| File | Role |
|------|------|
| `prisma/schema.prisma` | MODIFY — Add Device model |
| `src/lib/connection.ts` | CREATE — DeviceConnection interface, SshConnection, FtpConnection |
| `src/lib/scanner.ts` | MODIFY — Refactor to scanDevice(device), blacklist filtering |
| `src/app/api/devices/route.ts` | CREATE — GET (list) + POST (create) devices |
| `src/app/api/devices/[id]/route.ts` | CREATE — GET + PUT + DELETE single device |
| `src/app/api/devices/[id]/browse/route.ts` | CREATE — File browser endpoint |
| `src/app/api/devices/[id]/test/route.ts` | CREATE — Connection test endpoint |
| `src/app/api/devices/[id]/scan/route.ts` | CREATE — Per-device scan |
| `src/app/api/scan/route.ts` | MODIFY — Iterate over all devices |
| `src/app/devices/page.tsx` | CREATE — Devices page with file browser + path config |
| `src/components/file-browser.tsx` | CREATE — File browser component |
| `src/components/device-form.tsx` | CREATE — Device add/edit form component |
| `src/app/admin/page.tsx` | MODIFY — Add Devices section |
| `src/components/layout/header.tsx` | MODIFY — Add Devices nav link |

---

### Task 1: Prisma Schema — Add Device Model

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add Device model to schema**

Add at the end of `prisma/schema.prisma`, before the closing of the file:

```prisma
model Device {
  id        Int      @id @default(autoincrement())
  name      String
  type      String   @default("custom")
  protocol  String   @default("ssh")
  host      String
  port      Int      @default(22)
  user      String
  password  String
  scanPaths String   @default("[]")
  blacklist String   @default("[]")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

- [ ] **Step 2: Run migration**

Run: `npx prisma migrate dev --name add-device-model`
Expected: Migration created and applied, `prisma/migrations/` has new folder.

- [ ] **Step 3: Verify Prisma client generation**

Run: `npx prisma generate`
Expected: "Generated Prisma Client"

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add Device model to Prisma schema"
```

---

### Task 2: Install basic-ftp Dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install basic-ftp**

Run: `pnpm add basic-ftp`
Expected: Package added to dependencies in package.json.

- [ ] **Step 2: Verify import works**

Run: `node -e "require('basic-ftp'); console.log('ok')"`
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add basic-ftp dependency for FTP device support"
```

---

### Task 3: Connection Abstraction Layer

**Files:**
- Create: `src/lib/connection.ts`

- [ ] **Step 1: Create the connection module**

Create `src/lib/connection.ts`:

```typescript
import { Client as SshClient } from "ssh2";
import { Client as FtpClient } from "basic-ftp";

export interface DirEntry {
  name: string;
  type: "dir" | "file";
}

export interface BrowseResult {
  path: string;
  parent: string | null;
  entries: DirEntry[];
}

export interface DeviceConnection {
  listDir(path: string): Promise<DirEntry[]>;
  disconnect(): void;
}

interface ConnectionConfig {
  protocol: "ssh" | "ftp";
  host: string;
  port: number;
  user: string;
  password: string;
}

const CONNECT_TIMEOUT = 10_000;
const MAX_ENTRIES = 500;

function sshExec(conn: SshClient, command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("SSH command timeout")), 15_000);
    conn.exec(command, (err, stream) => {
      if (err) { clearTimeout(timer); return reject(err); }
      let data = "";
      stream.on("data", (chunk: Buffer) => { data += chunk.toString(); });
      stream.stderr.on("data", (chunk: Buffer) => {
        console.warn("SSH stderr:", chunk.toString());
      });
      stream.on("close", () => { clearTimeout(timer); resolve(data.trim()); });
    });
  });
}

class SshConnection implements DeviceConnection {
  private conn: SshClient;

  constructor(conn: SshClient) {
    this.conn = conn;
  }

  async listDir(path: string): Promise<DirEntry[]> {
    // List entries with type indicator: / suffix for dirs
    const raw = await sshExec(
      this.conn,
      `ls -1p "${path.replace(/"/g, '\\"')}" 2>/dev/null | head -${MAX_ENTRIES}`
    );
    if (!raw) return [];
    return raw
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => {
        const trimmed = line.trim();
        if (trimmed.endsWith("/")) {
          return { name: trimmed.slice(0, -1), type: "dir" as const };
        }
        return { name: trimmed, type: "file" as const };
      })
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }

  disconnect(): void {
    this.conn.end();
  }
}

class FtpConnection implements DeviceConnection {
  private client: FtpClient;

  constructor(client: FtpClient) {
    this.client = client;
  }

  async listDir(path: string): Promise<DirEntry[]> {
    const list = await this.client.list(path);
    return list
      .slice(0, MAX_ENTRIES)
      .map((entry) => ({
        name: entry.name,
        type: entry.isDirectory ? ("dir" as const) : ("file" as const),
      }))
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }

  disconnect(): void {
    this.client.close();
  }
}

export async function createConnection(
  config: ConnectionConfig
): Promise<DeviceConnection> {
  if (config.protocol === "ftp") {
    const client = new FtpClient();
    client.ftp.verbose = false;
    await client.access({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
    });
    return new FtpConnection(client);
  }

  // SSH
  return new Promise((resolve, reject) => {
    const conn = new SshClient();
    const timer = setTimeout(() => {
      conn.end();
      reject(new Error("SSH connection timeout"));
    }, CONNECT_TIMEOUT);

    conn.on("ready", () => {
      clearTimeout(timer);
      resolve(new SshConnection(conn));
    });
    conn.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    conn.connect({
      host: config.host,
      port: config.port,
      username: config.user,
      password: config.password,
      readyTimeout: CONNECT_TIMEOUT,
    });
  });
}

export function buildBrowseResult(path: string, entries: DirEntry[]): BrowseResult {
  const parent = path === "/" ? null : path.replace(/\/[^/]+\/?$/, "") || "/";
  return { path, parent, entries };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/connection.ts
git commit -m "feat: add connection abstraction layer for SSH and FTP"
```

---

### Task 4: Device CRUD API

**Files:**
- Create: `src/app/api/devices/route.ts`
- Create: `src/app/api/devices/[id]/route.ts`

- [ ] **Step 1: Create device list + create endpoint**

Create `src/app/api/devices/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

const DEFAULT_BLACKLISTS: Record<string, string[]> = {
  steamdeck: [
    "Proton *",
    "SteamLinuxRuntime*",
    "Steamworks Common Redistributables",
    "SteamworksShared",
  ],
  android: [],
  custom: [],
};

export async function GET(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  try {
    const devices = await prisma.device.findMany({
      orderBy: { createdAt: "asc" },
    });
    // Mask passwords
    const masked = devices.map((d) => ({
      ...d,
      password: d.password ? "********" : "",
    }));
    return NextResponse.json({ devices: masked });
  } catch (err) {
    console.error("Failed to fetch devices:", err);
    return NextResponse.json({ error: "Failed to fetch devices" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { name, type, protocol, host, port, user, password } = body;

    if (!name || !host || !user) {
      return NextResponse.json(
        { error: "name, host, and user are required" },
        { status: 400 }
      );
    }

    const blacklist = DEFAULT_BLACKLISTS[type] ?? [];

    const device = await prisma.device.create({
      data: {
        name,
        type: type || "custom",
        protocol: protocol || "ssh",
        host,
        port: port || (protocol === "ftp" ? 21 : 22),
        user,
        password: password || "",
        blacklist: JSON.stringify(blacklist),
      },
    });

    return NextResponse.json(device, { status: 201 });
  } catch (err) {
    console.error("Failed to create device:", err);
    return NextResponse.json({ error: "Failed to create device" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create single device endpoint**

Create `src/app/api/devices/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const { id } = await params;
  const device = await prisma.device.findUnique({ where: { id: Number(id) } });
  if (!device) {
    return NextResponse.json({ error: "Device not found" }, { status: 404 });
  }
  return NextResponse.json({ ...device, password: device.password ? "********" : "" });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const { id } = await params;
  const body = await request.json();

  // Don't overwrite password if masked value sent back
  const existing = await prisma.device.findUnique({ where: { id: Number(id) } });
  if (!existing) {
    return NextResponse.json({ error: "Device not found" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};
  if (body.name !== undefined) updateData.name = body.name;
  if (body.type !== undefined) updateData.type = body.type;
  if (body.protocol !== undefined) updateData.protocol = body.protocol;
  if (body.host !== undefined) updateData.host = body.host;
  if (body.port !== undefined) updateData.port = body.port;
  if (body.user !== undefined) updateData.user = body.user;
  if (body.password !== undefined && body.password !== "********") {
    updateData.password = body.password;
  }
  if (body.scanPaths !== undefined) updateData.scanPaths = JSON.stringify(body.scanPaths);
  if (body.blacklist !== undefined) updateData.blacklist = JSON.stringify(body.blacklist);

  const device = await prisma.device.update({
    where: { id: Number(id) },
    data: updateData,
  });

  return NextResponse.json({ ...device, password: "********" });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const { id } = await params;
  await prisma.device.delete({ where: { id: Number(id) } });
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/devices/
git commit -m "feat: add Device CRUD API endpoints"
```

---

### Task 5: File Browser API + Connection Test API

**Files:**
- Create: `src/app/api/devices/[id]/browse/route.ts`
- Create: `src/app/api/devices/[id]/test/route.ts`

- [ ] **Step 1: Create file browser endpoint**

Create `src/app/api/devices/[id]/browse/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { createConnection, buildBrowseResult } from "@/lib/connection";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const { id } = await params;
  const path = request.nextUrl.searchParams.get("path") || "/";

  const device = await prisma.device.findUnique({ where: { id: Number(id) } });
  if (!device) {
    return NextResponse.json({ error: "Device not found" }, { status: 404 });
  }

  let conn;
  try {
    conn = await createConnection({
      protocol: device.protocol as "ssh" | "ftp",
      host: device.host,
      port: device.port,
      user: device.user,
      password: device.password,
    });

    const entries = await conn.listDir(path);
    return NextResponse.json(buildBrowseResult(path, entries));
  } catch (err) {
    console.error("Browse failed:", err);
    return NextResponse.json(
      { error: `Browse failed: ${err instanceof Error ? err.message : "Unknown error"}` },
      { status: 502 }
    );
  } finally {
    conn?.disconnect();
  }
}
```

- [ ] **Step 2: Create connection test endpoint**

Create `src/app/api/devices/[id]/test/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { createConnection } from "@/lib/connection";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const { id } = await params;
  const device = await prisma.device.findUnique({ where: { id: Number(id) } });
  if (!device) {
    return NextResponse.json({ error: "Device not found" }, { status: 404 });
  }

  let conn;
  try {
    conn = await createConnection({
      protocol: device.protocol as "ssh" | "ftp",
      host: device.host,
      port: device.port,
      user: device.user,
      password: device.password,
    });
    conn.disconnect();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : "Connection failed",
    });
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/devices/[id]/browse/ src/app/api/devices/[id]/test/
git commit -m "feat: add file browser and connection test API endpoints"
```

---

### Task 6: Scanner Refactor — Device-Based Scanning

**Files:**
- Modify: `src/lib/scanner.ts`
- Create: `src/app/api/devices/[id]/scan/route.ts`
- Modify: `src/app/api/scan/route.ts`

- [ ] **Step 1: Add blacklist matching and scanDevice to scanner.ts**

Replace the constants and `scanSteamDeck` function in `src/lib/scanner.ts`. Keep `parseRomListing`, `deduplicateGames`, `sanitizeShellArg`, and `sshExec` as they are. Add at the top of the file after imports:

```typescript
import { createConnection, DeviceConnection } from "./connection";
```

Remove these constants:
```typescript
const ROM_BASE = "/run/media/deck/SD/Emulation/roms";
const STEAM_PATHS = [
  "/run/media/deck/SD/Games",
  "/home/deck/.local/share/Steam/steamapps/common",
];
```

Add the blacklist matcher after `SKIP_FILES`:

```typescript
export function matchesBlacklist(name: string, blacklist: string[]): boolean {
  const lower = name.toLowerCase();
  return blacklist.some((pattern) => {
    const p = pattern.toLowerCase();
    if (p.endsWith("*")) {
      return lower.startsWith(p.slice(0, -1));
    }
    return lower === p;
  });
}
```

Add `scanDevice` after `deduplicateGames`:

```typescript
interface ScanPath {
  path: string;
  type: "rom" | "steam";
}

interface DeviceConfig {
  id: number;
  protocol: "ssh" | "ftp";
  host: string;
  port: number;
  user: string;
  password: string;
  scanPaths: ScanPath[];
  blacklist: string[];
}

export async function scanDevice(device: DeviceConfig): Promise<ScannedGame[]> {
  const conn = await createConnection({
    protocol: device.protocol,
    host: device.host,
    port: device.port,
    user: device.user,
    password: device.password,
  });

  try {
    const allGames: ScannedGame[] = [];

    for (const scanPath of device.scanPaths) {
      if (scanPath.type === "rom") {
        const dirs = await conn.listDir(scanPath.path);
        for (const dir of dirs) {
          if (dir.type !== "dir") continue;
          const subEntries = await conn.listDir(`${scanPath.path}/${dir.name}`);
          const listing = subEntries
            .filter((e) => e.type === "file" || e.type === "dir")
            .map((e) => e.name)
            .join("\n");
          if (listing) {
            const games = parseRomListing(listing, dir.name);
            allGames.push(...games);
          }
        }
      } else {
        // Steam path
        const entries = await conn.listDir(scanPath.path);
        const steamGames = entries
          .filter((e) => e.type === "dir")
          .filter((e) => !matchesBlacklist(e.name, device.blacklist))
          .map((e) => ({
            originalFile: e.name,
            title: e.name,
            platform: "steam",
            platformLabel: "Steam",
            source: "steam" as const,
          }));
        allGames.push(...steamGames);
      }
    }

    return deduplicateGames(allGames);
  } finally {
    conn.disconnect();
  }
}
```

Keep `scanSteamDeck` for now (backward compat during migration), but mark it deprecated:

```typescript
/** @deprecated Use scanDevice() instead */
export async function scanSteamDeck(
```

- [ ] **Step 2: Create per-device scan endpoint**

Create `src/app/api/devices/[id]/scan/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { scanDevice } from "@/lib/scanner";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const { id } = await params;
  const device = await prisma.device.findUnique({ where: { id: Number(id) } });
  if (!device) {
    return NextResponse.json({ error: "Device not found" }, { status: 404 });
  }

  try {
    const scanPaths = JSON.parse(device.scanPaths || "[]");
    const blacklist = JSON.parse(device.blacklist || "[]");

    if (scanPaths.length === 0) {
      return NextResponse.json(
        { error: "No scan paths configured for this device" },
        { status: 400 }
      );
    }

    const games = await scanDevice({
      id: device.id,
      protocol: device.protocol as "ssh" | "ftp",
      host: device.host,
      port: device.port,
      user: device.user,
      password: device.password,
      scanPaths,
      blacklist,
    });

    let newCount = 0;
    let updatedCount = 0;

    for (const game of games) {
      const result = await prisma.game.upsert({
        where: {
          originalFile_platform: {
            originalFile: game.originalFile,
            platform: game.platform,
          },
        },
        update: { title: game.title },
        create: {
          title: game.title,
          originalFile: game.originalFile,
          platform: game.platform,
          platformLabel: game.platformLabel,
          source: game.source,
        },
      });

      if (result.createdAt.getTime() === result.updatedAt.getTime()) {
        newCount++;
      } else {
        updatedCount++;
      }
    }

    // Update platform game counts
    const platformCounts = await prisma.game.groupBy({
      by: ["platform"],
      _count: true,
    });

    await prisma.platform.updateMany({ data: { gameCount: 0 } });

    for (const pc of platformCounts) {
      await prisma.platform.updateMany({
        where: { id: pc.platform },
        data: { gameCount: pc._count },
      });
    }

    const steamCount = platformCounts.find((p) => p.platform === "steam");
    if (steamCount) {
      await prisma.platform.upsert({
        where: { id: "steam" },
        update: { gameCount: steamCount._count },
        create: {
          id: "steam",
          label: "Steam",
          icon: "",
          color: "#171a21",
          gameCount: steamCount._count,
          sortOrder: 19,
        },
      });
    }

    return NextResponse.json({
      success: true,
      device: device.name,
      total: games.length,
      new: newCount,
      updated: updatedCount,
    });
  } catch (err) {
    console.error(`Scan failed for device ${device.name}:`, err);
    return NextResponse.json(
      { error: `Scan failed: ${err instanceof Error ? err.message : "Unknown error"}` },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: Refactor /api/scan to iterate over all devices**

Replace `src/app/api/scan/route.ts` entirely:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { scanDevice } from "@/lib/scanner";

export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  try {
    const devices = await prisma.device.findMany();

    if (devices.length === 0) {
      return NextResponse.json(
        { error: "No devices configured. Add a device in Admin Settings first." },
        { status: 400 }
      );
    }

    let totalNew = 0;
    let totalUpdated = 0;
    let totalGames = 0;
    const results: { device: string; total: number; new: number; updated: number; error?: string }[] = [];

    for (const device of devices) {
      const scanPaths = JSON.parse(device.scanPaths || "[]");
      const blacklist = JSON.parse(device.blacklist || "[]");

      if (scanPaths.length === 0) {
        results.push({ device: device.name, total: 0, new: 0, updated: 0, error: "No scan paths" });
        continue;
      }

      try {
        const games = await scanDevice({
          id: device.id,
          protocol: device.protocol as "ssh" | "ftp",
          host: device.host,
          port: device.port,
          user: device.user,
          password: device.password,
          scanPaths,
          blacklist,
        });

        let newCount = 0;
        let updatedCount = 0;

        for (const game of games) {
          const result = await prisma.game.upsert({
            where: {
              originalFile_platform: {
                originalFile: game.originalFile,
                platform: game.platform,
              },
            },
            update: { title: game.title },
            create: {
              title: game.title,
              originalFile: game.originalFile,
              platform: game.platform,
              platformLabel: game.platformLabel,
              source: game.source,
            },
          });

          if (result.createdAt.getTime() === result.updatedAt.getTime()) {
            newCount++;
          } else {
            updatedCount++;
          }
        }

        totalNew += newCount;
        totalUpdated += updatedCount;
        totalGames += games.length;
        results.push({ device: device.name, total: games.length, new: newCount, updated: updatedCount });
      } catch (err) {
        console.error(`Scan failed for device ${device.name}:`, err);
        results.push({
          device: device.name,
          total: 0,
          new: 0,
          updated: 0,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    // Update platform game counts
    const platformCounts = await prisma.game.groupBy({
      by: ["platform"],
      _count: true,
    });

    await prisma.platform.updateMany({ data: { gameCount: 0 } });

    for (const pc of platformCounts) {
      await prisma.platform.updateMany({
        where: { id: pc.platform },
        data: { gameCount: pc._count },
      });
    }

    const steamCount = platformCounts.find((p) => p.platform === "steam");
    if (steamCount) {
      await prisma.platform.upsert({
        where: { id: "steam" },
        update: { gameCount: steamCount._count },
        create: {
          id: "steam",
          label: "Steam",
          icon: "",
          color: "#171a21",
          gameCount: steamCount._count,
          sortOrder: 19,
        },
      });
    }

    return NextResponse.json({
      success: true,
      total: totalGames,
      new: totalNew,
      updated: totalUpdated,
      devices: results,
    });
  } catch (err) {
    console.error("Scan failed:", err);
    return NextResponse.json(
      { error: `Scan failed: ${err instanceof Error ? err.message : "Unknown error"}` },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/scanner.ts src/app/api/devices/[id]/scan/ src/app/api/scan/route.ts
git commit -m "feat: refactor scanner to device-based scanning with blacklist"
```

---

### Task 7: Auto-Migration — Convert Existing Settings to Device

**Files:**
- Create: `src/lib/migrate-device.ts`
- Modify: `src/app/api/scan/route.ts` (add migration call)

- [ ] **Step 1: Create migration helper**

Create `src/lib/migrate-device.ts`:

```typescript
import { prisma } from "./prisma";

const DEFAULT_STEAM_DECK_PATHS = [
  { path: "/run/media/deck/SD/Emulation/roms", type: "rom" },
  { path: "/run/media/deck/SD/Games", type: "steam" },
  { path: "/home/deck/.local/share/Steam/steamapps/common", type: "steam" },
];

const DEFAULT_STEAM_DECK_BLACKLIST = [
  "Proton *",
  "SteamLinuxRuntime*",
  "Steamworks Common Redistributables",
  "SteamworksShared",
];

export async function migrateSettingsToDevice(): Promise<void> {
  // Only run if no devices exist yet
  const deviceCount = await prisma.device.count();
  if (deviceCount > 0) return;

  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  if (!settings?.deckHost) return;

  await prisma.device.create({
    data: {
      name: "Steam Deck",
      type: "steamdeck",
      protocol: "ssh",
      host: settings.deckHost,
      port: 22,
      user: settings.deckUser || "deck",
      password: settings.deckPassword || "",
      scanPaths: JSON.stringify(DEFAULT_STEAM_DECK_PATHS),
      blacklist: JSON.stringify(DEFAULT_STEAM_DECK_BLACKLIST),
    },
  });

  console.warn("Migrated Steam Deck SSH settings to Device model");
}
```

- [ ] **Step 2: Call migration at scan time**

Add to the top of the `POST` function in `src/app/api/scan/route.ts`, right after the auth check:

```typescript
import { migrateSettingsToDevice } from "@/lib/migrate-device";
```

And inside POST, after `if (authError) return authError;`:

```typescript
    // Auto-migrate legacy settings to device model
    await migrateSettingsToDevice();
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/migrate-device.ts src/app/api/scan/route.ts
git commit -m "feat: auto-migrate legacy SSH settings to Device model"
```

---

### Task 8: Device Form Component

**Files:**
- Create: `src/components/device-form.tsx`

- [ ] **Step 1: Create the device form component**

Create `src/components/device-form.tsx`:

```tsx
"use client";

import { useState } from "react";

interface DeviceFormData {
  name: string;
  type: string;
  protocol: string;
  host: string;
  port: number;
  user: string;
  password: string;
}

interface DeviceFormProps {
  initial?: Partial<DeviceFormData>;
  onSubmit: (data: DeviceFormData) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
}

export function DeviceForm({ initial, onSubmit, onCancel, submitLabel = "Save" }: DeviceFormProps) {
  const [form, setForm] = useState<DeviceFormData>({
    name: initial?.name || "",
    type: initial?.type || "steamdeck",
    protocol: initial?.protocol || "ssh",
    host: initial?.host || "",
    port: initial?.port || 22,
    user: initial?.user || "deck",
    password: initial?.password || "",
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null);

  const inputClass =
    "w-full bg-vault-bg border border-vault-border rounded-lg px-3 py-2 text-sm text-vault-text placeholder-vault-muted focus:outline-none focus:border-vault-amber/50";

  function handleTypeChange(type: string) {
    const defaults: Record<string, Partial<DeviceFormData>> = {
      steamdeck: { protocol: "ssh", port: 22, user: "deck" },
      android: { protocol: "ftp", port: 21, user: "" },
      custom: { protocol: "ssh", port: 22, user: "" },
    };
    setForm({ ...form, type, ...defaults[type] });
    setTestResult(null);
  }

  async function handleSubmit() {
    setSaving(true);
    try {
      await onSubmit(form);
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      // Create temp device to test, or test existing
      const res = await fetch("/api/devices/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          protocol: form.protocol,
          host: form.host,
          port: form.port,
          user: form.user,
          password: form.password,
        }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch {
      setTestResult({ ok: false, error: "Request failed" });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Name */}
      <div>
        <label className="text-vault-muted text-xs mb-1 block">Device Name</label>
        <input
          className={inputClass}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Steam Deck Wohnzimmer"
        />
      </div>

      {/* Type */}
      <div>
        <label className="text-vault-muted text-xs mb-2 block">Device Type</label>
        <div className="flex gap-2">
          {[
            { value: "steamdeck", label: "Steam Deck" },
            { value: "android", label: "Android" },
            { value: "custom", label: "Custom" },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleTypeChange(opt.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
                form.type === opt.value
                  ? "border-vault-amber bg-vault-amber/10 text-vault-amber"
                  : "border-vault-border text-vault-muted hover:border-vault-muted"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Protocol */}
      <div>
        <label className="text-vault-muted text-xs mb-2 block">Protocol</label>
        <div className="flex gap-2">
          {[
            { value: "ssh", label: "SSH" },
            { value: "ftp", label: "FTP" },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                setForm({ ...form, protocol: opt.value, port: opt.value === "ftp" ? 21 : 22 });
                setTestResult(null);
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
                form.protocol === opt.value
                  ? "border-vault-amber bg-vault-amber/10 text-vault-amber"
                  : "border-vault-border text-vault-muted hover:border-vault-muted"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Host + Port */}
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <label className="text-vault-muted text-xs mb-1 block">Host</label>
          <input
            className={inputClass}
            value={form.host}
            onChange={(e) => { setForm({ ...form, host: e.target.value }); setTestResult(null); }}
            placeholder="192.168.178.131"
          />
        </div>
        <div>
          <label className="text-vault-muted text-xs mb-1 block">Port</label>
          <input
            className={inputClass}
            type="number"
            value={form.port}
            onChange={(e) => setForm({ ...form, port: Number(e.target.value) })}
          />
        </div>
      </div>

      {/* User + Password */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-vault-muted text-xs mb-1 block">User</label>
          <input
            className={inputClass}
            value={form.user}
            onChange={(e) => { setForm({ ...form, user: e.target.value }); setTestResult(null); }}
            placeholder="deck"
          />
        </div>
        <div>
          <label className="text-vault-muted text-xs mb-1 block">Password</label>
          <input
            className={inputClass}
            type="password"
            value={form.password}
            onChange={(e) => { setForm({ ...form, password: e.target.value }); setTestResult(null); }}
          />
        </div>
      </div>

      {/* Test Connection */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleTest}
          disabled={testing || !form.host || !form.user}
          className="px-4 py-2 text-sm font-medium rounded-lg border border-vault-border text-vault-muted hover:text-vault-text hover:border-vault-amber/50 transition-all disabled:opacity-50"
        >
          {testing ? "Testing..." : "Test Connection"}
        </button>
        {testResult && (
          <span className={`text-sm font-medium ${testResult.ok ? "text-green-400" : "text-red-400"}`}>
            {testResult.ok ? "Connected!" : testResult.error || "Connection failed"}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={handleSubmit}
          disabled={saving || !form.name || !form.host || !form.user}
          className="px-6 py-2.5 text-sm font-medium rounded-lg bg-vault-amber text-black hover:bg-vault-amber-hover transition-colors disabled:opacity-50"
        >
          {saving ? "Saving..." : submitLabel}
        </button>
        <button
          onClick={onCancel}
          className="px-6 py-2.5 text-sm font-medium rounded-lg border border-vault-border text-vault-muted hover:text-vault-text transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the test-connection API for inline testing (before device is saved)**

Create `src/app/api/devices/test-connection/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createConnection } from "@/lib/connection";

export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const body = await request.json();
  const { protocol, host, port, user, password } = body;

  let conn;
  try {
    conn = await createConnection({
      protocol: protocol || "ssh",
      host,
      port: port || 22,
      user,
      password: password || "",
    });
    conn.disconnect();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : "Connection failed",
    });
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/device-form.tsx src/app/api/devices/test-connection/
git commit -m "feat: add device form component with connection testing"
```

---

### Task 9: File Browser Component

**Files:**
- Create: `src/components/file-browser.tsx`

- [ ] **Step 1: Create the file browser component**

Create `src/components/file-browser.tsx`:

```tsx
"use client";

import { useState, useCallback } from "react";

interface DirEntry {
  name: string;
  type: "dir" | "file";
}

interface FileBrowserProps {
  deviceId: number;
  onAddPath: (path: string, type: "rom" | "steam") => void;
  existingPaths: string[];
}

export function FileBrowser({ deviceId, onAddPath, existingPaths }: FileBrowserProps) {
  const [currentPath, setCurrentPath] = useState("/");
  const [entries, setEntries] = useState<DirEntry[]>([]);
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const browse = useCallback(
    async (path: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/devices/${deviceId}/browse?path=${encodeURIComponent(path)}`
        );
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Browse failed");
          return;
        }
        setCurrentPath(data.path);
        setParentPath(data.parent);
        setEntries(data.entries);
      } catch {
        setError("Connection failed");
      } finally {
        setLoading(false);
      }
    },
    [deviceId]
  );

  // Initial load
  const [initialized, setInitialized] = useState(false);
  if (!initialized) {
    setInitialized(true);
    browse("/");
  }

  const isAlreadyAdded = existingPaths.includes(currentPath);

  return (
    <div className="bg-vault-surface border border-vault-border rounded-xl overflow-hidden">
      {/* Path bar */}
      <div className="px-4 py-3 border-b border-vault-border flex items-center gap-2">
        <button
          onClick={() => parentPath && browse(parentPath)}
          disabled={!parentPath || loading}
          className="p-1.5 rounded-lg border border-vault-border text-vault-muted hover:text-vault-text hover:border-vault-amber/50 transition-all disabled:opacity-30"
          aria-label="Go to parent"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          onClick={() => browse("/")}
          disabled={loading}
          className="p-1.5 rounded-lg border border-vault-border text-vault-muted hover:text-vault-text hover:border-vault-amber/50 transition-all disabled:opacity-30 text-xs font-medium"
        >
          /
        </button>
        <code className="text-sm text-vault-text flex-1 truncate">{currentPath}</code>
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-3 bg-red-500/10 border-b border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Entry list */}
      <div className="max-h-[400px] overflow-y-auto">
        {loading ? (
          <div className="px-4 py-8 text-center text-vault-muted text-sm">Loading...</div>
        ) : entries.length === 0 ? (
          <div className="px-4 py-8 text-center text-vault-muted text-sm">Empty directory</div>
        ) : (
          entries.map((entry) => (
            <div
              key={entry.name}
              className={`flex items-center gap-3 px-4 py-2 border-b border-vault-border/50 last:border-b-0 ${
                entry.type === "dir"
                  ? "hover:bg-vault-amber/5 cursor-pointer"
                  : "opacity-40"
              }`}
              onClick={() => entry.type === "dir" && browse(`${currentPath === "/" ? "" : currentPath}/${entry.name}`)}
            >
              {/* Icon */}
              <span className="text-sm">
                {entry.type === "dir" ? "\uD83D\uDCC1" : "\uD83D\uDCC4"}
              </span>
              {/* Name */}
              <span className={`text-sm flex-1 truncate ${entry.type === "dir" ? "text-vault-text" : "text-vault-muted"}`}>
                {entry.name}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Add Path Buttons */}
      <div className="px-4 py-3 border-t border-vault-border flex items-center gap-2">
        <span className="text-vault-muted text-xs mr-auto">Add this folder as:</span>
        <button
          onClick={() => onAddPath(currentPath, "rom")}
          disabled={isAlreadyAdded}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-purple-500/30 text-purple-400 hover:bg-purple-500/10 transition-all disabled:opacity-30"
        >
          + ROM Path
        </button>
        <button
          onClick={() => onAddPath(currentPath, "steam")}
          disabled={isAlreadyAdded}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-vault-amber/30 text-vault-amber hover:bg-vault-amber/10 transition-all disabled:opacity-30"
        >
          + Steam Path
        </button>
        {isAlreadyAdded && (
          <span className="text-green-400 text-xs">Already added</span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/file-browser.tsx
git commit -m "feat: add remote file browser component"
```

---

### Task 10: Devices Page

**Files:**
- Create: `src/app/devices/page.tsx`

- [ ] **Step 1: Create the devices page**

Create `src/app/devices/page.tsx`:

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { FileBrowser } from "@/components/file-browser";

interface ScanPath {
  path: string;
  type: "rom" | "steam";
}

interface Device {
  id: number;
  name: string;
  type: string;
  protocol: string;
  host: string;
  port: number;
  user: string;
  scanPaths: string;
  blacklist: string;
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [newBlacklistEntry, setNewBlacklistEntry] = useState("");

  const selected = devices.find((d) => d.id === selectedId) || null;
  const scanPaths: ScanPath[] = selected ? JSON.parse(selected.scanPaths || "[]") : [];
  const blacklist: string[] = selected ? JSON.parse(selected.blacklist || "[]") : [];

  const loadDevices = useCallback(async () => {
    try {
      const res = await fetch("/api/devices");
      const data = await res.json();
      setDevices(data.devices || []);
      if (data.devices?.length > 0 && !selectedId) {
        setSelectedId(data.devices[0].id);
      }
    } catch (err) {
      console.error("Failed to load devices:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => { loadDevices(); }, [loadDevices]);

  async function updateDevice(id: number, update: Record<string, unknown>) {
    const res = await fetch(`/api/devices/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(update),
    });
    if (res.ok) await loadDevices();
  }

  function handleAddPath(path: string, type: "rom" | "steam") {
    if (!selected) return;
    const current: ScanPath[] = JSON.parse(selected.scanPaths || "[]");
    if (current.some((p) => p.path === path)) return;
    updateDevice(selected.id, { scanPaths: [...current, { path, type }] });
  }

  function handleRemovePath(path: string) {
    if (!selected) return;
    const current: ScanPath[] = JSON.parse(selected.scanPaths || "[]");
    updateDevice(selected.id, { scanPaths: current.filter((p) => p.path !== path) });
  }

  function handleRemoveBlacklist(entry: string) {
    if (!selected) return;
    const current: string[] = JSON.parse(selected.blacklist || "[]");
    updateDevice(selected.id, { blacklist: current.filter((b) => b !== entry) });
  }

  function handleAddBlacklist() {
    if (!selected || !newBlacklistEntry.trim()) return;
    const current: string[] = JSON.parse(selected.blacklist || "[]");
    if (current.includes(newBlacklistEntry.trim())) return;
    updateDevice(selected.id, { blacklist: [...current, newBlacklistEntry.trim()] });
    setNewBlacklistEntry("");
  }

  async function handleScan() {
    if (!selected) return;
    setScanning(true);
    setScanResult(null);
    try {
      const res = await fetch(`/api/devices/${selected.id}/scan`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setScanResult(`Found ${data.total} games (${data.new} new, ${data.updated} updated)`);
      } else {
        setScanResult(`Error: ${data.error}`);
      }
    } catch {
      setScanResult("Scan request failed");
    } finally {
      setScanning(false);
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-vault-surface rounded w-48 mb-6" />
        <div className="h-64 bg-vault-surface rounded" />
      </div>
    );
  }

  return (
    <div>
      {/* Breadcrumbs */}
      <nav className="text-sm text-vault-muted mb-6">
        <Link href="/" className="hover:text-vault-text transition-colors">Home</Link>
        <span className="mx-2">/</span>
        <span className="text-vault-text">Devices</span>
      </nav>

      <h1 className="font-heading text-2xl font-bold mb-6">Devices</h1>

      {devices.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-vault-muted text-lg mb-2">No devices configured</p>
          <p className="text-vault-muted text-sm">
            Add a device in <Link href="/admin" className="text-vault-amber hover:underline">Admin Settings</Link> to get started.
          </p>
        </div>
      ) : (
        <>
          {/* Device Selector */}
          <div className="mb-6">
            <select
              value={selectedId || ""}
              onChange={(e) => { setSelectedId(Number(e.target.value)); setScanResult(null); }}
              className="bg-vault-surface border border-vault-border rounded-lg px-4 py-2.5 text-sm text-vault-text focus:outline-none focus:border-vault-amber/50"
            >
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.host})
                </option>
              ))}
            </select>
          </div>

          {selected && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: File Browser */}
              <div>
                <h2 className="text-sm font-semibold text-vault-muted uppercase tracking-wider mb-3">
                  File Browser
                </h2>
                <FileBrowser
                  deviceId={selected.id}
                  onAddPath={handleAddPath}
                  existingPaths={scanPaths.map((p) => p.path)}
                />
              </div>

              {/* Right: Configuration */}
              <div className="space-y-6">
                {/* Scan Paths */}
                <div>
                  <h2 className="text-sm font-semibold text-vault-muted uppercase tracking-wider mb-3">
                    Scan Paths
                  </h2>
                  <div className="bg-vault-surface border border-vault-border rounded-xl overflow-hidden">
                    {scanPaths.length === 0 ? (
                      <p className="px-4 py-6 text-vault-muted text-sm text-center">
                        No paths configured. Use the file browser to add scan paths.
                      </p>
                    ) : (
                      scanPaths.map((sp) => (
                        <div
                          key={sp.path}
                          className="flex items-center gap-3 px-4 py-2.5 border-b border-vault-border/50 last:border-b-0"
                        >
                          <span
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                              sp.type === "rom"
                                ? "bg-purple-500/15 text-purple-400"
                                : "bg-vault-amber/15 text-vault-amber"
                            }`}
                          >
                            {sp.type}
                          </span>
                          <code className="text-sm text-vault-text flex-1 truncate">{sp.path}</code>
                          <button
                            onClick={() => handleRemovePath(sp.path)}
                            className="text-red-400 hover:text-red-300 text-sm transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Blacklist */}
                <div>
                  <h2 className="text-sm font-semibold text-vault-muted uppercase tracking-wider mb-3">
                    Blacklist
                  </h2>
                  <div className="bg-vault-surface border border-vault-border rounded-xl overflow-hidden">
                    {blacklist.length === 0 ? (
                      <p className="px-4 py-4 text-vault-muted text-sm text-center">No blacklist entries</p>
                    ) : (
                      blacklist.map((entry) => (
                        <div
                          key={entry}
                          className="flex items-center gap-3 px-4 py-2 border-b border-vault-border/50 last:border-b-0"
                        >
                          <code className="text-sm text-vault-text flex-1">{entry}</code>
                          <button
                            onClick={() => handleRemoveBlacklist(entry)}
                            className="text-red-400 hover:text-red-300 text-sm transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      ))
                    )}
                    <div className="flex items-center gap-2 px-4 py-2.5 border-t border-vault-border/50">
                      <input
                        className="flex-1 bg-vault-bg border border-vault-border rounded-lg px-3 py-1.5 text-sm text-vault-text placeholder-vault-muted focus:outline-none focus:border-vault-amber/50"
                        value={newBlacklistEntry}
                        onChange={(e) => setNewBlacklistEntry(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAddBlacklist()}
                        placeholder="e.g. Proton *"
                      />
                      <button
                        onClick={handleAddBlacklist}
                        disabled={!newBlacklistEntry.trim()}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-vault-amber/30 text-vault-amber hover:bg-vault-amber/10 transition-all disabled:opacity-30"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>

                {/* Scan Button */}
                <button
                  onClick={handleScan}
                  disabled={scanning || scanPaths.length === 0}
                  className="w-full py-3 rounded-xl font-medium text-sm bg-vault-amber text-black hover:bg-vault-amber-hover transition-colors disabled:opacity-50"
                >
                  {scanning ? "Scanning..." : "Scan Device"}
                </button>
                {scanResult && (
                  <p className={`text-sm font-medium ${scanResult.startsWith("Error") ? "text-red-400" : "text-green-400"}`}>
                    {scanResult}
                  </p>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/devices/page.tsx
git commit -m "feat: add Devices page with file browser and path management"
```

---

### Task 11: Admin Settings — Devices Section

**Files:**
- Modify: `src/app/admin/page.tsx`

- [ ] **Step 1: Add device management state and fetch**

In `src/app/admin/page.tsx`, add imports and state. After the existing imports at the top, add:

```typescript
import { DeviceForm } from "@/components/device-form";
```

Inside the `AdminPage` component, after the existing state declarations (around line 47), add:

```typescript
  const [devices, setDevices] = useState<Array<{ id: number; name: string; type: string; host: string; protocol: string }>>([]);
  const [showDeviceForm, setShowDeviceForm] = useState(false);
```

Inside the `loadSettings` function (or near it), add a `loadDevices` function:

```typescript
  function loadDevices() {
    fetch("/api/devices")
      .then((r) => r.json())
      .then((data) => setDevices(data.devices || []))
      .catch((err) => console.error("Failed to load devices:", err));
  }
```

Call `loadDevices()` alongside `loadSettings()` wherever `loadSettings` is called (after auth succeeds).

- [ ] **Step 2: Add Devices section to the settings form**

Find the ROM Search section in the JSX (the `<div className="space-y-4">` containing "ROM Search" heading). Insert the following new section BEFORE it:

```tsx
        <div className="space-y-4">
          <h3 className="text-vault-amber text-sm font-semibold uppercase tracking-wide">Devices</h3>
          {devices.length === 0 ? (
            <p className="text-vault-muted text-sm">No devices configured yet.</p>
          ) : (
            <div className="space-y-2">
              {devices.map((d) => (
                <div key={d.id} className="flex items-center gap-3 bg-vault-bg border border-vault-border rounded-lg px-4 py-3">
                  <span className="text-sm font-medium text-vault-text flex-1">{d.name}</span>
                  <span className="text-xs text-vault-muted">{d.host} ({d.protocol.toUpperCase()})</span>
                  <button
                    onClick={async () => {
                      if (confirm(`Delete device "${d.name}"?`)) {
                        await fetch(`/api/devices/${d.id}`, { method: "DELETE" });
                        loadDevices();
                      }
                    }}
                    className="text-red-400 hover:text-red-300 text-xs transition-colors"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
          {showDeviceForm ? (
            <div className="bg-vault-bg border border-vault-border rounded-xl p-4">
              <DeviceForm
                onSubmit={async (data) => {
                  await fetch("/api/devices", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data),
                  });
                  setShowDeviceForm(false);
                  loadDevices();
                }}
                onCancel={() => setShowDeviceForm(false)}
                submitLabel="Add Device"
              />
            </div>
          ) : (
            <button
              onClick={() => setShowDeviceForm(true)}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-vault-amber/30 text-vault-amber hover:bg-vault-amber/10 transition-all"
            >
              + Add Device
            </button>
          )}
          {devices.length > 0 && (
            <a href="/devices" className="text-vault-amber text-sm hover:underline block">
              Manage scan paths and blacklist on the Devices page &rarr;
            </a>
          )}
        </div>
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/page.tsx
git commit -m "feat: add Devices section to Admin Settings page"
```

---

### Task 12: Header — Add Devices Nav Link

**Files:**
- Modify: `src/components/layout/header.tsx`

- [ ] **Step 1: Add Devices link to header**

In `src/components/layout/header.tsx`, add a new `Link` after the Discover link and before the Upload link:

```tsx
      <Link
        href="/devices"
        className="px-4 py-2 text-sm font-medium text-vault-muted hover:text-vault-text transition-colors"
      >
        Devices
      </Link>
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/header.tsx
git commit -m "feat: add Devices link to header navigation"
```

---

### Task 13: Build Verification + Full Test

- [ ] **Step 1: Run full build**

Run: `pnpm build`
Expected: Build completes without errors.

- [ ] **Step 2: Start dev server and verify**

Run: `pnpm dev`

Test manually:
1. Go to `/admin` — verify Devices section appears, click "Add Device"
2. Add a device (Steam Deck, SSH, your host/credentials)
3. Test connection — verify green "Connected!" response
4. Go to `/devices` — verify device dropdown, file browser loads
5. Navigate file browser — click folders, verify navigation works
6. Add a ROM path and a Steam path — verify they appear in right column
7. Add a blacklist entry — verify it appears
8. Click "Scan Device" — verify scan runs and reports results
9. Check game list — verify Proton/SteamLinuxRuntime entries are filtered

- [ ] **Step 3: Commit any fixes**

If any issues were found during testing, fix and commit.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete device management with remote file browser"
```
