"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { DeviceForm } from "@/components/device-form";
import { useEnrichment } from "@/context/enrichment-context";

interface Settings {
  deckHost: string;
  deckUser: string;
  deckPassword: string;
  igdbClientId: string;
  igdbClientSecret: string;
  steamgriddbKey: string;
  openrouterKey: string;
  steamApiKey: string;
  aiLanguage: string;
  romSearchUrl: string;
}

interface ActionResult {
  success?: boolean;
  error?: string;
  [key: string]: unknown;
}

export default function AdminPage() {
  const { startEnrichment, isRunning: enrichmentRunning } = useEnrichment();
  const [settings, setSettings] = useState<Settings>({
    deckHost: "", deckUser: "", deckPassword: "",
    igdbClientId: "", igdbClientSecret: "", steamgriddbKey: "",
    openrouterKey: "", steamApiKey: "", aiLanguage: "en", romSearchUrl: "",
  });
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [aiEnriching, setAiEnriching] = useState(false);
  const [metacriticEnriching, setMetacriticEnriching] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [reEnriching, setReEnriching] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [platforms, setPlatforms] = useState<Array<{ id: string; label: string; gameCount: number }>>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [showPlatformPicker, setShowPlatformPicker] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [authRequired, setAuthRequired] = useState<boolean | null>(null);
  const [tokenInput, setTokenInput] = useState("");
  const [devices, setDevices] = useState<Array<{ id: number; name: string; type: string; host: string; port: number; user: string; protocol: string }>>([]);
  const [showDeviceForm, setShowDeviceForm] = useState(false);
  const [editingDeviceId, setEditingDeviceId] = useState<number | null>(null);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    // Check if auth is required
    fetch("/api/auth", { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => {
        setAuthRequired(data.authRequired);
        if (!data.authRequired) {
          setAuthenticated(true);
          loadSettings();
          loadDevices();
          loadPlatforms();
        } else {
          // Try loading settings (cookie might already be set)
          fetch("/api/settings", { signal: controller.signal })
            .then((r) => {
              if (r.ok) {
                setAuthenticated(true);
                loadDevices();
                loadPlatforms();
                return r.json().then(setSettings);
              }
            })
            .catch(() => {});
        }
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        console.error("Failed to check auth:", err);
        setAuthRequired(true);
        setAuthError("Unable to connect to server");
      });
    return () => controller.abort();
  }, []);

  function loadSettings() {
    fetch("/api/settings")
      .then((r) => {
        if (!r.ok) throw new Error("Unauthorized");
        return r.json();
      })
      .then(setSettings)
      .catch((err) => console.error("Failed to load settings:", err));
  }

  function loadDevices() {
    fetch("/api/devices")
      .then((r) => r.json())
      .then((data: Array<{ id: number; name: string; type: string; host: string; port: number; user: string; protocol: string }>) => setDevices(data))
      .catch((err) => console.error("Failed to load devices:", err));
  }

  function loadPlatforms() {
    fetch("/api/platforms")
      .then((r) => r.json())
      .then((data: Array<{ id: string; label: string; gameCount: number }>) => setPlatforms(data))
      .catch((err) => console.error("Failed to load platforms:", err));
  }

  async function handleLogin() {
    setAuthError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenInput }),
      });
      if (res.ok) {
        setAuthenticated(true);
        loadSettings();
        loadDevices();
        loadPlatforms();
      } else {
        setAuthError("Invalid token");
      }
    } catch {
      setAuthError("Connection failed");
    }
  }

  async function saveSettings() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      setResult(await res.json());
    } catch (err) {
      setResult({ error: String(err) });
    }
    setSaving(false);
  }

  async function runScan() {
    setScanning(true);
    setResult(null);
    try {
      const res = await fetch("/api/scan", { method: "POST" });
      setResult(await res.json());
    } catch (err) {
      setResult({ error: String(err) });
    }
    setScanning(false);
  }

  async function runCleanup() {
    setCleaning(true);
    setResult(null);
    try {
      const res = await fetch("/api/cleanup", { method: "POST" });
      setResult(await res.json());
    } catch (err) {
      setResult({ error: String(err) });
    }
    setCleaning(false);
  }

  async function runStreamingAction(
    url: string,
    setter: (v: boolean) => void,
    body?: Record<string, unknown>
  ) {
    setResult(null);
    try {
      const res = await startEnrichment(url, setter, body);
      if (res) {
        setResult(res as ActionResult);
      }
    } catch (err) {
      setter(false);
      setResult({ error: String(err) });
    }
  }

  const inputClass = "w-full bg-vault-bg border border-vault-border rounded-lg px-4 py-2 text-sm text-vault-text focus:outline-none focus:border-vault-amber transition-colors";
  const btnClass = "px-6 py-3 rounded-lg font-medium text-sm transition-all duration-200 disabled:opacity-50";

  // Loading state
  if (authRequired === null) {
    return (
      <div className="max-w-3xl mx-auto flex items-center justify-center py-20">
        <div className="w-6 h-6 rounded-full bg-vault-amber animate-pulse" />
      </div>
    );
  }

  // Login gate
  if (authRequired && !authenticated) {
    return (
      <div className="max-w-sm mx-auto py-20">
        <h1 className="font-heading text-2xl font-bold mb-6 text-center">Admin Login</h1>
        <div className="card space-y-4">
          <div>
            <label htmlFor="admin-token" className="text-vault-muted text-xs mb-1 block">Admin Token</label>
            <input
              id="admin-token"
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              placeholder="Enter admin token..."
              className="w-full bg-vault-bg border border-vault-border rounded-lg px-4 py-2 text-sm text-vault-text focus:outline-none focus:border-vault-amber transition-colors"
            />
          </div>
          {authError && <p className="text-red-400 text-sm">{authError}</p>}
          <button
            onClick={handleLogin}
            className="w-full px-6 py-3 rounded-lg font-medium text-sm bg-vault-amber text-black hover:bg-vault-amber-hover transition-all"
          >
            Login
          </button>
        </div>
        <Link href="/" className="text-vault-muted hover:text-vault-text text-sm mt-4 block text-center">
          ← Back to library
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <Breadcrumbs items={[
        { label: "Home", href: "/" },
        { label: "Admin" },
      ]} />

      <h1 className="font-heading text-2xl font-bold mb-8">Admin</h1>

      {/* Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <button onClick={runScan} disabled={scanning || enrichmentRunning}
          className={`${btnClass} bg-vault-amber text-black hover:bg-vault-amber-hover`}>
          {scanning ? "Scanning..." : "Scan Steam Deck"}
        </button>
        <button onClick={() => {
            const body = selectedPlatforms.length > 0 ? { platforms: selectedPlatforms } : undefined;
            runStreamingAction("/api/enrich", setEnriching, body);
          }}
          disabled={scanning || enrichmentRunning}
          className={`${btnClass} bg-blue-600 text-white hover:bg-blue-500`}>
          {enriching ? "Enriching..." : selectedPlatforms.length > 0 ? `Enrich (${selectedPlatforms.length} Systems)` : "Enrich All (IGDB)"}
        </button>
        <button onClick={() => runStreamingAction("/api/enrich/ai", setAiEnriching)}
          disabled={scanning || enrichmentRunning}
          className={`${btnClass} bg-purple-600 text-white hover:bg-purple-500`}>
          {aiEnriching ? "Generating..." : "Generate AI Content"}
        </button>
      </div>

      <Link
        href="/admin/upload"
        className={`${btnClass} bg-emerald-600 text-white hover:bg-emerald-500 block text-center mb-4`}
      >
        Upload ROMs
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <button onClick={() => runStreamingAction("/api/enrich/metacritic", setMetacriticEnriching)}
          disabled={scanning || enrichmentRunning || cleaning}
          className={`${btnClass} bg-cyan-600 text-white hover:bg-cyan-500`}>
          {metacriticEnriching ? "Fetching..." : "Fetch Critic Scores"}
        </button>
        <button onClick={() => runStreamingAction("/api/enrich/refresh", setReEnriching)}
          disabled={scanning || enrichmentRunning || cleaning}
          className={`${btnClass} bg-orange-600 text-white hover:bg-orange-500`}>
          {reEnriching ? "Re-Enriching..." : "Re-Enrich Missing Fields"}
        </button>
        <button onClick={runCleanup} disabled={scanning || enrichmentRunning || cleaning}
          className={`${btnClass} bg-red-600/80 text-white hover:bg-red-500`}>
          {cleaning ? "Cleaning..." : "Cleanup Duplicates & .m3u"}
        </button>
      </div>

      {/* Platform Filter */}
      <div className="mb-8">
        <button
          onClick={() => setShowPlatformPicker(!showPlatformPicker)}
          className="text-sm text-vault-muted hover:text-vault-text transition-colors"
        >
          Filter by platform {showPlatformPicker ? "▲" : "▼"}
          {selectedPlatforms.length > 0 && (
            <span className="ml-2 text-vault-amber">({selectedPlatforms.length} selected)</span>
          )}
        </button>
        {showPlatformPicker && (
          <div className="card mt-3 space-y-4">
            <div className="flex gap-3">
              <button
                onClick={() => setSelectedPlatforms(platforms.map((p) => p.id))}
                className="text-xs text-vault-amber hover:text-vault-amber-hover transition-colors"
              >
                Select all
              </button>
              <button
                onClick={() => setSelectedPlatforms([])}
                className="text-xs text-vault-muted hover:text-vault-text transition-colors"
              >
                Clear
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {platforms.map((p) => {
                const selected = selectedPlatforms.includes(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() =>
                      setSelectedPlatforms((prev) =>
                        selected ? prev.filter((id) => id !== p.id) : [...prev, p.id]
                      )
                    }
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                      selected
                        ? "border-vault-amber bg-vault-amber/10 text-vault-amber"
                        : "border-vault-border text-vault-muted hover:border-vault-muted"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/platforms/${p.id}.png`}
                      alt={p.label}
                      className="w-5 h-5 object-contain"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                    <span className="truncate">{p.label}</span>
                    <span className="ml-auto opacity-60">{p.gameCount}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Scanning indicator (non-streaming) */}
      {scanning && !result && (
        <div className="card mb-8 border-vault-amber/50">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-full bg-vault-amber animate-pulse" />
            <span className="text-sm text-vault-muted">Scanning Steam Deck via SSH...</span>
          </div>
        </div>
      )}

      {/* Result display */}
      {result && (
        <div className={`card mb-8 ${result.error ? "border-red-500/50" : "border-green-500/50"}`}>
          <pre className="text-sm overflow-auto">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}

      {/* Settings */}
      <div className="card space-y-6">
        <h2 className="font-heading text-lg font-bold">Settings</h2>

        <div className="space-y-4">
          <h3 className="text-vault-amber text-sm font-semibold uppercase tracking-wide">Steam Deck SSH</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="deck-host" className="text-vault-muted text-xs mb-1 block">Host</label>
              <input id="deck-host" className={inputClass} value={settings.deckHost}
                onChange={(e) => setSettings({ ...settings, deckHost: e.target.value })} placeholder="192.168.178.131" />
            </div>
            <div>
              <label htmlFor="deck-user" className="text-vault-muted text-xs mb-1 block">User</label>
              <input id="deck-user" className={inputClass} value={settings.deckUser}
                onChange={(e) => setSettings({ ...settings, deckUser: e.target.value })} placeholder="deck" />
            </div>
          </div>
          <div>
            <label htmlFor="deck-password" className="text-vault-muted text-xs mb-1 block">Password</label>
            <input id="deck-password" className={inputClass} type="password" value={settings.deckPassword}
              onChange={(e) => setSettings({ ...settings, deckPassword: e.target.value })} />
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-vault-amber text-sm font-semibold uppercase tracking-wide">IGDB API</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="igdb-client-id" className="text-vault-muted text-xs mb-1 block">Client ID</label>
              <input id="igdb-client-id" className={inputClass} value={settings.igdbClientId}
                onChange={(e) => setSettings({ ...settings, igdbClientId: e.target.value })} />
            </div>
            <div>
              <label htmlFor="igdb-client-secret" className="text-vault-muted text-xs mb-1 block">Client Secret</label>
              <input id="igdb-client-secret" className={inputClass} type="password" value={settings.igdbClientSecret}
                onChange={(e) => setSettings({ ...settings, igdbClientSecret: e.target.value })} />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-vault-amber text-sm font-semibold uppercase tracking-wide">Other APIs</h3>
          <div>
            <label htmlFor="steamgriddb-key" className="text-vault-muted text-xs mb-1 block">SteamGridDB API Key</label>
            <input id="steamgriddb-key" className={inputClass} type="password" value={settings.steamgriddbKey}
              onChange={(e) => setSettings({ ...settings, steamgriddbKey: e.target.value })} />
          </div>
          <div>
            <label htmlFor="openrouter-key" className="text-vault-muted text-xs mb-1 block">OpenRouter API Key</label>
            <input id="openrouter-key" className={inputClass} type="password" value={settings.openrouterKey}
              onChange={(e) => setSettings({ ...settings, openrouterKey: e.target.value })} />
          </div>
          <div>
            <label htmlFor="steam-api-key" className="text-vault-muted text-xs mb-1 block">Steam Web API Key</label>
            <input id="steam-api-key" className={inputClass} type="password" value={settings.steamApiKey}
              onChange={(e) => setSettings({ ...settings, steamApiKey: e.target.value })} />
          </div>
          <div>
            <label className="text-vault-muted text-xs mb-2 block">AI Content Language</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSettings({ ...settings, aiLanguage: "en" })}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
                  settings.aiLanguage === "en"
                    ? "border-vault-amber bg-vault-amber/10 text-vault-amber"
                    : "border-vault-border text-vault-muted hover:border-vault-muted"
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => setSettings({ ...settings, aiLanguage: "de" })}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
                  settings.aiLanguage === "de"
                    ? "border-vault-amber bg-vault-amber/10 text-vault-amber"
                    : "border-vault-border text-vault-muted hover:border-vault-muted"
                }`}
              >
                Deutsch
              </button>
            </div>
          </div>
        </div>

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

        <div className="space-y-4">
          <h3 className="text-vault-amber text-sm font-semibold uppercase tracking-wide">ROM Search</h3>
          <div>
            <label htmlFor="rom-search-url" className="text-vault-muted text-xs mb-1 block">ROM Search URL Template</label>
            <input id="rom-search-url" className={inputClass} value={settings.romSearchUrl}
              onChange={(e) => setSettings({ ...settings, romSearchUrl: e.target.value })}
              placeholder="https://example.com/roms/{platform}/?q={title}" />
            <p className="text-vault-muted text-[10px] mt-1">
              Variables: {"{title}"}, {"{titleSlug}"}, {"{platform}"}, {"{platformLabel}"} — leave empty to hide search button
            </p>
          </div>
        </div>

        <button onClick={saveSettings} disabled={saving}
          className={`${btnClass} bg-vault-amber text-black hover:bg-vault-amber-hover w-full`}>
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
