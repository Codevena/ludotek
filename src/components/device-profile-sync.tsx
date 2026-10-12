"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { DeviceProfileData, ProfileRoot } from "@/lib/device-profiles";
import type { DeviceSyncView, SyncDirection, SyncResolution } from "@/lib/device-profile-sync";
type Template = { id: DeviceProfileData["template"]; label: string; romHint: string; saveHint: string; formats: readonly string[]; source: string | null };
const rootsText = (roots: ProfileRoot[]) => roots.map((root) => `${root.platform ? `${root.platform}=` : ""}${root.path}`).join("\n");
function parseRoots(text: string): ProfileRoot[] {
  return text.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
    const separator = line.indexOf("=");
    return separator > 0 && !line.startsWith("/") ? { platform: line.slice(0, separator), path: line.slice(separator + 1) } : { path: line };
  });
}

export function DeviceProfileSync({ deviceId }: { deviceId: number }) {
  const [devices, setDevices] = useState<{ id: number; name: string }[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [template, setTemplate] = useState<DeviceProfileData["template"]>("custom");
  const [romRoots, setRomRoots] = useState("");
  const [saveRoots, setSaveRoots] = useState("");
  const [formats, setFormats] = useState("");
  const [reserve, setReserve] = useState("0");
  const [master, setMaster] = useState("");
  const [direction, setDirection] = useState<SyncDirection>("push");
  const [platform, setPlatform] = useState("");
  const [plan, setPlan] = useState<DeviceSyncView | null>(null);
  const [resolutions, setResolutions] = useState<Record<string, SyncResolution>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [profileDirty, setProfileDirty] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const active = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const invalidate = useCallback(() => { generation.current++; active.current?.abort(); }, []);
  const selectedTemplate = templates.find((entry) => entry.id === template);
  const inputClass = "w-full bg-vault-bg border border-vault-border rounded-lg px-3 py-2 text-sm";

  useEffect(() => {
    const token = ++generation.current;
    const controller = new AbortController(); active.current = controller;
    setLoading(true); setPlan(null); setMaster(""); setError(""); setMessage(""); setBusy(false); setResolutions({}); setProfileDirty(false);
    void (async () => {
      try {
        const [profileResponse, devicesResponse] = await Promise.all([fetch(`/api/devices/${deviceId}/profile`, { signal: controller.signal }), fetch("/api/devices", { signal: controller.signal })]);
        const profile = await profileResponse.json(); const list = await devicesResponse.json();
        if (!profileResponse.ok || !devicesResponse.ok) throw new Error(profile.error || list.error || "Profile konnten nicht geladen werden.");
        if (generation.current !== token) return;
        setTemplates(profile.templates ?? []); setDevices((list.devices ?? []).filter((device: { id: number }) => device.id !== deviceId));
        setTemplate(profile.profile.template); setRomRoots(rootsText(profile.profile.romRoots)); setSaveRoots(rootsText(profile.profile.saveRoots));
        setFormats(profile.profile.formats.join(", ")); setReserve(String(Number(profile.profile.reserveBytes) / (1024 * 1024)));
      } catch (failure) { if (generation.current === token && !controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Profile konnten nicht geladen werden."); }
      finally { if (generation.current === token) { setLoading(false); active.current = null; } }
    })();
    return invalidate;
  }, [deviceId, invalidate]);

  async function action(work: (signal: AbortSignal) => Promise<void>) {
    if (busy) return;
    const token = ++generation.current; const controller = new AbortController(); active.current = controller;
    setBusy(true); setError(""); setMessage("");
    try { await work(controller.signal); }
    catch (failure) { if (generation.current === token) setError(controller.signal.aborted ? "Vorgang abgebrochen. Gespeicherten Planstatus vor einer Wiederholung prüfen." : failure instanceof Error ? failure.message : "Profilvorgang fehlgeschlagen."); }
    finally { if (generation.current === token) { setBusy(false); active.current = null; } }
  }
  async function responseJson(response: Response) {
    const data = await response.json(); if (!response.ok) throw new Error(data.error || "Vorgang fehlgeschlagen."); return data;
  }
  async function saveProfile() {
    await action(async (signal) => {
      const mib = Number(reserve);
      if (!Number.isFinite(mib) || mib < 0 || !Number.isSafeInteger(mib * 1024 * 1024)) throw new Error("Speicherreserve in gültigen MiB angeben.");
      const payload = { template, romRoots: parseRoots(romRoots), saveRoots: parseRoots(saveRoots), formats: formats.split(",").map((format) => format.trim()).filter(Boolean), reserveBytes: String(mib * 1024 * 1024) };
      await responseJson(await fetch(`/api/devices/${deviceId}/profile`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal }));
      if (!signal.aborted) { setMessage("Geräteprofil gespeichert."); setPlan(null); setProfileDirty(false); }
    });
  }
  async function preview(afterKey = plan?.summary.afterKey ?? "", selectedResolutions = resolutions) {
    await action(async (signal) => {
      const payload = { masterDeviceId: Number(master), deviceId, direction, ...(platform.trim() ? { platform: platform.trim() } : {}), ...(afterKey ? { afterKey } : {}), resolutions: selectedResolutions };
      const data = await responseJson(await fetch("/api/device-sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal }));
      if (!signal.aborted) { setPlan(data); setMessage(data.status === "conflict" ? "Konflikte pro Datei auflösen und die Vorschau erneut erstellen." : "Vorschau gespeichert. Dateien wurden noch nicht verändert."); }
    });
  }
  async function apply() {
    if (!plan) return;
    await action(async (signal) => {
      try {
        const data = await responseJson(await fetch(`/api/device-sync/${plan.id}/apply`, { method: "POST", signal }));
        if (!signal.aborted) { setPlan(data); setMessage(data.status === "applied" ? "Synchronisierung und verifizierte Baseline gespeichert." : "Gespeicherten Planstatus prüfen."); }
      } catch (failure) {
        if (!signal.aborted) {
          try { const stored = await responseJson(await fetch(`/api/device-sync/${plan.id}`, { signal })); setPlan(stored); } catch { /* Keep the last known plan ID for recovery. */ }
        }
        throw failure;
      }
    });
  }

  return (
    <section className="card space-y-4" aria-labelledby={`device-profile-${deviceId}`}>
      <h2 id={`device-profile-${deviceId}`} className="font-heading text-lg font-bold">Geräteprofil und ROM-Sync</h2>
      {loading ? <p className="text-sm text-vault-muted">Profil wird geladen…</p> : (
        <>
          <p className="text-sm text-vault-muted">Vorlagen sind editierbare Regeln. Wurzeln und Emulatorformate am eigenen Gerät prüfen; beide Geräte vor der Vorschau vollständig scannen.</p>
          <label className="block text-sm text-vault-muted">Profilvorlage<select aria-label="Profilvorlage" disabled={busy} className={inputClass} value={template} onChange={(event) => { const selected = templates.find((entry) => entry.id === event.target.value); setTemplate(event.target.value as DeviceProfileData["template"]); if (selected) setFormats(selected.formats.join(", ")); setProfileDirty(true); setPlan(null); }}>{templates.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}</select></label>
          {selectedTemplate && <p className="text-xs text-vault-muted">{selectedTemplate.romHint} · {selectedTemplate.saveHint}{selectedTemplate.source && <> · <a href={selectedTemplate.source} target="_blank" rel="noreferrer" className="text-vault-amber">Dokumentation</a></>}</p>}
          <label className="block text-sm text-vault-muted">ROM-Wurzeln<textarea aria-label="ROM-Wurzeln" rows={3} disabled={busy} className={inputClass} value={romRoots} onChange={(event) => { setRomRoots(event.target.value); setProfileDirty(true); setPlan(null); }} /></label>
          <p className="text-xs text-vault-muted">Eine Wurzel pro Zeile. Für Plattformzuordnung beispielsweise snes=/dein/roms/SFC; allgemeine Wurzeln enthalten Unterordner mit Plattformnamen. Nur konfigurierte Scanwurzeln oder deren Nachkommen.</p>
          <label className="block text-sm text-vault-muted">Save-Wurzeln<textarea aria-label="Save-Wurzeln" rows={2} disabled={busy} className={inputClass} value={saveRoots} onChange={(event) => { setSaveRoots(event.target.value); setProfileDirty(true); setPlan(null); }} /></label>
          <p className="text-xs text-vault-muted">Save-Wurzeln werden hier nur konfiguriert. Save-Backups und Restore haben eigene ausdrückliche Aktionen.</p>
          <label className="block text-sm text-vault-muted">Erlaubte ROM-Endungen<input aria-label="Erlaubte ROM-Endungen" disabled={busy} className={inputClass} value={formats} onChange={(event) => { setFormats(event.target.value); setProfileDirty(true); setPlan(null); }} placeholder=".chd, .sfc, .m3u" /></label>
          <p className="text-xs text-vault-muted">Leer bedeutet keine Formatbeschränkung durch dieses Profil. Descriptor- und Trackformate gemeinsam freigeben.</p>
          <label className="block text-sm text-vault-muted">Freie Speicherreserve (MiB)<input aria-label="Freie Speicherreserve (MiB)" type="number" min="0" step="1" disabled={busy} className={inputClass} value={reserve} onChange={(event) => { setReserve(event.target.value); setProfileDirty(true); setPlan(null); }} /></label>
          <button type="button" disabled={busy} onClick={saveProfile} className="btn-secondary disabled:opacity-50">Profil speichern</button>
          <div className="border-t border-vault-border pt-4 space-y-3">
            <label className="block text-sm text-vault-muted">Mastergerät<select aria-label="Mastergerät" value={master} disabled={busy} className={inputClass} onChange={(event) => { setMaster(event.target.value); setPlan(null); setResolutions({}); }}><option value="">Bitte auswählen</option>{devices.map((device) => <option key={device.id} value={device.id}>{device.name}</option>)}</select></label>
            <label className="block text-sm text-vault-muted">Synchronisierungsrichtung<select aria-label="Synchronisierungsrichtung" disabled={busy} className={inputClass} value={direction} onChange={(event) => { setDirection(event.target.value as SyncDirection); setPlan(null); setResolutions({}); }}><option value="push">Push: Master → dieses Gerät</option><option value="pull">Pull: dieses Gerät → Master</option><option value="two-way">Zweiweg: Änderungen seit Baseline</option></select></label>
            <label className="block text-sm text-vault-muted">Plattformfilter (optional)<input aria-label="Plattformfilter" disabled={busy} className={inputClass} value={platform} onChange={(event) => { setPlatform(event.target.value); setPlan(null); setResolutions({}); }} placeholder="snes" /></label>
            {profileDirty && <p className="text-sm text-vault-amber">Profiländerungen vor der Sync-Vorschau speichern.</p>}
            <button type="button" disabled={busy || !master || profileDirty} onClick={() => preview()} className="btn-primary disabled:opacity-50">Sync-Vorschau erstellen</button>
          </div>
        </>
      )}
      {busy && <p role="status" className="text-sm text-vault-muted">Profil oder Dateiplan wird verarbeitet…</p>}
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      {message && <p role="status" className="text-sm text-vault-muted">{message}</p>}
      {plan && (
        <div className="space-y-3">
          <p className="text-sm">Plan: {plan.status} · {plan.summary.bytes} zu übertragende Bytes · {plan.summary.rows.length} von {plan.summary.total} Dateischlüsseln</p>
          <p className="text-xs text-vault-muted">Keine automatische Löschung, keine Entscheidung nach Änderungszeit. Bestehende Zieldateien bleiben bei bestätigter Ersetzung im gemeinsamen Dateijournal als Quarantäne erhalten.</p>
          <ul className="space-y-2">{plan.summary.rows.map((row) => <li key={row.fileKey} className="border border-vault-border rounded-lg p-3 text-sm space-y-1"><p className="font-medium break-all">{row.fileKey}</p><p className="text-vault-muted">{row.reason}</p><p className="text-xs break-all">Master: {row.masterPath || "nicht vorhanden"}<br />Gerät: {row.devicePath || "nicht vorhanden"}</p>{row.action === "conflict" && <label className="block">Konfliktauflösung<select aria-label={`Konfliktauflösung ${row.fileKey}`} disabled={busy} className={inputClass} value={resolutions[row.fileKey] ?? ""} onChange={(event) => setResolutions((previous) => ({ ...previous, [row.fileKey]: event.target.value as SyncResolution }))}><option value="">Bitte entscheiden</option>{row.master && <option value="master">Master verwenden{direction === "pull" ? " (überspringen)" : ""}</option>}{row.device && <option value="device">Gerät verwenden{direction === "push" ? " (überspringen)" : ""}</option>}<option value="skip">Diese Datei überspringen</option></select></label>}</li>)}</ul>
          {plan.plans.map((id) => <p key={id} className="text-sm"><Link href={`/files?planId=${encodeURIComponent(id)}`} className="text-vault-amber">Gemeinsamen Dateiplan {id} prüfen</Link></p>)}
          {plan.status === "recovery" && <p className="text-sm text-vault-amber">Gemeinsame Dateipläne zuerst prüfen und bei Bedarf abgleichen. Die Fortsetzung verwendet dieselben gespeicherten Fingerprints; eine spätere Dateiänderung wird nicht übernommen.</p>}
          <button type="button" disabled={busy || !["ready", "applying", "recovery"].includes(plan.status) || plan.conflicts.some((conflict) => conflict.fileKey)} onClick={apply} className="btn-primary disabled:opacity-50">{["applying", "recovery"].includes(plan.status) ? "Gespeicherten Sync-Plan fortsetzen" : "Geprüften Sync-Plan anwenden"}</button>
          {plan.summary.nextKey && plan.status === "applied" && <button type="button" disabled={busy} onClick={() => { setResolutions({}); void preview(plan.summary.nextKey!, {}); }} className="btn-secondary disabled:opacity-50">Nächste Dateiseite vorbereiten</button>}
        </div>
      )}
    </section>
  );
}
