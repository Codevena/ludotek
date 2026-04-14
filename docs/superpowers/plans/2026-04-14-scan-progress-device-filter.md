# Scan Progress + Device Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a GameDevice join model linking games to devices, an enrichment-style scan progress bar with async scanning, a device filter in the header that filters the library, and device badges on game cards.

**Architecture:** The scan becomes async — POST /api/scan returns immediately while work runs in the background. An in-memory Map tracks progress, polled by the frontend ScanContext every 2s. The header device selector triggers `router.refresh()` after updating settings, causing server components to re-fetch with the active device filter applied via GameDevice joins. Games API includes device associations for badge rendering.

**Tech Stack:** Next.js 14 (App Router), Prisma 6 (SQLite), React Context + polling, Tailwind CSS

---

## File Structure

| File | Responsibility |
|------|---------------|
| `prisma/schema.prisma` | Add GameDevice model + relations |
| `src/lib/scan-progress.ts` | NEW — In-memory scan progress store (Map) |
| `src/lib/scan-runner.ts` | NEW — Async scan orchestrator (runs in background, updates progress store) |
| `src/app/api/scan/route.ts` | Refactor POST to async, return scanId |
| `src/app/api/scan/status/route.ts` | NEW — GET endpoint returning scan progress |
| `src/app/api/devices/[id]/scan/route.ts` | Refactor POST to async, return scanId |
| `src/context/scan-context.tsx` | NEW — ScanContext provider (polls /api/scan/status) |
| `src/components/scan-bar.tsx` | NEW — Sticky progress bar (mirrors EnrichmentBar pattern) |
| `src/app/layout.tsx` | Add ScanProvider + ScanBar |
| `src/app/api/games/route.ts` | Add deviceId filter + include device associations |
| `src/app/page.tsx` | Read activeDeviceId, apply filter, pass deviceId to fetchUrl |
| `src/app/platform/[id]/page.tsx` | Read activeDeviceId, apply filter, pass deviceId to fetchUrl |
| `src/components/layout/header.tsx` | Add router.refresh() on device change |
| `src/components/game-card.tsx` | Add device badge pills |
| `src/components/infinite-game-grid.tsx` | Pass device data through to GameCard |
| `src/app/devices/page.tsx` | Use ScanContext instead of local scan state |

---

### Task 1: GameDevice Prisma Model + Migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add GameDevice model and relations to schema**

In `prisma/schema.prisma`, add the GameDevice model and update Game + Device with relations:

```prisma
model GameDevice {
  id       Int    @id @default(autoincrement())
  gameId   Int
  deviceId Int
  game     Game   @relation(fields: [gameId], references: [id], onDelete: Cascade)
  device   Device @relation(fields: [deviceId], references: [id], onDelete: Cascade)

  @@unique([gameId, deviceId])
}
```

Add to the existing `Game` model (after the `updatedAt` field):

```prisma
  devices   GameDevice[]
```

Add to the existing `Device` model (after the `updatedAt` field):

```prisma
  games     GameDevice[]
```

- [ ] **Step 2: Run Prisma migration**

Run: `pnpm prisma migrate dev --name add-game-device`
Expected: Migration creates `GameDevice` table with indexes and foreign keys.

- [ ] **Step 3: Verify Prisma client generates**

Run: `pnpm prisma generate`
Expected: Client regenerated with GameDevice model and relations.

- [ ] **Step 4: Commit**

```bash
git add prisma/
git commit -m "feat: add GameDevice join model for game-device relationships"
```

---

### Task 2: In-Memory Scan Progress Store

**Files:**
- Create: `src/lib/scan-progress.ts`

- [ ] **Step 1: Create the scan progress store module**

```typescript
export interface ScanProgress {
  scanning: boolean;
  progress: number; // 0-100
  status: string;
  gamesFound: number;
  newGames: number;
  updatedGames: number;
  totalPaths: number;
  completedPaths: number;
  deviceName: string;
  error?: string;
}

const store = new Map<string, ScanProgress>();

// Only one scan at a time — use a fixed key
const SCAN_KEY = "current";

export function getScanProgress(): ScanProgress | null {
  return store.get(SCAN_KEY) ?? null;
}

export function setScanProgress(progress: ScanProgress): void {
  store.set(SCAN_KEY, progress);
}

export function clearScanProgress(): void {
  store.delete(SCAN_KEY);
}

export function isScanRunning(): boolean {
  const p = store.get(SCAN_KEY);
  return p?.scanning === true;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `pnpm exec tsc --noEmit --pretty`
Expected: No errors related to scan-progress.ts

- [ ] **Step 3: Commit**

```bash
git add src/lib/scan-progress.ts
git commit -m "feat: add in-memory scan progress store"
```

---

### Task 3: Async Scan Runner

**Files:**
- Create: `src/lib/scan-runner.ts`
- Modify: `src/lib/scanner.ts` (add progress callback)

- [ ] **Step 1: Add progress callback to scanDevice**

In `src/lib/scanner.ts`, update the `scanDevice` function signature and body to accept an optional `onPathStart` callback. Add this parameter to the function:

```typescript
export async function scanDevice(
  device: DeviceConfig,
  onPathStart?: (pathLabel: string) => void,
): Promise<ScannedGame[]> {
```

Inside the `for (const scanPath of device.scanPaths)` loop, at the start of the try block (before the `if (scanPath.type === "rom")` check), add:

```typescript
        onPathStart?.(scanPath.path);
```

No other changes to scanner.ts.

- [ ] **Step 2: Create the scan runner module**

```typescript
import { prisma } from "@/lib/prisma";
import { scanDevice } from "@/lib/scanner";
import { setScanProgress, clearScanProgress } from "@/lib/scan-progress";
import { migrateSettingsToDevice } from "@/lib/migrate-device";

interface DeviceScanResult {
  device: string;
  total: number;
  new: number;
  updated: number;
  error?: string;
}

export async function runScanInBackground(deviceId?: number): Promise<void> {
  try {
    await migrateSettingsToDevice();

    const devices = deviceId
      ? await prisma.device.findMany({ where: { id: deviceId } })
      : await prisma.device.findMany();

    if (devices.length === 0) {
      setScanProgress({
        scanning: false,
        progress: 100,
        status: "No devices configured",
        gamesFound: 0,
        newGames: 0,
        updatedGames: 0,
        totalPaths: 0,
        completedPaths: 0,
        deviceName: "",
        error: "No devices configured. Add a device in Settings before scanning.",
      });
      return;
    }

    // Count total scan paths across all devices
    let totalPaths = 0;
    const deviceConfigs: {
      device: typeof devices[0];
      scanPaths: { path: string; type: "rom" | "steam" }[];
      blacklist: string[];
    }[] = [];

    for (const device of devices) {
      const scanPaths = JSON.parse(device.scanPaths) as { path: string; type: "rom" | "steam" }[];
      const blacklist = JSON.parse(device.blacklist) as string[];
      totalPaths += scanPaths.length;
      deviceConfigs.push({ device, scanPaths, blacklist });
    }

    let completedPaths = 0;
    let totalGamesFound = 0;
    let totalNew = 0;
    let totalUpdated = 0;
    const deviceResults: DeviceScanResult[] = [];

    setScanProgress({
      scanning: true,
      progress: 0,
      status: "Starting scan...",
      gamesFound: 0,
      newGames: 0,
      updatedGames: 0,
      totalPaths,
      completedPaths: 0,
      deviceName: devices.length === 1 ? devices[0].name : `${devices.length} devices`,
    });

    for (const { device, scanPaths, blacklist } of deviceConfigs) {
      try {
        const games = await scanDevice(
          {
            id: device.id,
            protocol: device.protocol as "ssh" | "ftp",
            host: device.host,
            port: device.port,
            user: device.user,
            password: device.password,
            scanPaths,
            blacklist,
          },
          (pathLabel) => {
            // Extract directory name for status display
            const dirName = pathLabel.split("/").filter(Boolean).pop() || pathLabel;
            setScanProgress({
              scanning: true,
              progress: totalPaths > 0 ? Math.round((completedPaths / totalPaths) * 100) : 0,
              status: `Scanning ${dirName}...`,
              gamesFound: totalGamesFound,
              newGames: totalNew,
              updatedGames: totalUpdated,
              totalPaths,
              completedPaths,
              deviceName: device.name,
            });
            completedPaths++;
          },
        );

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

          // Create GameDevice link
          await prisma.gameDevice.upsert({
            where: {
              gameId_deviceId: {
                gameId: result.id,
                deviceId: device.id,
              },
            },
            update: {},
            create: {
              gameId: result.id,
              deviceId: device.id,
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
        totalGamesFound += games.length;

        deviceResults.push({
          device: device.name,
          total: games.length,
          new: newCount,
          updated: updatedCount,
        });

        setScanProgress({
          scanning: true,
          progress: totalPaths > 0 ? Math.round((completedPaths / totalPaths) * 100) : 0,
          status: `Finished ${device.name}`,
          gamesFound: totalGamesFound,
          newGames: totalNew,
          updatedGames: totalUpdated,
          totalPaths,
          completedPaths,
          deviceName: device.name,
        });
      } catch (err) {
        console.error(`Scan failed for device ${device.name}:`, err);
        deviceResults.push({
          device: device.name,
          total: 0,
          new: 0,
          updated: 0,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    // Update platform game counts
    const platformCounts = await prisma.game.groupBy({ by: ["platform"], _count: true });
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
          icon: "\uD83C\uDFAE",
          color: "#171a21",
          gameCount: steamCount._count,
          sortOrder: 19,
        },
      });
    }

    // Mark scan as complete
    setScanProgress({
      scanning: false,
      progress: 100,
      status: `Scan complete — ${totalGamesFound} games (${totalNew} new, ${totalUpdated} updated)`,
      gamesFound: totalGamesFound,
      newGames: totalNew,
      updatedGames: totalUpdated,
      totalPaths,
      completedPaths: totalPaths,
      deviceName: devices.length === 1 ? devices[0].name : `${devices.length} devices`,
    });

    // Clear progress after 10 seconds
    setTimeout(() => clearScanProgress(), 10000);
  } catch (err) {
    console.error("Background scan failed:", err);
    setScanProgress({
      scanning: false,
      progress: 0,
      status: "Scan failed",
      gamesFound: 0,
      newGames: 0,
      updatedGames: 0,
      totalPaths: 0,
      completedPaths: 0,
      deviceName: "",
      error: err instanceof Error ? err.message : "Unknown error",
    });
    setTimeout(() => clearScanProgress(), 10000);
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `pnpm exec tsc --noEmit --pretty`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/scan-runner.ts src/lib/scanner.ts
git commit -m "feat: add async scan runner with progress tracking and GameDevice linking"
```

---

### Task 4: Refactor Scan API Endpoints to Async

**Files:**
- Modify: `src/app/api/scan/route.ts`
- Create: `src/app/api/scan/status/route.ts`
- Modify: `src/app/api/devices/[id]/scan/route.ts`

- [ ] **Step 1: Rewrite POST /api/scan to be async**

Replace the entire content of `src/app/api/scan/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { isScanRunning } from "@/lib/scan-progress";
import { runScanInBackground } from "@/lib/scan-runner";

export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  if (isScanRunning()) {
    return NextResponse.json(
      { error: "A scan is already running" },
      { status: 409 },
    );
  }

  // Fire and forget — scan runs in background
  runScanInBackground();

  return NextResponse.json({ success: true, message: "Scan started" });
}
```

- [ ] **Step 2: Create GET /api/scan/status**

Create `src/app/api/scan/status/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { getScanProgress } from "@/lib/scan-progress";

export async function GET() {
  const progress = getScanProgress();

  if (!progress) {
    return NextResponse.json({
      scanning: false,
      progress: 0,
      status: "",
      gamesFound: 0,
      newGames: 0,
      updatedGames: 0,
      deviceName: "",
    });
  }

  return NextResponse.json(progress);
}
```

- [ ] **Step 3: Rewrite POST /api/devices/[id]/scan to be async**

Replace the entire content of `src/app/api/devices/[id]/scan/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { isScanRunning } from "@/lib/scan-progress";
import { runScanInBackground } from "@/lib/scan-runner";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const { id } = await params;
  const deviceId = parseInt(id, 10);
  if (isNaN(deviceId)) {
    return NextResponse.json({ error: "Invalid device ID" }, { status: 400 });
  }

  const device = await prisma.device.findUnique({ where: { id: deviceId } });
  if (!device) {
    return NextResponse.json({ error: "Device not found" }, { status: 404 });
  }

  if (isScanRunning()) {
    return NextResponse.json(
      { error: "A scan is already running" },
      { status: 409 },
    );
  }

  // Fire and forget — scan runs in background
  runScanInBackground(deviceId);

  return NextResponse.json({ success: true, message: `Scan started for ${device.name}` });
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `pnpm exec tsc --noEmit --pretty`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/app/api/scan/route.ts src/app/api/scan/status/route.ts src/app/api/devices/\[id\]/scan/route.ts
git commit -m "feat: refactor scan endpoints to async with progress polling"
```

---

### Task 5: ScanContext Provider

**Files:**
- Create: `src/context/scan-context.tsx`

- [ ] **Step 1: Create the ScanContext**

```tsx
"use client";

import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";

interface ScanState {
  scanning: boolean;
  progress: number;
  status: string;
  gamesFound: number;
  newGames: number;
  updatedGames: number;
  deviceName: string;
  error?: string;
  justCompleted: boolean;
  dismissed: boolean;
}

interface ScanContextValue extends ScanState {
  startScan: (deviceId?: number) => Promise<void>;
  dismiss: () => void;
}

const initialState: ScanState = {
  scanning: false,
  progress: 0,
  status: "",
  gamesFound: 0,
  newGames: 0,
  updatedGames: 0,
  deviceName: "",
  justCompleted: false,
  dismissed: false,
};

const ScanContext = createContext<ScanContextValue>({
  ...initialState,
  startScan: async () => {},
  dismiss: () => {},
});

export function useScan() {
  return useContext(ScanContext);
}

export function ScanProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ScanState>(initialState);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const dismiss = useCallback(() => {
    setState((prev) => ({ ...prev, dismissed: true, justCompleted: false }));
    stopPolling();
    if (fadeTimerRef.current) {
      clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
  }, [stopPolling]);

  const pollStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/scan/status");
      if (!res.ok) return;
      const data = await res.json();

      setState((prev) => {
        if (prev.dismissed) return prev;

        // Scan just finished
        if (!data.scanning && prev.scanning) {
          stopPolling();
          // Auto-hide after 5 seconds
          fadeTimerRef.current = setTimeout(() => {
            setState(initialState);
          }, 5000);
          return {
            ...prev,
            ...data,
            scanning: false,
            justCompleted: true,
          };
        }

        if (data.scanning) {
          return { ...prev, ...data, justCompleted: false, dismissed: false };
        }

        return prev;
      });
    } catch {
      // Ignore polling errors
    }
  }, [stopPolling]);

  const startScan = useCallback(
    async (deviceId?: number) => {
      // Clear any previous state
      if (fadeTimerRef.current) {
        clearTimeout(fadeTimerRef.current);
        fadeTimerRef.current = null;
      }
      stopPolling();

      setState({
        scanning: true,
        progress: 0,
        status: "Starting scan...",
        gamesFound: 0,
        newGames: 0,
        updatedGames: 0,
        deviceName: "",
        justCompleted: false,
        dismissed: false,
      });

      try {
        const url = deviceId ? `/api/devices/${deviceId}/scan` : "/api/scan";
        const res = await fetch(url, { method: "POST" });
        const data = await res.json();

        if (!res.ok) {
          setState((prev) => ({
            ...prev,
            scanning: false,
            status: data.error || "Scan failed",
            error: data.error,
          }));
          fadeTimerRef.current = setTimeout(() => setState(initialState), 5000);
          return;
        }

        // Start polling for progress
        pollingRef.current = setInterval(pollStatus, 2000);
      } catch (err) {
        setState((prev) => ({
          ...prev,
          scanning: false,
          status: "Failed to start scan",
          error: String(err),
        }));
        fadeTimerRef.current = setTimeout(() => setState(initialState), 5000);
      }
    },
    [pollStatus, stopPolling],
  );

  // Check if a scan is already running on mount
  useEffect(() => {
    async function checkExisting() {
      try {
        const res = await fetch("/api/scan/status");
        if (!res.ok) return;
        const data = await res.json();
        if (data.scanning) {
          setState({ ...data, justCompleted: false, dismissed: false });
          pollingRef.current = setInterval(pollStatus, 2000);
        }
      } catch {
        // Ignore
      }
    }
    checkExisting();
    return () => {
      stopPolling();
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, [pollStatus, stopPolling]);

  return (
    <ScanContext.Provider value={{ ...state, startScan, dismiss }}>
      {children}
    </ScanContext.Provider>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `pnpm exec tsc --noEmit --pretty`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/context/scan-context.tsx
git commit -m "feat: add ScanContext provider with polling-based progress tracking"
```

---

### Task 6: ScanBar Component

**Files:**
- Create: `src/components/scan-bar.tsx`

- [ ] **Step 1: Create the ScanBar component**

Mirrors the existing `EnrichmentBar` pattern — sticky at bottom, shows progress:

```tsx
"use client";

import { useScan } from "@/context/scan-context";

export function ScanBar() {
  const {
    scanning,
    progress,
    status,
    gamesFound,
    newGames,
    updatedGames,
    justCompleted,
    dismissed,
    dismiss,
  } = useScan();

  if (dismissed || (!scanning && !justCompleted)) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-vault-surface border-t border-vault-border px-4 py-3 shadow-lg">
      <div className="max-w-5xl mx-auto flex items-center gap-4">
        {/* Pulsing dot */}
        <div
          className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
            scanning ? "bg-blue-400 animate-pulse" : "bg-green-400"
          }`}
        />

        {/* Label + status */}
        <div className="flex-shrink-0 text-sm font-medium text-vault-text">
          {scanning ? "Scanning" : "Done"}
          {status && (
            <span className="text-vault-muted ml-1.5 font-normal">{status}</span>
          )}
        </div>

        {/* Progress bar */}
        <div className="flex-1 bg-vault-bg rounded-full h-2 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              scanning ? "bg-blue-400" : "bg-green-400"
            }`}
            style={{ width: `${justCompleted && !scanning ? 100 : progress}%` }}
          />
        </div>

        {/* Counts */}
        <div className="flex-shrink-0 flex items-center gap-3 text-xs text-vault-muted">
          {gamesFound > 0 && <span>{gamesFound} games</span>}
          {newGames > 0 && <span className="text-green-400">{newGames} new</span>}
          {updatedGames > 0 && <span className="text-blue-400">{updatedGames} updated</span>}
        </div>

        {/* Dismiss */}
        <button
          onClick={dismiss}
          className="flex-shrink-0 text-vault-muted hover:text-vault-text transition-colors text-sm"
        >
          <svg
            aria-hidden="true"
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M1 1l12 12M13 1L1 13" />
          </svg>
          <span className="sr-only">Dismiss</span>
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `pnpm exec tsc --noEmit --pretty`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/scan-bar.tsx
git commit -m "feat: add ScanBar sticky progress component"
```

---

### Task 7: Wire ScanProvider + ScanBar into Layout

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Add ScanProvider and ScanBar to layout**

In `src/app/layout.tsx`:

1. Add imports at the top:

```typescript
import { ScanProvider } from "@/context/scan-context";
import { ScanBar } from "@/components/scan-bar";
```

2. Wrap the existing `EnrichmentProvider` content with `ScanProvider`, and add `<ScanBar />` next to `<EnrichmentBar />`:

The body content becomes:

```tsx
<EnrichmentProvider>
  <ScanProvider>
    <Suspense>
      <Sidebar />
    </Suspense>
    <div className="flex-1 flex flex-col min-h-screen min-w-0">
      <Suspense>
        <Header />
      </Suspense>
      <main className="flex-1 p-6 pb-20">{children}</main>
    </div>
    <EnrichmentBar />
    <ScanBar />
  </ScanProvider>
</EnrichmentProvider>
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `pnpm exec tsc --noEmit --pretty`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: wire ScanProvider and ScanBar into root layout"
```

---

### Task 8: Games API — Device Filter + Device Associations

**Files:**
- Modify: `src/app/api/games/route.ts`

- [ ] **Step 1: Add deviceId filter and device includes to games API**

Replace the full content of `src/app/api/games/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const platform = searchParams.get("platform");
  const search = searchParams.get("search");
  const sort = searchParams.get("sort") || "title";
  const order = searchParams.get("order") === "desc" ? "desc" : "asc";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "48", 10) || 48));
  const skip = (page - 1) * limit;

  const favorites = searchParams.get("favorites");
  const tag = searchParams.get("tag");
  const deviceId = searchParams.get("deviceId");

  const where: Record<string, unknown> = {};
  if (platform) where.platform = platform;
  if (search) where.title = { contains: search };
  if (favorites === "true") where.isFavorite = true;
  if (tag) {
    where.OR = [
      { genres: { contains: tag } },
      { themes: { contains: tag } },
    ];
  }
  if (deviceId) {
    where.devices = { some: { deviceId: parseInt(deviceId, 10) } };
  }

  const orderBy: Record<string, string> = {};
  const validSorts = ["title", "igdbScore", "releaseDate", "createdAt"];
  orderBy[validSorts.includes(sort) ? sort : "title"] = order;

  const [games, total] = await Promise.all([
    prisma.game.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: {
        devices: {
          include: { device: { select: { id: true, name: true, type: true } } },
        },
      },
    }),
    prisma.game.count({ where }),
  ]);

  // Flatten device associations for frontend
  const gamesWithDevices = games.map((game) => ({
    ...game,
    devices: game.devices.map((gd) => gd.device),
  }));

  return NextResponse.json({
    games: gamesWithDevices,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `pnpm exec tsc --noEmit --pretty`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/games/route.ts
git commit -m "feat: add deviceId filter and device associations to games API"
```

---

### Task 9: Home Page + Platform Page — Apply Device Filter

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/platform/[id]/page.tsx`

- [ ] **Step 1: Update home page to filter by active device**

In `src/app/page.tsx`:

1. Add `deviceId` to the `searchParams` interface:

```typescript
interface Props {
  searchParams: Promise<{
    search?: string;
    sort?: string;
    order?: string;
    page?: string;
    favorites?: string;
    deviceId?: string;
  }>;
}
```

2. In `HomePage`, after extracting params, read the active device. Add after `const favorites = ...`:

```typescript
  // Device filter: use URL param or fall back to active device from settings
  let deviceId = params.deviceId || null;
  if (!deviceId) {
    const settings = await prisma.settings.findFirst();
    if (settings?.activeDeviceId) {
      deviceId = String(settings.activeDeviceId);
    }
  }
```

3. Add device filter to `where` (after `if (favorites) where.isFavorite = true;`):

```typescript
  if (deviceId) where.devices = { some: { deviceId: parseInt(deviceId, 10) } };
```

4. Update the Prisma queries in `[games, total]` to include device associations:

```typescript
  const [games, total] = await Promise.all([
    prisma.game.findMany({
      where,
      orderBy,
      take: limit,
      include: {
        devices: {
          include: { device: { select: { id: true, name: true, type: true } } },
        },
      },
    }),
    prisma.game.count({ where }),
  ]);

  const gamesWithDevices = games.map((g) => ({
    ...g,
    devices: g.devices.map((gd) => gd.device),
  }));
```

5. Add `deviceId` to the fetch URL for infinite scroll (after `if (favorites) fetchParams.set(...)`):

```typescript
  if (deviceId) fetchParams.set("deviceId", deviceId);
```

6. Update the `RecentlyAdded` and `TopRated` server components similarly — add device filter to their queries. Read `activeDeviceId` from settings inside each:

In `RecentlyAdded`:
```typescript
async function RecentlyAdded() {
  const settings = await prisma.settings.findFirst();
  const deviceId = settings?.activeDeviceId;
  const where: Record<string, unknown> = {};
  if (deviceId) where.devices = { some: { deviceId } };

  const games = await prisma.game.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 6,
    include: {
      devices: {
        include: { device: { select: { id: true, name: true, type: true } } },
      },
    },
  });
  if (games.length === 0) return null;

  const gamesWithDevices = games.map((g) => ({
    ...g,
    devices: g.devices.map((gd) => gd.device),
  }));

  return (
    <section className="mb-8">
      <h2 className="font-heading text-xl font-bold mb-4">Recently Added</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {gamesWithDevices.map((game) => (
          <GameCard key={game.id} id={game.id} title={game.title} coverUrl={game.coverUrl}
            platformLabel={game.platformLabel} igdbScore={game.igdbScore}
            metacriticScore={game.metacriticScore} isFavorite={game.isFavorite}
            devices={game.devices} />
        ))}
      </div>
    </section>
  );
}
```

Apply the same pattern to `TopRated`.

7. Pass `gamesWithDevices` instead of `games` to `InfiniteGameGrid`:

```tsx
<InfiniteGameGrid initialGames={gamesWithDevices} total={total} fetchUrl={fetchUrl} />
```

- [ ] **Step 2: Update platform page to filter by active device**

In `src/app/platform/[id]/page.tsx`:

1. Add `deviceId` to the `searchParams` interface.

2. After building the `where` clause, add:

```typescript
  const settings = await prisma.settings.findFirst();
  const activeDeviceId = settings?.activeDeviceId;
  if (activeDeviceId) where.devices = { some: { deviceId: activeDeviceId } };
```

3. Update the Prisma queries to include device associations (same pattern as home page).

4. Add deviceId to the fetchUrl:

```typescript
  if (activeDeviceId) fetchParams.set("deviceId", String(activeDeviceId));
```

5. Map games to include flattened devices, pass to `InfiniteGameGrid`.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `pnpm exec tsc --noEmit --pretty`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx src/app/platform/\[id\]/page.tsx
git commit -m "feat: apply device filter to home and platform pages"
```

---

### Task 10: Header Device Selector — Trigger Library Refresh

**Files:**
- Modify: `src/components/layout/header.tsx`

- [ ] **Step 1: Add router.refresh() on device change**

In `src/components/layout/header.tsx`:

1. Add `useRouter` import:

```typescript
import { useRouter } from "next/navigation";
```

2. Inside the `Header` component, add:

```typescript
const router = useRouter();
```

3. Update `handleDeviceChange` to refresh after setting:

```typescript
  async function handleDeviceChange(newId: string) {
    const value = newId === "" ? null : Number(newId);
    setActiveDeviceId(value);
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activeDeviceId: value }),
      });
      router.refresh();
    } catch (err) {
      console.error("Failed to update active device:", err);
    }
  }
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `pnpm exec tsc --noEmit --pretty`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/header.tsx
git commit -m "feat: refresh library on device filter change"
```

---

### Task 11: Device Badges on Game Cards

**Files:**
- Modify: `src/components/game-card.tsx`
- Modify: `src/components/infinite-game-grid.tsx`

- [ ] **Step 1: Add device badges to GameCard**

In `src/components/game-card.tsx`:

1. Add device type to the interface:

```typescript
interface DeviceBadge {
  id: number;
  name: string;
  type: string;
}

interface GameCardProps {
  id: number;
  title: string;
  coverUrl: string | null;
  platformLabel: string;
  platformColor?: string;
  igdbScore: number | null;
  metacriticScore: number | null;
  isFavorite?: boolean;
  devices?: DeviceBadge[];
}
```

2. Add `devices = []` to the destructured props:

```typescript
export function GameCard({ id, title, coverUrl, platformLabel, platformColor, igdbScore, metacriticScore, isFavorite = false, devices = [] }: GameCardProps) {
```

3. Add a helper function for device type colors (before the GameCard export):

```typescript
function deviceTypeColor(type: string): string {
  switch (type) {
    case "steamdeck": return "bg-purple-500/20 text-purple-400";
    case "android": return "bg-green-500/20 text-green-400";
    default: return "bg-blue-500/20 text-blue-400";
  }
}
```

4. Add a helper for device abbreviation:

```typescript
function deviceAbbrev(name: string): string {
  // Use initials for multi-word names, first 2 chars for single-word
  const words = name.split(/\s+/);
  if (words.length >= 2) return words.map((w) => w[0]).join("").toUpperCase().slice(0, 3);
  return name.slice(0, 2).toUpperCase();
}
```

5. Render device badges after the `<PlatformTag>` (inside the `<div className="space-y-2">` block):

```tsx
        {devices.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {devices.map((d) => (
              <span
                key={d.id}
                title={d.name}
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${deviceTypeColor(d.type)}`}
              >
                {deviceAbbrev(d.name)}
              </span>
            ))}
          </div>
        )}
```

- [ ] **Step 2: Update InfiniteGameGrid to pass devices**

In `src/components/infinite-game-grid.tsx`:

1. Add devices to the Game interface:

```typescript
interface Game {
  id: number;
  title: string;
  coverUrl: string | null;
  platformLabel: string;
  igdbScore: number | null;
  metacriticScore: number | null;
  isFavorite?: boolean;
  devices?: { id: number; name: string; type: string }[];
}
```

2. Pass `devices` in the GameCard render:

```tsx
<GameCard
  key={game.id}
  id={game.id}
  title={game.title}
  coverUrl={game.coverUrl}
  platformLabel={game.platformLabel}
  igdbScore={game.igdbScore}
  metacriticScore={game.metacriticScore}
  isFavorite={game.isFavorite}
  devices={game.devices}
/>
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `pnpm exec tsc --noEmit --pretty`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/components/game-card.tsx src/components/infinite-game-grid.tsx
git commit -m "feat: add device badges to game cards"
```

---

### Task 12: Devices Page — Use ScanContext

**Files:**
- Modify: `src/app/devices/page.tsx`

- [ ] **Step 1: Replace local scan state with ScanContext**

In `src/app/devices/page.tsx`:

1. Add import:

```typescript
import { useScan } from "@/context/scan-context";
```

2. Inside `DevicesPage`, add:

```typescript
const { scanning: globalScanning, startScan } = useScan();
```

3. Remove the local `scanning` state (`const [scanning, setScanning] = useState(false);`) and the local `scanResult` state.

4. Replace the `handleScanDevice` function:

```typescript
  async function handleScanDevice() {
    if (!selectedDevice) return;
    await startScan(selectedDevice.id);
  }
```

5. Update the scan button to use `globalScanning`:

```tsx
<button
  onClick={handleScanDevice}
  disabled={globalScanning}
  className="w-full px-6 py-3 rounded-lg font-medium text-sm bg-vault-amber text-black hover:bg-vault-amber-hover transition-all duration-200 disabled:opacity-50"
>
  {globalScanning ? "Scanning..." : "Scan Device"}
</button>
```

6. Remove the local scan result display (`{scanResult && ...}`) — the global ScanBar now handles this.

Also remove the unused `scanResult` and `setScanResult` useState, and remove the `useEffect` that clears scan result on device switch.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `pnpm exec tsc --noEmit --pretty`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/devices/page.tsx
git commit -m "feat: use ScanContext on devices page instead of local scan state"
```

---

### Task 13: Build Verification + Type Check

- [ ] **Step 1: Full type check**

Run: `pnpm exec tsc --noEmit --pretty`
Expected: Zero errors

- [ ] **Step 2: Full build**

Run: `pnpm build`
Expected: Build succeeds with no errors

- [ ] **Step 3: Fix any issues found**

If there are TypeScript or build errors, fix them before proceeding.

- [ ] **Step 4: Final commit if fixes were needed**

```bash
git add -A
git commit -m "fix: resolve build issues from scan progress + device filter feature"
```

---

## Self-Review Notes

**Spec coverage check:**
- GameDevice join model: Task 1
- Scanner creates GameDevice entries: Task 3 (scan-runner.ts)
- Async scan with background execution: Tasks 3-4
- Scan progress polling: Task 4 (status endpoint)
- ScanContext + ScanBar: Tasks 5-7
- Device filter in header: Tasks 9-10
- Games API with deviceId: Task 8
- Device badges on cards: Task 11
- Devices page integration: Task 12

**All spec sections covered.**
