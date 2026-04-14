# Setup-Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a first-run setup wizard at `/setup` that guides new users through device creation, scan path configuration, API key entry, and first scan — so anyone can start using Game Vault without prior knowledge.

**Architecture:** Single client component at `/setup` with 5 wizard steps. Reuses existing `DeviceForm` and `FileBrowser` components. Home page (`/`) checks via API if setup is needed and redirects. No new API endpoints — all existing.

**Tech Stack:** Next.js App Router, React useState, existing Tailwind vault theme, existing API routes.

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/app/setup/page.tsx` | Create | Wizard page — standalone layout, 5-step flow |
| `src/app/setup/layout.tsx` | Create | Minimal layout — no Sidebar/Header/ScanBar |
| `src/components/setup-wizard.tsx` | Create | Client component — wizard state machine, all 5 steps |
| `src/app/page.tsx` | Modify | Add setup-needed check + redirect |
| `src/app/api/setup-status/route.ts` | Create | Lightweight endpoint: returns `{needsSetup: boolean}` |

---

### Task 1: Setup Status API Endpoint

**Files:**
- Create: `src/app/api/setup-status/route.ts`

This endpoint checks if any device has at least 1 scan path. Used by Home page to decide redirect.

- [ ] **Step 1: Create the endpoint**

```typescript
// src/app/api/setup-status/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const devices = await prisma.device.findMany({
    select: { scanPaths: true },
  });

  const hasConfiguredDevice = devices.some((d) => {
    try {
      const paths = JSON.parse(d.scanPaths);
      return Array.isArray(paths) && paths.length > 0;
    } catch {
      return false;
    }
  });

  return NextResponse.json({ needsSetup: !hasConfiguredDevice });
}
```

Note: No `requireAuth` — this is a public status check that returns no sensitive data.

- [ ] **Step 2: Verify it works**

Run: `curl http://localhost:3000/api/setup-status`
Expected: `{"needsSetup":true}` (if no devices) or `{"needsSetup":false}` (if devices with paths exist)

- [ ] **Step 3: Commit**

```bash
git add src/app/api/setup-status/route.ts
git commit -m "feat(setup): add /api/setup-status endpoint"
```

---

### Task 2: Setup Wizard Layout (no Sidebar/Header)

**Files:**
- Create: `src/app/setup/layout.tsx`

The wizard needs a clean, standalone layout — no Sidebar, no Header, no ScanBar. Just the vault background with centered content.

- [ ] **Step 1: Create the layout**

```typescript
// src/app/setup/layout.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Setup — Game Vault",
};

export default function SetupLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      {children}
    </div>
  );
}
```

This layout replaces the root layout's Sidebar+Header wrapper for the `/setup` route. The root layout still applies (fonts, body classes, global styles).

- [ ] **Step 2: Create the page shell**

```typescript
// src/app/setup/page.tsx
import { SetupWizard } from "@/components/setup-wizard";

export default function SetupPage() {
  return <SetupWizard />;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/setup/layout.tsx src/app/setup/page.tsx
git commit -m "feat(setup): add /setup route with standalone layout"
```

---

### Task 3: Wizard Shell — Step Indicator + Navigation

**Files:**
- Create: `src/components/setup-wizard.tsx`

Build the wizard container with step indicator, back/next navigation, and skip link. Steps render placeholder content initially.

- [ ] **Step 1: Create the wizard shell**

```typescript
// src/components/setup-wizard.tsx
"use client";

import { useState } from "react";

interface WizardState {
  step: number;
  deviceId: number | null;
  scanPaths: { path: string; type: "rom" | "steam" }[];
  igdbConfigured: boolean;
}

const STEPS = [
  { label: "Welcome", short: "1" },
  { label: "Device", short: "2" },
  { label: "Paths", short: "3" },
  { label: "API Keys", short: "4" },
  { label: "Scan", short: "5" },
];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {STEPS.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={s.label} className="flex items-center gap-2">
            {i > 0 && (
              <div
                className={`h-px w-6 sm:w-10 ${done ? "bg-vault-amber" : "bg-vault-border"}`}
              />
            )}
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium border-2 transition-colors ${
                  done
                    ? "bg-vault-amber border-vault-amber text-black"
                    : active
                      ? "border-vault-amber text-vault-amber"
                      : "border-vault-border text-vault-muted"
                }`}
              >
                {done ? "✓" : i + 1}
              </div>
              <span
                className={`text-xs hidden sm:block ${active ? "text-vault-text" : "text-vault-muted"}`}
              >
                {s.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function SetupWizard() {
  const [state, setState] = useState<WizardState>({
    step: 0,
    deviceId: null,
    scanPaths: [],
    igdbConfigured: false,
  });

  const setStep = (step: number) => setState((s) => ({ ...s, step }));

  return (
    <div className="w-full max-w-2xl">
      <StepIndicator current={state.step} />
      <div className="bg-vault-dark border border-vault-border rounded-2xl p-6 sm:p-8">
        {state.step === 0 && (
          <StepWelcome onNext={() => setStep(1)} />
        )}
        {state.step === 1 && (
          <div className="text-vault-muted text-sm">Step 2: Device (placeholder)</div>
        )}
        {state.step === 2 && (
          <div className="text-vault-muted text-sm">Step 3: Paths (placeholder)</div>
        )}
        {state.step === 3 && (
          <div className="text-vault-muted text-sm">Step 4: API Keys (placeholder)</div>
        )}
        {state.step === 4 && (
          <div className="text-vault-muted text-sm">Step 5: Scan (placeholder)</div>
        )}
      </div>
      <div className="text-center mt-4">
        <a href="/?skipSetup=1" className="text-xs text-vault-muted hover:text-vault-text transition-colors">
          Skip setup
        </a>
      </div>
    </div>
  );
}

/* ── Step 1: Welcome ── */

function StepWelcome({ onNext }: { onNext: () => void }) {
  return (
    <div className="text-center space-y-6">
      <h1 className="font-heading text-2xl font-bold text-vault-text">
        Welcome to Game Vault
      </h1>
      <p className="text-vault-muted text-sm leading-relaxed max-w-md mx-auto">
        Game Vault scans your devices for ROMs, enriches them with metadata from
        IGDB, and gives you a beautiful library to browse your collection.
      </p>
      <div className="text-left bg-vault-bg rounded-xl border border-vault-border/50 p-4 space-y-2">
        <p className="text-sm font-medium text-vault-text mb-2">
          What you&apos;ll need:
        </p>
        <div className="flex items-start gap-2 text-sm text-vault-muted">
          <span className="text-vault-amber mt-0.5">1.</span>
          <span>A device with ROMs (Steam Deck, Android, or local PC)</span>
        </div>
        <div className="flex items-start gap-2 text-sm text-vault-muted">
          <span className="text-vault-amber mt-0.5">2.</span>
          <span>
            IGDB API credentials (free) —{" "}
            <a
              href="https://dev.twitch.tv/console/apps"
              target="_blank"
              rel="noopener noreferrer"
              className="text-vault-amber hover:underline"
            >
              Get them at dev.twitch.tv
            </a>
          </span>
        </div>
      </div>
      <button
        onClick={onNext}
        className="bg-vault-amber text-black hover:bg-vault-amber-hover px-6 py-2.5 text-sm font-medium rounded-lg transition-colors"
      >
        Get Started →
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Verify the wizard renders**

Run: `pnpm dev`, navigate to `http://localhost:3000/setup`
Expected: Centered card with step indicator, Welcome content, "Get Started" button advances to Step 2 placeholder.

- [ ] **Step 3: Commit**

```bash
git add src/components/setup-wizard.tsx
git commit -m "feat(setup): wizard shell with step indicator and welcome step"
```

---

### Task 4: Step 2 — Add Device

**Files:**
- Modify: `src/components/setup-wizard.tsx`

Integrate the existing `DeviceForm` component. After submission, auto-test connection. Store `deviceId` in wizard state on success.

- [ ] **Step 1: Add the device step**

Add import at top of `setup-wizard.tsx`:

```typescript
import { DeviceForm, type DeviceFormData } from "@/components/device-form";
```

Replace the Step 1 placeholder (`state.step === 1`) with:

```typescript
{state.step === 1 && (
  <StepDevice
    onBack={() => setStep(0)}
    onComplete={(deviceId) => {
      setState((s) => ({ ...s, deviceId, step: 2 }));
    }}
  />
)}
```

Add the `StepDevice` component after `StepWelcome`:

```typescript
/* ── Step 2: Add Device ── */

function StepDevice({
  onBack,
  onComplete,
}: {
  onBack: () => void;
  onComplete: (deviceId: number) => void;
}) {
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(data: DeviceFormData) {
    setError(null);

    // 1. Create device
    const createRes = await fetch("/api/devices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!createRes.ok) {
      const err = await createRes.json().catch(() => null);
      throw new Error(err?.error ?? "Failed to create device");
    }
    const device = await createRes.json();

    // 2. Test connection (skip for local)
    if (data.protocol !== "local") {
      const testRes = await fetch("/api/devices/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          protocol: data.protocol,
          host: data.host,
          port: data.port,
          user: data.user,
          password: data.password,
        }),
      });
      const testData = await testRes.json().catch(() => null);
      if (!testRes.ok || !testData?.ok) {
        setError(
          `Device saved, but connection failed: ${testData?.error ?? "Unknown error"}. Check credentials and try again from the Devices page.`
        );
        // Still advance — device is saved, user can fix later
        onComplete(device.id);
        return;
      }
    }

    // 3. Set as active device
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activeDeviceId: device.id }),
    });

    onComplete(device.id);
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-heading text-lg font-bold text-vault-text">
          Add Your Device
        </h2>
        <p className="text-sm text-vault-muted mt-1">
          Connect to the device where your ROMs are stored.
        </p>
      </div>
      {error && (
        <div className="text-sm text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 rounded-lg px-4 py-3">
          {error}
        </div>
      )}
      <DeviceForm
        onSubmit={handleSubmit}
        onCancel={onBack}
        submitLabel="Save & Continue →"
      />
    </div>
  );
}
```

Note: `DeviceForm` already has a "Test Connection" button built in that the user can use before submitting. The wizard also auto-tests after creation to confirm. The `onCancel` prop maps to the Back button in `DeviceForm`.

- [ ] **Step 2: Verify the device step**

Run: `pnpm dev`, navigate to `/setup`, click "Get Started", fill in device form.
Expected: Device form renders with type/protocol/host/credentials. Submit creates device and advances to Step 3.

- [ ] **Step 3: Commit**

```bash
git add src/components/setup-wizard.tsx
git commit -m "feat(setup): add device step with connection test"
```

---

### Task 5: Step 3 — Scan Paths

**Files:**
- Modify: `src/components/setup-wizard.tsx`

Integrate the existing `FileBrowser` component. Show added paths on the right. Persist to device via PUT.

- [ ] **Step 1: Add the scan paths step**

Add import at top of `setup-wizard.tsx`:

```typescript
import { FileBrowser } from "@/components/file-browser";
```

Replace the Step 2 placeholder (`state.step === 2`) with:

```typescript
{state.step === 2 && state.deviceId && (
  <StepPaths
    deviceId={state.deviceId}
    scanPaths={state.scanPaths}
    onUpdatePaths={(paths) => setState((s) => ({ ...s, scanPaths: paths }))}
    onBack={() => setStep(1)}
    onNext={() => setStep(3)}
  />
)}
```

Add the `StepPaths` component:

```typescript
/* ── Step 3: Scan Paths ── */

function StepPaths({
  deviceId,
  scanPaths,
  onUpdatePaths,
  onBack,
  onNext,
}: {
  deviceId: number;
  scanPaths: { path: string; type: "rom" | "steam" }[];
  onUpdatePaths: (paths: { path: string; type: "rom" | "steam" }[]) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  async function handleAddPath(path: string, type: "rom" | "steam") {
    const updated = [...scanPaths, { path, type }];
    onUpdatePaths(updated);

    // Persist to device
    await fetch(`/api/devices/${deviceId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scanPaths: JSON.stringify(updated) }),
    });
  }

  function handleRemovePath(index: number) {
    const updated = scanPaths.filter((_, i) => i !== index);
    onUpdatePaths(updated);

    fetch(`/api/devices/${deviceId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scanPaths: JSON.stringify(updated) }),
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-heading text-lg font-bold text-vault-text">
          Select ROM Folders
        </h2>
        <p className="text-sm text-vault-muted mt-1">
          Browse your device and add the folders where your ROMs are stored.
        </p>
      </div>

      <FileBrowser
        deviceId={deviceId}
        onAddPath={handleAddPath}
        existingPaths={scanPaths.map((p) => p.path)}
      />

      {/* Added paths */}
      {scanPaths.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-vault-text">Added paths:</p>
          {scanPaths.map((p, i) => (
            <div
              key={p.path}
              className="flex items-center justify-between bg-vault-bg rounded-lg border border-vault-border/50 px-3 py-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                    p.type === "rom"
                      ? "bg-purple-600/20 text-purple-400"
                      : "bg-vault-amber/20 text-vault-amber"
                  }`}
                >
                  {p.type.toUpperCase()}
                </span>
                <span className="text-sm text-vault-text truncate">{p.path}</span>
              </div>
              <button
                type="button"
                onClick={() => handleRemovePath(i)}
                className="text-vault-muted hover:text-red-400 text-sm ml-2 transition-colors"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 text-sm rounded-lg border border-vault-border text-vault-muted hover:border-vault-muted transition-colors"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={scanPaths.length === 0}
          className="bg-vault-amber text-black hover:bg-vault-amber-hover px-6 py-2.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify scan paths step**

Run: `pnpm dev`, navigate through wizard to Step 3.
Expected: File browser renders, user can browse and add ROM/Steam paths. Added paths shown below browser with remove button. Next disabled until >= 1 path added.

- [ ] **Step 3: Commit**

```bash
git add src/components/setup-wizard.tsx
git commit -m "feat(setup): add scan paths step with file browser"
```

---

### Task 6: Step 4 — API Keys

**Files:**
- Modify: `src/components/setup-wizard.tsx`

Simple form for IGDB Client ID and Secret. Saves via `PUT /api/settings`. Skippable with warning.

- [ ] **Step 1: Add the API keys step**

Replace the Step 3 placeholder (`state.step === 3`) with:

```typescript
{state.step === 3 && (
  <StepApiKeys
    onBack={() => setStep(2)}
    onNext={(configured) => {
      setState((s) => ({ ...s, igdbConfigured: configured, step: 4 }));
    }}
  />
)}
```

Add the `StepApiKeys` component:

```typescript
/* ── Step 4: API Keys ── */

function StepApiKeys({
  onBack,
  onNext,
}: {
  onBack: () => void;
  onNext: (configured: boolean) => void;
}) {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          igdbClientId: clientId,
          igdbClientSecret: clientSecret,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to save settings");
      }
      onNext(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-lg font-bold text-vault-text">
          IGDB API Keys
        </h2>
        <p className="text-sm text-vault-muted mt-1">
          Game Vault uses IGDB to fetch covers, ratings, release dates, and
          metadata for your games. Keys are free.
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-sm text-vault-muted mb-1">Client ID</label>
          <input
            type="text"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="Your IGDB Client ID"
            className="w-full bg-vault-bg border border-vault-border rounded-lg px-3 py-2 text-sm text-vault-text placeholder-vault-muted focus:outline-none focus:border-vault-amber/50"
          />
        </div>
        <div>
          <label className="block text-sm text-vault-muted mb-1">Client Secret</label>
          <input
            type="password"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            placeholder="Your IGDB Client Secret"
            className="w-full bg-vault-bg border border-vault-border rounded-lg px-3 py-2 text-sm text-vault-text placeholder-vault-muted focus:outline-none focus:border-vault-amber/50"
          />
        </div>
        <p className="text-xs text-vault-muted">
          <a
            href="https://dev.twitch.tv/console/apps"
            target="_blank"
            rel="noopener noreferrer"
            className="text-vault-amber hover:underline"
          >
            Get free API keys at dev.twitch.tv →
          </a>
        </p>
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 text-sm rounded-lg border border-vault-border text-vault-muted hover:border-vault-muted transition-colors"
        >
          ← Back
        </button>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onNext(false)}
            className="px-4 py-2 text-sm text-vault-muted hover:text-vault-text transition-colors"
          >
            Skip for now
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !clientId.trim() || !clientSecret.trim()}
            className="bg-vault-amber text-black hover:bg-vault-amber-hover px-6 py-2.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : "Save & Continue →"}
          </button>
        </div>
      </div>

      {/* Skip warning */}
      <div className="text-xs text-vault-muted bg-vault-bg rounded-lg border border-vault-border/50 px-4 py-3">
        Without IGDB keys, your library will show filenames only — no covers,
        ratings, or metadata. You can add keys later in Admin settings.
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify API keys step**

Run: `pnpm dev`, navigate through wizard to Step 4.
Expected: IGDB form renders, skip button advances without saving, save button persists keys and advances. Both paths reach Step 5.

- [ ] **Step 3: Commit**

```bash
git add src/components/setup-wizard.tsx
git commit -m "feat(setup): add API keys step with skip option"
```

---

### Task 7: Step 5 — Summary & Start Scan

**Files:**
- Modify: `src/components/setup-wizard.tsx`

Show configuration summary. "Scan My Library" button triggers scan and redirects to Home.

- [ ] **Step 1: Add the scan step**

Add import at top:

```typescript
import { useRouter } from "next/navigation";
```

In the `SetupWizard` component, add the router:

```typescript
const router = useRouter();
```

Replace the Step 4 placeholder (`state.step === 4`) with:

```typescript
{state.step === 4 && state.deviceId && (
  <StepScan
    deviceId={state.deviceId}
    scanPaths={state.scanPaths}
    igdbConfigured={state.igdbConfigured}
    onBack={() => setStep(3)}
    onComplete={() => router.push("/")}
  />
)}
```

Add the `StepScan` component:

```typescript
/* ── Step 5: Summary & Scan ── */

function StepScan({
  deviceId,
  scanPaths,
  igdbConfigured,
  onBack,
  onComplete,
}: {
  deviceId: number;
  scanPaths: { path: string; type: "rom" | "steam" }[];
  igdbConfigured: boolean;
  onBack: () => void;
  onComplete: () => void;
}) {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleScan() {
    setScanning(true);
    setError(null);
    try {
      const res = await fetch(`/api/devices/${deviceId}/scan`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to start scan");
      }
      // Scan started in background — redirect to home where ScanBar shows progress
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start scan");
      setScanning(false);
    }
  }

  return (
    <div className="space-y-6 text-center">
      <div>
        <h2 className="font-heading text-2xl font-bold text-vault-text">
          You&apos;re All Set!
        </h2>
        <p className="text-sm text-vault-muted mt-2">
          Here&apos;s what we configured:
        </p>
      </div>

      <div className="text-left bg-vault-bg rounded-xl border border-vault-border/50 p-4 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-vault-muted">Scan paths</span>
          <span className="text-vault-text">{scanPaths.length} folder{scanPaths.length !== 1 ? "s" : ""}</span>
        </div>
        {scanPaths.map((p) => (
          <div key={p.path} className="flex items-center gap-2 text-xs text-vault-muted pl-2">
            <span
              className={`px-1.5 py-0.5 rounded font-medium ${
                p.type === "rom"
                  ? "bg-purple-600/20 text-purple-400"
                  : "bg-vault-amber/20 text-vault-amber"
              }`}
            >
              {p.type.toUpperCase()}
            </span>
            <span className="truncate">{p.path}</span>
          </div>
        ))}
        <div className="flex items-center justify-between text-sm pt-1 border-t border-vault-border/50">
          <span className="text-vault-muted">IGDB metadata</span>
          <span className={igdbConfigured ? "text-green-400" : "text-yellow-400"}>
            {igdbConfigured ? "Configured" : "Skipped"}
          </span>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 text-sm rounded-lg border border-vault-border text-vault-muted hover:border-vault-muted transition-colors"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={handleScan}
          disabled={scanning}
          className="bg-vault-amber text-black hover:bg-vault-amber-hover px-6 py-2.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          {scanning ? "Starting scan..." : "Scan My Library →"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the scan step**

Run: `pnpm dev`, navigate through entire wizard.
Expected: Summary shows configured paths and IGDB status. "Scan My Library" starts scan and redirects to home.

- [ ] **Step 3: Commit**

```bash
git add src/components/setup-wizard.tsx
git commit -m "feat(setup): add summary and scan step"
```

---

### Task 8: Home Page Redirect

**Files:**
- Modify: `src/app/page.tsx`

Add a client-side check that redirects to `/setup` when no device with scan paths exists. Respect `?skipSetup=1` query param.

- [ ] **Step 1: Add redirect component to Home page**

Create a client component for the redirect check. Add it at the top of the Home page.

Add a new file `src/components/setup-redirect.tsx`:

```typescript
// src/components/setup-redirect.tsx
"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function SetupRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("skipSetup") === "1") return;

    fetch("/api/setup-status")
      .then((res) => res.json())
      .then((data) => {
        if (data.needsSetup) {
          router.replace("/setup");
        }
      })
      .catch(() => {
        // Silently fail — don't block home page if status check fails
      });
  }, [router, searchParams]);

  return null;
}
```

- [ ] **Step 2: Add SetupRedirect to Home page**

In `src/app/page.tsx`, add the import at the top:

```typescript
import { SetupRedirect } from "@/components/setup-redirect";
```

Add the component inside the return, before `<StatsDashboard />`:

```typescript
<Suspense>
  <SetupRedirect />
</Suspense>
```

The `Suspense` wrapper is needed because `useSearchParams()` requires it in Next.js App Router.

- [ ] **Step 3: Verify redirect**

1. Delete all devices from admin (or use a fresh DB)
2. Navigate to `http://localhost:3000/`
3. Expected: Redirected to `/setup`
4. Navigate to `http://localhost:3000/?skipSetup=1`
5. Expected: Stays on home page

- [ ] **Step 4: Commit**

```bash
git add src/components/setup-redirect.tsx src/app/page.tsx
git commit -m "feat(setup): add home page redirect to wizard when setup needed"
```

---

### Task 9: Build Check & Polish

**Files:**
- All created/modified files

Final check — make sure everything compiles, no TypeScript errors, and the full flow works.

- [ ] **Step 1: Run build**

```bash
pnpm build
```

Expected: Build succeeds with no errors. Fix any TypeScript issues if they appear.

- [ ] **Step 2: End-to-end manual test**

With a fresh DB (or after deleting all devices):
1. Open `http://localhost:3000/` → should redirect to `/setup`
2. Welcome step → "Get Started"
3. Device step → fill in local PC or test device → "Save & Continue"
4. Paths step → browse and add a ROM path → "Next"
5. API keys → skip or enter keys → advance
6. Scan step → "Scan My Library" → redirect to home, ScanBar shows progress
7. Reload home → should NOT redirect to `/setup` anymore (device with paths exists)

- [ ] **Step 3: Commit any polish fixes**

```bash
git add -u
git commit -m "fix(setup): polish and build fixes"
```

(Skip this commit if no fixes were needed.)

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Setup status API | `src/app/api/setup-status/route.ts` |
| 2 | Setup layout (no sidebar) | `src/app/setup/layout.tsx`, `src/app/setup/page.tsx` |
| 3 | Wizard shell + Welcome step | `src/components/setup-wizard.tsx` |
| 4 | Device step | `src/components/setup-wizard.tsx` |
| 5 | Scan paths step | `src/components/setup-wizard.tsx` |
| 6 | API keys step | `src/components/setup-wizard.tsx` |
| 7 | Summary & scan step | `src/components/setup-wizard.tsx` |
| 8 | Home page redirect | `src/components/setup-redirect.tsx`, `src/app/page.tsx` |
| 9 | Build check & polish | All files |
