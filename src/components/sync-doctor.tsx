"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { DoctorFindingKind, DoctorPage } from "@/lib/sync-doctor";

const LABELS: Record<DoctorFindingKind, string> = { missing: "Fehlend", extra: "Zusätzlich", changed: "Geändert", legacy: "Unbestätigte Kataloglinks", stale: "Veraltetes Manifest", unsafe: "Unsicher", unknown: "Unbekannt" };

export function SyncDoctor({ deviceId }: { deviceId: number }) {
  const [report, setReport] = useState<DoctorPage | null>(null);
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState<"diagnose" | "report" | "scan" | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const stopCurrent = useCallback(() => { generation.current++; controller.current?.abort(); }, []);

  useEffect(() => {
    setReport(null); setOffset(0); setBusy(null); setError(""); setMessage("");
    return stopCurrent;
  }, [deviceId, stopCurrent]);

  async function requestReport(action: "diagnose" | "report", nextOffset = 0, reportId?: string) {
    if (busy) return;
    const token = ++generation.current;
    const active = new AbortController();
    controller.current = active;
    setBusy(action); setError(""); setMessage("");
    const query = reportId ? `?reportId=${encodeURIComponent(reportId)}&offset=${nextOffset}&take=200` : "";
    try {
      const response = await fetch(`/api/devices/${deviceId}/doctor${query}`, { method: action === "diagnose" ? "POST" : "GET", signal: active.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Der Diagnosebericht konnte nicht geladen werden.");
      if (generation.current !== token || active.signal.aborted) return;
      if (!Array.isArray(data.findings) || !data.summary || typeof data.complete !== "boolean" || typeof data.reportId !== "string") throw new Error("Ungültiger Diagnosebericht.");
      setReport(data); setOffset(nextOffset);
    } catch (failure) {
      if (generation.current === token) {
        if (active.signal.aborted) setMessage("Diagnose abgebrochen.");
        else setError(failure instanceof Error ? failure.message : "Die Diagnose konnte nicht abgeschlossen werden.");
      }
    } finally {
      if (generation.current === token) { setBusy(null); controller.current = null; }
    }
  }

  async function rescan() {
    if (busy) return;
    const token = ++generation.current;
    const active = new AbortController();
    controller.current = active;
    setBusy("scan"); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/devices/${deviceId}/scan`, { method: "POST", signal: active.signal });
      const data = await response.json();
      if (!response.ok || data.success !== true) throw new Error(data.error || "Der Scan konnte nicht gestartet werden.");
      if (generation.current === token) setMessage("Scanauftrag angenommen. Nach dem Scan eine neue Diagnose starten; der gespeicherte Bericht bleibt unverändert.");
    } catch (failure) {
      if (generation.current === token) setError(failure instanceof Error ? failure.message : "Der Scan konnte nicht gestartet werden.");
    } finally { if (generation.current === token) { setBusy(null); controller.current = null; } }
  }

  return (
    <section className="card space-y-4" aria-labelledby={`sync-doctor-${deviceId}`}>
      <h2 id={`sync-doctor-${deviceId}`} className="font-heading text-lg font-bold">Sync Doctor</h2>
      <p className="text-sm text-vault-muted">Vergleicht einen vollständigen Gerätebestand mit Manifest und Katalog. Die Diagnose verändert keine Gerätedateien und keine Spielzuordnungen. Größe und Änderungszeit ersetzen keine Inhaltsprüfung.</p>
      <div className="flex flex-wrap gap-3">
        <button type="button" className="btn-primary disabled:opacity-50" disabled={busy !== null} onClick={() => requestReport("diagnose")}>Diagnose starten</button>
        <button type="button" className="btn-secondary disabled:opacity-50" disabled={busy !== null} onClick={() => requestReport("report")}>Letzten Bericht laden</button>
        {busy === "diagnose" && <button type="button" className="btn-secondary" onClick={() => controller.current?.abort()}>Diagnose abbrechen</button>}
      </div>
      {busy === "diagnose" && <p role="status" className="text-sm text-vault-muted">Gerätebestand wird gelesen…</p>}
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      {message && <p role="status" className="text-sm text-vault-muted">{message}</p>}
      {report && (
        <>
          <p className={`text-sm font-medium ${report.complete ? "text-green-400" : "text-vault-amber"}`}>{report.complete ? "Vollständiges Inventar" : "Unvollständiges Inventar"}</p>
          {!report.complete && <p className="text-sm text-vault-muted">Nicht beobachtete Dateien bleiben unbestätigt. Dieser Bericht erlaubt keine Löschentscheidungen; Scanwurzeln und Verbindung zuerst prüfen.</p>}
          {report.summary.truncated && <p className="text-sm text-vault-amber">Der Bericht erreicht seine Größen- oder Eintragsgrenze und ist ausdrücklich unvollständig.</p>}
          <p className="text-sm text-vault-muted">{report.summary.observed} Einträge gelesen · {report.summary.unchanged} ohne Metadatenabweichung · Bericht vom {new Date(report.createdAt).toLocaleString("de-DE")}</p>
          <dl className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">{Object.entries(LABELS).map(([kind, label]) => <div key={kind}><dt className="text-vault-muted">{label}</dt><dd>{report.summary.counts[kind as DoctorFindingKind] ?? 0}</dd></div>)}</dl>
          {(report.summary.counts.missing + report.summary.counts.extra + report.summary.counts.changed + report.summary.counts.legacy + report.summary.counts.stale + report.summary.counts.unknown > 0) && (
            <button type="button" disabled={busy !== null} onClick={rescan} className="btn-secondary disabled:opacity-50">Manifest durch neuen Scan aktualisieren</button>
          )}
          {report.findings.length === 0 ? <p className="text-sm text-vault-muted">Keine berichteten Abweichungen.</p> : <ul className="space-y-3">{report.findings.map((finding, index) => (
            <li key={`${finding.kind}:${finding.path ?? finding.gameId}:${index}`} className="border border-vault-border rounded-lg p-3 space-y-1">
              <p className="text-sm font-medium">{LABELS[finding.kind]}</p>
              {finding.path && <p className="text-sm break-all">{finding.path}</p>}
              {finding.title && <p className="text-sm text-vault-muted">{finding.title}</p>}
              {finding.legacyFile && <p className="text-sm text-vault-muted">Katalogvertreter: {finding.legacyFile}</p>}
              <p className="text-sm text-vault-muted">{finding.detail}</p>
              {finding.expected && <p className="text-xs text-vault-muted">Manifest: {finding.expected.size} Bytes · {finding.expected.modifiedAt ?? "Zeit unbekannt"} · {finding.expected.kind}</p>}
              {finding.actual && <p className="text-xs text-vault-muted">Inventar: {finding.actual.size} Bytes · {finding.actual.modifiedAt ?? "Zeit unbekannt"} · {finding.actual.kind}</p>}
              {report.complete && finding.repair === "review" && finding.actual?.kind === "file" && <p className="text-sm"><Link href="/files" className="text-vault-amber hover:text-vault-amber-hover">Dateimanager öffnen</Link><span className="text-vault-muted"> · Gerät und diesen Pfad dort auswählen, Dateiplan vor Anwendung prüfen.</span></p>}
            </li>
          ))}</ul>}
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-vault-muted">{report.total === 0 ? 0 : offset + 1}–{offset + report.findings.length} von {report.total} Befunden</span>
            <div className="flex gap-3">
              <button type="button" disabled={busy !== null || offset === 0} onClick={() => requestReport("report", Math.max(0, offset - 200), report.reportId)} className="text-vault-amber disabled:opacity-50">Vorherige Berichtsseite</button>
              <button type="button" disabled={busy !== null || report.nextOffset === null} onClick={() => requestReport("report", report.nextOffset ?? 0, report.reportId)} className="text-vault-amber disabled:opacity-50">Nächste Berichtsseite</button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
