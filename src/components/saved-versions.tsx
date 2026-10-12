"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FilePlanPanel } from "@/components/file-plan-panel";
import type { FilePlanView } from "@/lib/file-plans";
import type { SaveVersionView } from "@/lib/device-saves";

/** Persistent history does not depend on the continued existence of any device. */
export function SavedVersions() {
  const [versions, setVersions] = useState<SaveVersionView[]>([]);
  const [devices, setDevices] = useState<{ id: number; name: string }[]>([]);
  const [total, setTotal] = useState(0);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [versionId, setVersionId] = useState("");
  const [targetDevice, setTargetDevice] = useState("");
  const [targetPath, setTargetPath] = useState("");
  const [roots, setRoots] = useState<string[]>([]);
  const [plan, setPlan] = useState<FilePlanView | null>(null);
  const [busy, setBusy] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const active = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const readJson = async (response: Response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error || "Gesicherte Versionen konnten nicht geladen werden."); return data; };
  const inputClass = "w-full bg-vault-bg border border-vault-border rounded-lg px-3 py-2 text-sm";

  useEffect(() => {
    mounted.current = true; const controller = new AbortController(); active.current = controller; setBusy(true);
    void (async () => {
      try {
        const [history, list] = await Promise.all([fetch("/api/saves/versions?offset=0&take=20", { signal: controller.signal }).then(readJson), fetch("/api/devices", { signal: controller.signal }).then(readJson)]);
        if (controller.signal.aborted) return;
        setVersions(history.versions ?? []); setTotal(history.total ?? 0); setNextOffset(history.nextOffset ?? null); setDevices(list.devices ?? []);
      } catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Versionshistorie konnte nicht geladen werden."); }
      finally { if (!controller.signal.aborted) { setBusy(false); active.current = null; } }
    })();
    return () => { mounted.current = false; controller.abort(); active.current?.abort(); };
    // readJson has no mutable component state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setRoots([]); setTargetPath(""); setPlan(null);
    if (!targetDevice || !devices.some((device) => String(device.id) === targetDevice)) { setProfileLoading(false); return; }
    const controller = new AbortController(); setProfileLoading(true);
    void (async () => {
      try { const result = await readJson(await fetch(`/api/devices/${targetDevice}/profile`, { signal: controller.signal })); if (!controller.signal.aborted) setRoots((result.profile.saveRoots ?? []).map((root: { path: string }) => root.path)); }
      catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Zielprofil konnte nicht geladen werden."); }
      finally { if (!controller.signal.aborted) setProfileLoading(false); }
    })();
    return () => controller.abort();
    // readJson has no mutable component state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetDevice, devices]);

  async function action(work: (signal: AbortSignal) => Promise<void>) {
    if (busy) return;
    const controller = new AbortController(); active.current = controller; setBusy(true); setError(""); setMessage("");
    try { await work(controller.signal); }
    catch (failure) { if (mounted.current) setError(controller.signal.aborted ? "Vorgang abgebrochen. Gespeicherten Dateiplanstatus prüfen." : failure instanceof Error ? failure.message : "Versionsauftrag fehlgeschlagen."); }
    finally { controller.abort(); if (mounted.current) { setBusy(false); active.current = null; } }
  }
  async function more() {
    if (nextOffset === null) return;
    await action(async (signal) => { const history = await readJson(await fetch(`/api/saves/versions?offset=${nextOffset}&take=20`, { signal })); if (!signal.aborted) { setVersions((previous) => [...new Map([...previous, ...history.versions].map((version) => [version.id, version])).values()]); setTotal(history.total); setNextOffset(history.nextOffset ?? null); } });
  }
  async function restore() {
    if (!devices.some((device) => String(device.id) === targetDevice)) return;
    await action(async (signal) => {
      const result = await readJson(await fetch(`/api/saves/versions/${versionId}/restore`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetDeviceId: Number(targetDevice), targetPath }), signal }));
      if (!signal.aborted) { setPlan(result.plan); setMessage(result.targetBackupVersionId ? "Das bestehende Ziel wurde unveränderlich gesichert. Restore-Dateiplan vor Anwendung prüfen." : "Restore-Dateiplan vorbereitet. Ziel wurde noch nicht verändert."); }
    });
  }

  return (
    <section className="card space-y-5">
      <h2 className="font-heading text-xl font-bold">Erhaltene Save-Versionen</h2>
      <p className="text-sm text-vault-muted">{total} Versionen bleiben unabhängig von den ursprünglichen Spielen und Geräten erhalten. Die Historie liest ausschließlich gespeicherte Metadaten.</p>
      {versions.length === 0 && !busy && <p className="text-sm text-vault-muted">Noch keine gespeicherten Versionen vorhanden.</p>}
      <ul className="space-y-3">{versions.map((version) => <li key={version.id} className="border border-vault-border rounded-lg p-3 space-y-1"><p className="text-sm font-medium">{version.gameTitle ?? version.fileKey}</p><p className="text-sm text-vault-muted">{version.deviceName} · {new Date(version.createdAt).toLocaleString("de-DE")} · {version.size} Bytes</p><p className="text-xs break-all text-vault-muted">{version.sourcePath}</p><p className="text-xs break-all text-vault-muted">SHA-256: {version.sha256}</p><button type="button" disabled={busy} onClick={() => { setVersionId(version.id); setPlan(null); }} className="text-sm text-vault-amber hover:text-vault-amber-hover" aria-label={`Version ${version.id} zum Restore auswählen`}>Zum Restore auswählen</button></li>)}</ul>
      {nextOffset !== null && <button type="button" disabled={busy} onClick={more} className="btn-secondary">Weitere erhaltene Versionen laden</button>}
      {devices.length === 0 ? <p className="text-sm text-vault-muted">Kein Zielgerät vorhanden. Die Versionen bleiben lesbar. <Link href="/admin" className="text-vault-amber">Ein Gerät zum Restore hinzufügen</Link></p> : <div className="border-t border-vault-border pt-4 space-y-3"><label className="block text-sm text-vault-muted">Vorhandenes Restore-Zielgerät<select aria-label="Vorhandenes Restore-Zielgerät" className={inputClass} disabled={busy} value={targetDevice} onChange={(event) => setTargetDevice(event.target.value)}><option value="">Bitte ausdrücklich auswählen</option>{devices.map((device) => <option key={device.id} value={device.id}>{device.name}</option>)}</select></label>{profileLoading ? <p className="text-sm text-vault-muted">Zielprofil wird geladen…</p> : <p className="text-xs text-vault-muted break-all">Deklarierte Save-Wurzeln: {roots.join(" · ") || "Save-Wurzeln im Geräteprofil konfigurieren."}</p>}<label className="block text-sm text-vault-muted">Restore-Zielpfad<input aria-label="Restore-Zielpfad" className={inputClass} disabled={busy} value={targetPath} onChange={(event) => { setTargetPath(event.target.value); setPlan(null); }} placeholder={roots.length ? `${roots[0]}/Save-Dateiname` : "Tatsächliche Save-Wurzel wählen"} /></label><p className="text-sm text-vault-muted">Ausgewählte Version: {versionId || "Bitte eine erhaltene Version auswählen."}</p><button type="button" disabled={busy || profileLoading || !versionId || !targetDevice || !targetPath || !roots.length} onClick={restore} className="btn-primary disabled:opacity-50">Restore aus erhaltener Version vorbereiten</button></div>}
      {busy && <p role="status" className="text-sm text-vault-muted">Gespeicherte Versionen werden verarbeitet…</p>}
      {message && <p role="status" className="text-sm text-vault-muted">{message}</p>}
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      {plan && <FilePlanPanel plan={plan} onChanged={setPlan} />}
    </section>
  );
}
