"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DeviceForm, type DeviceFormData } from "@/components/device-form";
import { FileBrowser } from "@/components/file-browser";

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
  const router = useRouter();
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
          <StepDevice
            onBack={() => setStep(0)}
            onComplete={(deviceId) => {
              setState((s) => ({ ...s, deviceId, step: 2 }));
            }}
          />
        )}
        {state.step === 2 && state.deviceId && (
          <StepPaths
            deviceId={state.deviceId}
            scanPaths={state.scanPaths}
            onUpdatePaths={(paths) => setState((s) => ({ ...s, scanPaths: paths }))}
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
          />
        )}
        {state.step === 3 && (
          <StepApiKeys
            onBack={() => setStep(2)}
            onNext={(configured) => {
              setState((s) => ({ ...s, igdbConfigured: configured, step: 4 }));
            }}
          />
        )}
        {state.step === 4 && state.deviceId && (
          <StepScan
            deviceId={state.deviceId}
            scanPaths={state.scanPaths}
            igdbConfigured={state.igdbConfigured}
            onBack={() => setStep(3)}
            onComplete={() => router.push("/")}
          />
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

function StepWelcome({ onNext }: { onNext: () => void }) {
  return (
    <div className="text-center space-y-6">
      <h1 className="font-heading text-2xl font-bold text-vault-text">
        Welcome to Ludotek
      </h1>
      <p className="text-vault-muted text-sm leading-relaxed max-w-md mx-auto">
        Ludotek scans your devices for ROMs, enriches them with metadata from
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
        onComplete(device.id);
        return;
      }
    }

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

      <div className="text-xs text-vault-muted bg-vault-bg rounded-lg border border-vault-border/50 px-4 py-3">
        Without IGDB keys, your library will show filenames only — no covers,
        ratings, or metadata. You can add keys later in Admin settings.
      </div>
    </div>
  );
}

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
