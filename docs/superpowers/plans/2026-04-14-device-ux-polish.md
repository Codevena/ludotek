# Device UX Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add scan result numbers, device editing in admin, and a global active device selector in the header.

**Architecture:** Three independent improvements: (1) update scan result display to show game counts from existing API response, (2) add edit button + form to admin device list, (3) add `activeDeviceId` to Settings with header dropdown and admin default device picker.

**Tech Stack:** Next.js 14, React, TypeScript, Prisma 6.x (SQLite), Tailwind CSS

---

## File Structure

| File | Role |
|------|------|
| `src/app/devices/page.tsx` | MODIFY — scan result display with numbers, auto-select active device |
| `src/app/admin/page.tsx` | MODIFY — edit button, edit form, default device dropdown |
| `prisma/schema.prisma` | MODIFY — add `activeDeviceId` to Settings |
| `src/app/api/settings/route.ts` | MODIFY — handle `activeDeviceId` in GET/PUT |
| `src/app/api/devices/[id]/route.ts` | MODIFY — clear `activeDeviceId` on device delete |
| `src/components/layout/header.tsx` | MODIFY — add active device selector dropdown |

---

### Task 1: Scan Result with Numbers

**Files:**
- Modify: `src/app/devices/page.tsx`

- [ ] **Step 1: Update scan handler to display game counts**

In `src/app/devices/page.tsx`, replace the `handleScanDevice` function (around lines 103-119) with:

```typescript
  async function handleScanDevice() {
    if (!selectedDevice) return;
    setScanning(true);
    setScanResult(null);
    try {
      const res = await fetch(`/api/devices/${selectedDevice.id}/scan`, { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        setScanResult({
          message: `Found ${data.total} games (${data.new} new, ${data.updated} updated)`,
          isError: false,
        });
      } else {
        setScanResult({ message: data.error ?? "Scan failed", isError: true });
      }
    } catch (err) {
      setScanResult({ message: String(err), isError: true });
    }
    setScanning(false);
  }
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/devices/page.tsx
git commit -m "feat: show game counts in scan result message"
```

---

### Task 2: Device Editing in Admin

**Files:**
- Modify: `src/app/admin/page.tsx`

- [ ] **Step 1: Add editing state**

In `src/app/admin/page.tsx`, find the existing device state declarations (around line 49):

```typescript
const [devices, setDevices] = useState<Array<{ id: number; name: string; type: string; host: string; protocol: string }>>([]);
const [showDeviceForm, setShowDeviceForm] = useState(false);
```

Replace with:

```typescript
const [devices, setDevices] = useState<Array<{ id: number; name: string; type: string; host: string; port: number; user: string; protocol: string }>>([]);
const [showDeviceForm, setShowDeviceForm] = useState(false);
const [editingDeviceId, setEditingDeviceId] = useState<number | null>(null);
```

- [ ] **Step 2: Replace the Devices section JSX**

Find the Devices section in the JSX (the `<div>` containing `<h3>` "Devices"). Replace the entire section with:

```tsx
        <div className="space-y-4">
          <h3 className="text-vault-amber text-sm font-semibold uppercase tracking-wide">Devices</h3>
          {devices.length > 0 && (
            <div className="space-y-2">
              {devices.map((device) => (
                <div key={device.id}>
                  {editingDeviceId === device.id ? (
                    <div className="border border-vault-border rounded-xl p-4 bg-vault-bg">
                      <DeviceForm
                        initial={{
                          name: device.name,
                          type: device.type,
                          protocol: device.protocol,
                          host: device.host,
                          port: device.port,
                          user: device.user,
                          password: "",
                        }}
                        onSubmit={async (data) => {
                          const body: Record<string, unknown> = { ...data };
                          if (!data.password) delete body.password;
                          await fetch(`/api/devices/${device.id}`, {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(body),
                          });
                          setEditingDeviceId(null);
                          loadDevices();
                        }}
                        onCancel={() => setEditingDeviceId(null)}
                        submitLabel="Save Changes"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-vault-border bg-vault-bg">
                      <div className="text-sm">
                        <span className="text-vault-text font-medium">{device.name}</span>
                        <span className="text-vault-muted ml-2">{device.host} ({device.protocol})</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => {
                            setEditingDeviceId(device.id);
                            setShowDeviceForm(false);
                          }}
                          className="text-vault-amber hover:text-vault-amber-hover text-sm transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={async () => {
                            if (confirm(`Delete device "${device.name}"?`)) {
                              await fetch(`/api/devices/${device.id}`, { method: "DELETE" });
                              loadDevices();
                            }
                          }}
                          className="text-red-400 hover:text-red-300 text-sm transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {showDeviceForm ? (
            <div className="border border-vault-border rounded-xl p-4 bg-vault-bg">
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
              onClick={() => {
                setShowDeviceForm(true);
                setEditingDeviceId(null);
              }}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-vault-border text-vault-muted hover:border-vault-muted transition-colors"
            >
              + Add Device
            </button>
          )}
          <Link
            href="/devices"
            className="block text-sm text-vault-amber hover:text-vault-amber-hover transition-colors"
          >
            Manage scan paths and blacklist on the Devices page &rarr;
          </Link>
        </div>
```

- [ ] **Step 3: Update the devices fetch to include port and user**

Find the `loadDevices` function in admin page. The fetch response currently only destructures `id, name, type, host, protocol`. The `/api/devices` GET endpoint already returns all fields. Update the device type to include `port` and `user` (done in Step 1 state declaration). No API change needed — the response already contains these fields.

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/page.tsx
git commit -m "feat: add device editing in Admin Settings"
```

---

### Task 3: Prisma Schema — Add activeDeviceId to Settings

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add activeDeviceId field**

In `prisma/schema.prisma`, find the Settings model and add `activeDeviceId` at the end, before the closing `}`:

```prisma
  activeDeviceId Int?
```

The full Settings model should now end with:

```prisma
  romSearchUrl     String @default("https://romsfun.com/roms/{platformLabel}/?q={title}")
  activeDeviceId   Int?
}
```

- [ ] **Step 2: Run migration**

Run: `npx prisma migrate dev --name add-active-device-id`
Expected: Migration created and applied.

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add activeDeviceId to Settings schema"
```

---

### Task 4: Settings API — Handle activeDeviceId

**Files:**
- Modify: `src/app/api/settings/route.ts`
- Modify: `src/app/api/devices/[id]/route.ts`

- [ ] **Step 1: Update Settings GET to include activeDeviceId**

The GET handler already returns `...settings` which includes all fields. Since `activeDeviceId` is an Int (not a secret), it's automatically included. No change needed for GET.

- [ ] **Step 2: Update Settings PUT to handle activeDeviceId**

In `src/app/api/settings/route.ts`, the PUT handler currently only processes string fields. Add handling for `activeDeviceId` after the string fields loop (after line 51):

Find this code:

```typescript
  const settings = await prisma.settings.update({
    where: { id: 1 },
    data,
  });
```

Replace with:

```typescript
  // Handle activeDeviceId (integer, not string)
  if (body.activeDeviceId !== undefined) {
    (data as Record<string, unknown>).activeDeviceId = body.activeDeviceId === null ? null : Number(body.activeDeviceId);
  }

  const settings = await prisma.settings.update({
    where: { id: 1 },
    data,
  });
```

- [ ] **Step 3: Clear activeDeviceId on device delete**

In `src/app/api/devices/[id]/route.ts`, find the DELETE handler. Before `await prisma.device.delete(...)`, add:

```typescript
    // Clear activeDeviceId if this device was the active one
    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    if (settings?.activeDeviceId === Number(id)) {
      await prisma.settings.update({
        where: { id: 1 },
        data: { activeDeviceId: null },
      });
    }
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/settings/route.ts 'src/app/api/devices/[id]/route.ts'
git commit -m "feat: handle activeDeviceId in settings API and device delete"
```

---

### Task 5: Header — Active Device Selector

**Files:**
- Modify: `src/components/layout/header.tsx`

- [ ] **Step 1: Replace header with device selector version**

Replace the entire content of `src/components/layout/header.tsx` with:

```tsx
"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { SearchBar } from "@/components/search-bar";

interface DeviceOption {
  id: number;
  name: string;
}

export function Header() {
  const [devices, setDevices] = useState<DeviceOption[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<number | null>(null);

  const loadActiveDevice = useCallback(async () => {
    try {
      const [devicesRes, settingsRes] = await Promise.all([
        fetch("/api/devices"),
        fetch("/api/settings"),
      ]);
      if (devicesRes.ok) {
        const devData = await devicesRes.json();
        setDevices((devData.devices || []).map((d: { id: number; name: string }) => ({ id: d.id, name: d.name })));
      }
      if (settingsRes.ok) {
        const setData = await settingsRes.json();
        setActiveDeviceId(setData.activeDeviceId ?? null);
      }
    } catch (err) {
      console.error("Failed to load devices for header:", err);
    }
  }, []);

  useEffect(() => {
    loadActiveDevice();
  }, [loadActiveDevice]);

  async function handleDeviceChange(newId: string) {
    const value = newId === "" ? null : Number(newId);
    setActiveDeviceId(value);
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activeDeviceId: value }),
      });
    } catch (err) {
      console.error("Failed to update active device:", err);
    }
  }

  return (
    <header className="sticky top-0 z-10 bg-vault-bg/80 backdrop-blur-md border-b border-vault-border px-6 py-4 flex items-center gap-4">
      <SearchBar />
      <Link
        href="/"
        className="px-4 py-2 text-sm font-medium text-vault-muted hover:text-vault-text transition-colors"
      >
        Home
      </Link>
      <Link
        href="/discover"
        className="px-4 py-2 text-sm font-medium text-vault-amber hover:text-vault-amber-hover transition-colors"
      >
        Discover
      </Link>
      <Link
        href="/devices"
        className="px-4 py-2 text-sm font-medium text-vault-muted hover:text-vault-text transition-colors"
      >
        Devices
      </Link>
      <Link
        href="/admin/upload"
        className="px-4 py-2 text-sm text-vault-muted hover:text-vault-text transition-colors"
      >
        Upload
      </Link>
      <Link
        href="/admin"
        className="px-4 py-2 text-sm text-vault-muted hover:text-vault-text transition-colors"
      >
        Admin
      </Link>

      {/* Active Device Selector */}
      {devices.length > 0 && (
        <div className="ml-auto flex items-center gap-2">
          <span className="text-vault-muted text-xs">Device:</span>
          <select
            value={activeDeviceId ?? ""}
            onChange={(e) => handleDeviceChange(e.target.value)}
            className="bg-vault-surface border border-vault-border rounded-lg px-2 py-1.5 text-xs text-vault-text focus:outline-none focus:border-vault-amber/50"
          >
            <option value="">All Devices</option>
            {devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </header>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/header.tsx
git commit -m "feat: add active device selector dropdown to header"
```

---

### Task 6: Admin — Default Device Dropdown

**Files:**
- Modify: `src/app/admin/page.tsx`

- [ ] **Step 1: Add activeDeviceId to Settings interface and state**

In `src/app/admin/page.tsx`, find the `Settings` interface (around line 8). Add:

```typescript
  activeDeviceId: number | null;
```

Update the initial state in `useState<Settings>` to include:

```typescript
  activeDeviceId: null,
```

- [ ] **Step 2: Add Default Device dropdown to the Devices section**

In the Devices section JSX (from Task 2), find the link to `/devices` at the bottom. Insert the following BEFORE that link:

```tsx
          {devices.length > 0 && (
            <div>
              <label className="text-vault-muted text-xs mb-1 block">Default Device</label>
              <select
                value={settings.activeDeviceId ?? ""}
                onChange={(e) => setSettings({ ...settings, activeDeviceId: e.target.value === "" ? null : Number(e.target.value) })}
                className="w-full bg-vault-bg border border-vault-border rounded-lg px-3 py-2 text-sm text-vault-text focus:outline-none focus:border-vault-amber/50"
              >
                <option value="">None</option>
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          )}
```

The `activeDeviceId` will be saved via the existing "Save Settings" button since it's part of the settings state that gets PUT to `/api/settings`.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/page.tsx
git commit -m "feat: add Default Device dropdown to Admin Settings"
```

---

### Task 7: Devices Page — Auto-select Active Device

**Files:**
- Modify: `src/app/devices/page.tsx`

- [ ] **Step 1: Load active device from settings on mount**

In `src/app/devices/page.tsx`, find the `loadDevices` function. Update it to also fetch settings and use `activeDeviceId` for initial selection:

Replace the `loadDevices` function with:

```typescript
  const loadDevices = useCallback(async () => {
    try {
      const [devicesRes, settingsRes] = await Promise.all([
        fetch("/api/devices"),
        fetch("/api/settings"),
      ]);
      if (!devicesRes.ok) throw new Error("Failed to load devices");
      const devData = await devicesRes.json();
      const deviceList: Device[] = devData.devices || [];
      setDevices(deviceList);

      if (!hasAutoSelected.current && deviceList.length > 0) {
        hasAutoSelected.current = true;
        let initialId = deviceList[0].id;
        if (settingsRes.ok) {
          const setData = await settingsRes.json();
          if (setData.activeDeviceId && deviceList.some((d: Device) => d.id === setData.activeDeviceId)) {
            initialId = setData.activeDeviceId;
          }
        }
        setSelectedDeviceId(initialId);
      }
    } catch (err) {
      console.error("Failed to load devices:", err);
    } finally {
      setLoading(false);
    }
  }, []);
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/devices/page.tsx
git commit -m "feat: auto-select active device on Devices page"
```

---

### Task 8: Build Verification

- [ ] **Step 1: Run full build**

Run: `pnpm build`
Expected: Build completes without errors.

- [ ] **Step 2: Commit any fixes**

If any issues found, fix and commit.
