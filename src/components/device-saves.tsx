"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FilePlanPanel } from "@/components/file-plan-panel";
import type { FilePlanView } from "@/lib/file-plans";
import type { SaveFile, SaveVersionView } from "@/lib/device-saves";
import type { SaveSyncView } from "@/lib/save-sync";
import type { SyncDirection, SyncResolution } from "@/lib/device-profile-sync";

export function DeviceSaves({ deviceId }: { deviceId: number }) {
  const [devices, setDevices] = useState<{ id: number; name: string }[]>([]);
  const [games, setGames] = useState<{ id: number; title: string; platformLabel: string }[]>([]);
  const [roots, setRoots] = useState<string[]>([]);
  const [files, setFiles] = useState<SaveFile[]>([]);
  const [filePath, setFilePath] = useState("");
  const [gameId, setGameId] = useState("");
  const [gameSearch, setGameSearch] = useState("");
  const [versions, setVersions] = useState<SaveVersionView[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [allHistory, setAllHistory] = useState(false);
  const [versionId, setVersionId] = useState("");
  const [targetPath, setTargetPath] = useState("");
  const [restorePlan, setRestorePlan] = useState<FilePlanView | null>(null);
  const [master, setMaster] = useState("");
  const [direction, setDirection] = useState<SyncDirection>("two-way");
  const [syncPlan, setSyncPlan] = useState<SaveSyncView | null>(null);
  const [resolutions, setResolutions] = useState<Record<string, SyncResolution>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ bytes: number; total: number } | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const active = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const invalidate = useCallback(() => { generation.current++; active.current?.abort(); }, []);
  const inputClass = "w-full bg-vault-bg border border-vault-border rounded-lg px-3 py-2 text-sm";
  const readJson = async (response: Response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error || "Save-Auftrag fehlgeschlagen."); return data; };
  const historyUrl = (all: boolean, offset = 0) => `/api/saves/versions?${all ? "" : `deviceId=${deviceId}&`}offset=${offset}&take=20`;

  useEffect(() => {
    const token = ++generation.current; const controller = new AbortController(); active.current = controller;
    setLoading(true); setFiles([]); setFilePath(""); setGameId(""); setGameSearch(""); setVersions([]); setVersionId(""); setNextOffset(null); setTargetPath(""); setRestorePlan(null); setSyncPlan(null); setMaster(""); setDirection("two-way"); setResolutions({}); setAllHistory(false); setBusy(false); setError(""); setMessage(""); setProgress(null);
    void (async () => {
      try {
        const [profile, deviceList, gameList, history] = await Promise.all([
          fetch(`/api/devices/${deviceId}/profile`, { signal: controller.signal }).then(readJson), fetch("/api/devices", { signal: controller.signal }).then(readJson),
          fetch("/api/games?limit=100", { signal: controller.signal }).then(readJson), fetch(`/api/saves/versions?deviceId=${deviceId}&offset=0&take=20`, { signal: controller.signal }).then(readJson),
        ]);
        if (generation.current !== token) return;
        setRoots((profile.profile.saveRoots ?? []).map((root: { path: string }) => root.path)); setDevices((deviceList.devices ?? []).filter((device: { id: number }) => device.id !== deviceId)); setGames(gameList.games ?? []); setVersions(history.versions ?? []); setNextOffset(history.nextOffset ?? null);
      } catch (failure) { if (generation.current === token && !controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Save-Konfiguration konnte nicht geladen werden."); }
      finally { if (generation.current === token) { setLoading(false); active.current = null; } }
    })();
    return invalidate;
    // All requests depend on the selected device; helpers have no mutable state here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId, invalidate]);

  async function action(work: (signal: AbortSignal) => Promise<void>) {
    if (busy) return;
    const token = ++generation.current; const controller = new AbortController(); active.current = controller;
    setBusy(true); setError(""); setMessage("");
    try { await work(controller.signal); }
    catch (failure) { if (generation.current === token) setError(controller.signal.aborted ? "Save-Auftrag abgebrochen. Gespeicherte Versionen und Dateiplanstatus prüfen." : failure instanceof Error ? failure.message : "Save-Auftrag fehlgeschlagen."); }
    finally { controller.abort(); if (generation.current === token) { setBusy(false); active.current = null; } }
  }
  async function history(all: boolean, offset = 0, signal?: AbortSignal) {
    const result = await readJson(await fetch(historyUrl(all, offset), { signal }));
    if (signal?.aborted) return;
    setVersions((previous) => offset ? [...new Map([...previous, ...result.versions].map((version) => [version.id, version])).values()] : result.versions); setNextOffset(result.nextOffset ?? null); setAllHistory(all);
  }
  async function inventory() {
    await action(async (signal) => {
      const profile = await readJson(await fetch(`/api/devices/${deviceId}/profile`, { signal }));
      const result = await readJson(await fetch(`/api/devices/${deviceId}/saves`, { signal }));
      if (signal.aborted) return;
      setRoots((profile.profile.saveRoots ?? []).map((root: { path: string }) => root.path)); setFiles(result.files ?? []); setFilePath("");
      setMessage(result.complete ? "Save-Inventar vollständig gelesen." : result.reason || "Save-Inventar ist unvollständig.");
    });
  }
  async function backup() {
    await action(async (signal) => {
      setProgress(null);
      const response = await fetch(`/api/devices/${deviceId}/saves`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filePath, ...(gameId ? { gameId: Number(gameId) } : {}) }), signal });
      if (!response.ok) { await readJson(response); return; }
      if (!response.body || !response.headers.get("Content-Type")?.startsWith("text/event-stream")) throw new Error("Ungültige Save-Progress-Antwort.");
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = ""; let done = false; let bytes = 0;
      try {
        for (;;) {
          const chunk = await reader.read(); if (chunk.done) break;
          bytes += chunk.value.byteLength; if (bytes > 1024 * 1024) throw new Error("Save-Progress-Antwort überschreitet ihre Grenze.");
          buffer += decoder.decode(chunk.value, { stream: true }); let boundary: number;
          while ((boundary = buffer.indexOf("\n\n")) >= 0) {
            const block = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2); if (!block.startsWith("data: ")) continue;
            const event = JSON.parse(block.slice(6)); if (signal.aborted) return;
            if (event.type === "progress") {
              if (!Number.isSafeInteger(event.bytes) || !Number.isSafeInteger(event.total) || event.bytes < 0 || event.bytes > event.total || event.total > 512 * 1024 * 1024) throw new Error("Ungültiger Save-Fortschritt.");
              setProgress({ bytes: event.bytes, total: event.total });
            }
            if (event.type === "error") throw new Error(event.error || "Die Save-Sicherung wurde nicht abgeschlossen.");
            if (event.type === "done") { done = true; setMessage("Verifizierte Save-Version gespeichert."); setVersionId(event.version.id); }
          }
          if (buffer.length > 16384) throw new Error("Ungültiger Save-Progress-Rahmen.");
        }
        if (!done) throw new Error("Save-Sicherung wurde vor erfolgreichem Abschluss unterbrochen.");
      } finally { try { await reader.cancel(); } catch { /* Already aborted. */ } reader.releaseLock(); }
      await history(allHistory, 0, signal);
    });
  }
  async function restore() {
    await action(async (signal) => {
      const result = await readJson(await fetch(`/api/saves/versions/${versionId}/restore`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetDeviceId: deviceId, targetPath }), signal }));
      if (signal.aborted) return;
      setRestorePlan(result.plan); setMessage(result.targetBackupVersionId ? "Bestehender Ziel-Save ist verifiziert gesichert. Restore-Dateiplan vor Anwendung prüfen." : "Restore-Dateiplan gespeichert. Ziel wurde noch nicht verändert.");
      await history(allHistory, 0, signal);
    });
  }
  async function syncPreview(afterKey = syncPlan?.summary.afterKey ?? "", selectedResolutions = resolutions) {
    await action(async (signal) => {
      const result = await readJson(await fetch(`/api/devices/${deviceId}/saves/sync`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "preview", masterDeviceId: Number(master), direction, resolutions: selectedResolutions, ...(afterKey ? { afterKey } : {}) }), signal }));
      if (!signal.aborted) { setSyncPlan(result); setMessage(result.status === "conflict" ? "Save-Konflikte ausdrücklich auflösen und neue Vorschau erstellen." : "Save-Sync-Vorschau gespeichert; vorhandene Ziele sind zuvor versioniert gesichert."); }
    });
  }
  async function syncApply() {
    if (!syncPlan) return;
    await action(async (signal) => {
      let polling = false;
      const poll = async () => { if (polling || signal.aborted) return; polling = true; try { const current = await readJson(await fetch(`/api/devices/${deviceId}/saves/sync?planId=${syncPlan.id}`, { signal })); if (!signal.aborted) setSyncPlan(current); } catch { /* Preserve last persisted state. */ } finally { polling = false; } };
      const timer = setInterval(() => { void poll(); }, 1000);
      try {
        const result = await readJson(await fetch(`/api/devices/${deviceId}/saves/sync`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "apply", planId: syncPlan.id }), signal }));
        if (!signal.aborted) { setSyncPlan(result); setMessage(result.status === "applied" ? "Save-Sync und verifizierte Baseline gespeichert." : "Gespeicherten Save-Sync-Status prüfen."); }
      } catch (failure) { await poll(); throw failure; }
      finally { clearInterval(timer); }
    });
  }

  return (
    <section className="card space-y-4" aria-labelledby={`device-saves-${deviceId}`}>
      <h2 id={`device-saves-${deviceId}`} className="font-heading text-lg font-bold">Saves und Savestates</h2>
      <p className="text-sm text-vault-muted">Unveränderliche, verifizierte Versionen bleiben auch nach dem Entfernen von Spiel oder Gerät erhalten. Restore und Sync sichern vorhandene Ziele zuerst und verwenden denselben rücknehmbaren Dateiplan. Originalbytes werden kopiert; Emulator- und Saveformat müssen zusammenpassen.</p>
      {loading ? <p className="text-sm text-vault-muted">Save-Konfiguration wird geladen…</p> : <>
        <p className="text-xs text-vault-muted break-all">Deklarierte Save-Wurzeln: {roots.join(" · ") || "Zuerst im Geräteprofil konfigurieren und danach Inventar lesen."}</p>
        <button type="button" disabled={busy} onClick={inventory} className="btn-secondary disabled:opacity-50">Save-Inventar lesen</button>
        <label className="block text-sm text-vault-muted">Tatsächliche Save-Datei<select aria-label="Tatsächliche Save-Datei" disabled={busy} className={inputClass} value={filePath} onChange={(event) => { setFilePath(event.target.value); setTargetPath(event.target.value); }}><option value="">Bitte auswählen</option>{files.map((file) => <option key={file.path} value={file.path}>{file.path} · {file.size} Bytes</option>)}</select></label>
        <label className="block text-sm text-vault-muted">Spielzuordnung (optional)<select aria-label="Spielzuordnung" disabled={busy} className={inputClass} value={gameId} onChange={(event) => setGameId(event.target.value)}><option value="">Ohne Spielzuordnung sichern</option>{games.map((game) => <option key={game.id} value={game.id}>{game.title} · {game.platformLabel}</option>)}</select></label>
        <div className="flex gap-2"><input aria-label="Spiel für Save-Zuordnung suchen" value={gameSearch} disabled={busy} onChange={(event) => setGameSearch(event.target.value)} className={inputClass} placeholder="Spielname" /><button type="button" disabled={busy} className="btn-secondary" onClick={() => action(async (signal) => { const result = await readJson(await fetch(`/api/games?limit=100&search=${encodeURIComponent(gameSearch)}`, { signal })); if (!signal.aborted) { setGames(result.games ?? []); setGameId(""); } })}>Spiel suchen</button></div>
        <button type="button" disabled={busy || !filePath} onClick={backup} className="btn-primary disabled:opacity-50">Save-Version sichern</button>
        <div className="border-t border-vault-border pt-4 space-y-3">
          <div className="flex flex-wrap gap-3"><button type="button" disabled={busy} className="btn-secondary" onClick={() => action((signal) => history(false, 0, signal))}>Geräteversionen laden</button><button type="button" disabled={busy} className="btn-secondary" onClick={() => action((signal) => history(true, 0, signal))}>Alle erhaltenen Versionen laden</button></div>
          <label className="block text-sm text-vault-muted">Gesicherte Version<select aria-label="Gesicherte Version" disabled={busy} className={inputClass} value={versionId} onChange={(event) => { setVersionId(event.target.value); setRestorePlan(null); }}><option value="">Bitte auswählen</option>{versions.map((version) => <option key={version.id} value={version.id}>{version.gameTitle ?? version.fileKey} · {version.deviceName} · {new Date(version.createdAt).toLocaleString("de-DE")} · {version.sha256.slice(0, 8)}</option>)}</select></label>
          {nextOffset !== null && <button type="button" disabled={busy} className="btn-secondary" onClick={() => action((signal) => history(allHistory, nextOffset, signal))}>Weitere Save-Versionen laden</button>}
          <label className="block text-sm text-vault-muted">Restore-Zielpfad auf diesem Gerät<input aria-label="Restore-Zielpfad" disabled={busy} className={inputClass} value={targetPath} onChange={(event) => { setTargetPath(event.target.value); setRestorePlan(null); }} placeholder={roots.length ? `${roots[0]}/Save-Dateiname` : "Save-Wurzel zuerst konfigurieren"} /></label>
          <button type="button" disabled={busy || !versionId || !targetPath} onClick={restore} className="btn-primary disabled:opacity-50">Restore-Dateiplan vorbereiten</button>
        </div>
        <div className="border-t border-vault-border pt-4 space-y-3">
          <h3 className="font-heading font-semibold">Save-Sync</h3>
          <label className="block text-sm text-vault-muted">Save-Mastergerät<select aria-label="Save-Mastergerät" value={master} disabled={busy} className={inputClass} onChange={(event) => { setMaster(event.target.value); setSyncPlan(null); setResolutions({}); }}><option value="">Bitte auswählen</option>{devices.map((device) => <option key={device.id} value={device.id}>{device.name}</option>)}</select></label>
          <label className="block text-sm text-vault-muted">Save-Sync-Richtung<select aria-label="Save-Sync-Richtung" value={direction} disabled={busy} className={inputClass} onChange={(event) => { setDirection(event.target.value as SyncDirection); setSyncPlan(null); setResolutions({}); }}><option value="push">Master → dieses Gerät</option><option value="pull">Dieses Gerät → Master</option><option value="two-way">Zweiweg seit letzter Baseline</option></select></label>
          <button type="button" disabled={busy || !master} onClick={() => syncPreview()} className="btn-primary disabled:opacity-50">Save-Sync-Vorschau erstellen</button>
          {syncPlan && <div className="space-y-3"><p className="text-sm">Save-Sync: {syncPlan.status} · {syncPlan.summary.progress}/{syncPlan.plans.length} Dateipläne abgeschlossen</p><ul className="space-y-2">{syncPlan.summary.rows.map((row) => <li key={row.fileKey} className="border border-vault-border rounded-lg p-3 text-sm"><p className="font-medium break-all">{row.fileKey}</p><p className="text-vault-muted">{row.reason}</p>{row.action === "conflict" && <select aria-label={`Save-Konflikt ${row.fileKey}`} disabled={busy} className={inputClass} value={resolutions[row.fileKey] ?? ""} onChange={(event) => setResolutions((previous) => ({ ...previous, [row.fileKey]: event.target.value as SyncResolution }))}><option value="">Bitte entscheiden</option>{row.master && <option value="master">Master verwenden{direction === "pull" ? " (überspringen)" : ""}</option>}{row.device && <option value="device">Gerät verwenden{direction === "push" ? " (überspringen)" : ""}</option>}<option value="skip">Diese Datei überspringen</option></select>}</li>)}</ul>{syncPlan.plans.map((id) => <p key={id} className="text-sm"><Link href={`/files?planId=${encodeURIComponent(id)}`} className="text-vault-amber">Save-Dateiplan {id} prüfen</Link></p>)}<button type="button" disabled={busy || !["ready", "applying", "recovery"].includes(syncPlan.status) || syncPlan.conflicts.some((conflict) => conflict.fileKey)} onClick={syncApply} className="btn-primary disabled:opacity-50">Gespeicherten Save-Sync anwenden oder fortsetzen</button>{syncPlan.status === "applied" && syncPlan.summary.nextKey && <button type="button" disabled={busy} onClick={() => { setResolutions({}); void syncPreview(syncPlan.summary.nextKey!, {}); }} className="btn-secondary">Nächste Save-Dateiseite</button>}</div>}
        </div>
      </>}
      {busy && <div className="flex gap-3 items-center"><p role="status" className="text-sm text-vault-muted">Save-Auftrag läuft…</p><button type="button" className="btn-secondary" onClick={() => active.current?.abort()}>Save-Auftrag abbrechen</button></div>}
      {progress && <p aria-live="polite" className="text-sm text-vault-muted">{progress.bytes}/{progress.total} Bytes gesichert.</p>}
      {message && <p role="status" className="text-sm text-vault-muted">{message}</p>}
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      {restorePlan && <FilePlanPanel plan={restorePlan} onChanged={setRestorePlan} />}
    </section>
  );
}
