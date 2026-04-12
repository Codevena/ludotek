"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Settings {
  deckHost: string;
  deckUser: string;
  deckPassword: string;
  igdbClientId: string;
  igdbClientSecret: string;
  steamgriddbKey: string;
  openrouterKey: string;
  steamApiKey: string;
}

interface ActionResult {
  success?: boolean;
  error?: string;
  [key: string]: unknown;
}

export default function AdminPage() {
  const [settings, setSettings] = useState<Settings>({
    deckHost: "", deckUser: "", deckPassword: "",
    igdbClientId: "", igdbClientSecret: "", steamgriddbKey: "",
    openrouterKey: "", steamApiKey: "",
  });
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [aiEnriching, setAiEnriching] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then(setSettings);
  }, []);

  async function saveSettings() {
    setSaving(true);
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setResult(await res.json());
    setSaving(false);
  }

  async function runAction(url: string, setter: (v: boolean) => void) {
    setter(true);
    setResult(null);
    try {
      const res = await fetch(url, { method: "POST" });
      setResult(await res.json());
    } catch (err) {
      setResult({ error: String(err) });
    }
    setter(false);
  }

  const inputClass = "w-full bg-vault-bg border border-vault-border rounded-lg px-4 py-2 text-sm text-vault-text focus:outline-none focus:border-vault-amber transition-colors";
  const btnClass = "px-6 py-3 rounded-lg font-medium text-sm transition-all duration-200 disabled:opacity-50";

  return (
    <div className="max-w-3xl mx-auto">
      <Link href="/" className="text-vault-muted hover:text-vault-text text-sm mb-6 inline-block">
        ← Back to library
      </Link>

      <h1 className="font-heading text-2xl font-bold mb-8">Admin</h1>

      {/* Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <button onClick={() => runAction("/api/scan", setScanning)} disabled={scanning}
          className={`${btnClass} bg-vault-amber text-black hover:bg-vault-amber-hover`}>
          {scanning ? "Scanning..." : "Scan Steam Deck"}
        </button>
        <button onClick={() => runAction("/api/enrich", setEnriching)} disabled={enriching}
          className={`${btnClass} bg-blue-600 text-white hover:bg-blue-500`}>
          {enriching ? "Enriching..." : "Enrich All (IGDB)"}
        </button>
        <button onClick={() => runAction("/api/enrich/ai", setAiEnriching)} disabled={aiEnriching}
          className={`${btnClass} bg-purple-600 text-white hover:bg-purple-500`}>
          {aiEnriching ? "Generating..." : "Generate AI Content"}
        </button>
      </div>

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
              <label className="text-vault-muted text-xs mb-1 block">Host</label>
              <input className={inputClass} value={settings.deckHost}
                onChange={(e) => setSettings({ ...settings, deckHost: e.target.value })} placeholder="192.168.178.131" />
            </div>
            <div>
              <label className="text-vault-muted text-xs mb-1 block">User</label>
              <input className={inputClass} value={settings.deckUser}
                onChange={(e) => setSettings({ ...settings, deckUser: e.target.value })} placeholder="deck" />
            </div>
          </div>
          <div>
            <label className="text-vault-muted text-xs mb-1 block">Password</label>
            <input className={inputClass} type="password" value={settings.deckPassword}
              onChange={(e) => setSettings({ ...settings, deckPassword: e.target.value })} />
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-vault-amber text-sm font-semibold uppercase tracking-wide">IGDB API</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-vault-muted text-xs mb-1 block">Client ID</label>
              <input className={inputClass} value={settings.igdbClientId}
                onChange={(e) => setSettings({ ...settings, igdbClientId: e.target.value })} />
            </div>
            <div>
              <label className="text-vault-muted text-xs mb-1 block">Client Secret</label>
              <input className={inputClass} type="password" value={settings.igdbClientSecret}
                onChange={(e) => setSettings({ ...settings, igdbClientSecret: e.target.value })} />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-vault-amber text-sm font-semibold uppercase tracking-wide">Other APIs</h3>
          <div>
            <label className="text-vault-muted text-xs mb-1 block">SteamGridDB API Key</label>
            <input className={inputClass} type="password" value={settings.steamgriddbKey}
              onChange={(e) => setSettings({ ...settings, steamgriddbKey: e.target.value })} />
          </div>
          <div>
            <label className="text-vault-muted text-xs mb-1 block">OpenRouter API Key</label>
            <input className={inputClass} type="password" value={settings.openrouterKey}
              onChange={(e) => setSettings({ ...settings, openrouterKey: e.target.value })} />
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
