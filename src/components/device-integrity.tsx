"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { IntegritySourceView, IntegritySnapshot, IntegrityJobView } from "@/lib/device-integrity";
import type { DatRom } from "@/lib/dat";

type FileChoice = { id: number; path: string; size: string; platform: string | null };
type RomChoice = DatRom & { index: number };
type Overview = { files: FileChoice[]; totalFiles?: number; nextFilesCursor: number | null; inventoryComplete: boolean; job: IntegrityJobView | null; jobs?: IntegrityJobView[]; nextJobsCursor?: string | null };

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Die Integritätsprüfung ist nicht verfügbar.");
  return data as T;
}
const statuses: Record<string, string> = { verified: "Verifiziert", unknown: "Unbekannt", mismatch: "Abweichung", stale: "Veraltet" };

export function DeviceIntegrity({ deviceId }: { deviceId: number }) {
  const prefix = `integrity-${deviceId}`;
  const [sources, setSources] = useState<IntegritySourceView[]>([]);
  const [sourceCursor, setSourceCursor] = useState<string | null>(null);
  const [sourceId, setSourceId] = useState("");
  const [files, setFiles] = useState<FileChoice[]>([]);
  const [fileCursor, setFileCursor] = useState<number | null>(null);
  const [totalFiles, setTotalFiles] = useState(0);
  const [fileId, setFileId] = useState("");
  const [fileQuery, setFileQuery] = useState("");
  const [roms, setRoms] = useState<RomChoice[]>([]);
  const [romCursor, setRomCursor] = useState<number | null>(null);
  const [romQuery, setRomQuery] = useState("");
  const [appliedRomQuery, setAppliedRomQuery] = useState("");
  const [expectedIndex, setExpectedIndex] = useState("");
  const [inventoryComplete, setInventoryComplete] = useState(true);
  const [jobId, setJobId] = useState("");
  const [history, setHistory] = useState<IntegrityJobView[]>([]);
  const [historyCursor, setHistoryCursor] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<IntegritySnapshot | null>(null);
  const [pollVersion, setPollVersion] = useState(0);
  const [datFile, setDatFile] = useState<File | null>(null);
  const [datName, setDatName] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const mounted = useRef(true);
  const selectedJob = useRef("");
  const currentDevice = useRef(deviceId);
  currentDevice.current = deviceId;
  const currentSource = useRef(sourceId);
  currentSource.current = sourceId;
  const currentRomQuery = useRef(appliedRomQuery);
  currentRomQuery.current = appliedRomQuery;
  const fileLookupGeneration = useRef(0);
  const running = snapshot?.job.status === "running";

  const applySnapshot = useCallback((value: IntegritySnapshot, append = false) => {
    if (!mounted.current || selectedJob.current !== value.job.id) return;
    setSnapshot((previous) => {
      if (previous?.job.id === value.job.id && previous.job.status !== "running" && value.job.status === "running") return previous;
      return append && previous?.job.id === value.job.id ? { ...value, results: [...previous.results, ...value.results.filter((item) => !previous.results.some((old) => old.id === item.id))] } : value;
    });
    if (value.job.status !== "running") setCancelling(false);
    else if (value.job.cancelRequested) setCancelling(true);
  }, []);

  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    fileLookupGeneration.current++;
    setLoading(true); setError(""); setFiles([]); setSnapshot(null); setJobId(""); setHistory([]); setHistoryCursor(null); setFileId(""); setExpectedIndex(""); setCancelling(false); selectedJob.current = "";
    void Promise.all([
      json<{ sources: IntegritySourceView[]; nextCursor: string | null }>("/api/integrity/dats", { signal: controller.signal }),
      json<Overview>(`/api/devices/${deviceId}/integrity`, { signal: controller.signal }),
    ]).then(([dat, overview]) => {
      if (controller.signal.aborted) return;
      setSources(dat.sources); setSourceCursor(dat.nextCursor); setFiles(overview.files); setFileCursor(overview.nextFilesCursor); setInventoryComplete(overview.inventoryComplete);
      setTotalFiles(overview.totalFiles ?? overview.files.length);
      setHistory(overview.jobs ?? (overview.job ? [overview.job] : [])); setHistoryCursor(overview.nextJobsCursor ?? null);
      if (overview.job) { selectedJob.current = overview.job.id; setJobId(overview.job.id); setSnapshot({ job: overview.job, results: [], nextCursor: null }); }
    }).catch((failure) => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Integrität konnte nicht geladen werden."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { mounted.current = false; controller.abort(); };
  }, [deviceId]);

  useEffect(() => {
    setRoms([]); setExpectedIndex(""); setRomCursor(null);
    if (!sourceId) return;
    const controller = new AbortController();
    void json<{ roms: RomChoice[]; nextCursor: number | null }>(`/api/integrity/dats?sourceId=${encodeURIComponent(sourceId)}&q=${encodeURIComponent(appliedRomQuery)}`, { signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted) { setRoms(data.roms); setRomCursor(data.nextCursor); } })
      .catch((failure) => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "DAT-Revisionen konnten nicht geladen werden."); });
    return () => controller.abort();
  }, [sourceId, appliedRomQuery]);

  useEffect(() => {
    if (!jobId) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const value = await json<IntegritySnapshot>(`/api/integrity/jobs/${encodeURIComponent(jobId)}`, { signal: controller.signal });
        if (controller.signal.aborted) return;
        applySnapshot(value);
        if (value.job.status === "running") timer = setTimeout(() => { void poll(); }, 1000);
      } catch (failure) {
        if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Prüfstatus konnte nicht geladen werden.");
      }
    };
    void poll();
    return () => { controller.abort(); if (timer) clearTimeout(timer); };
  }, [jobId, applySnapshot, pollVersion]);

  async function importDat() {
    if (!datFile || busy) return;
    if (datFile.size > 5 * 1024 * 1024) { setError("Eine DAT-Datei darf höchstens 5 MiB groß sein."); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await json<{ source: IntegritySourceView }>(`/api/integrity/dats?name=${encodeURIComponent(datName || datFile.name)}`, { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: datFile });
      if (!mounted.current || currentDevice.current !== deviceId) return;
      setSources((previous) => previous.some((source) => source.id === result.source.id) ? previous : [...previous, result.source]);
      setSourceId(result.source.id); setMessage(`${result.source.name}: ${result.source.romCount} DAT-Einträge lokal importiert.`);
    } catch (failure) { if (mounted.current) setError(failure instanceof Error ? failure.message : "DAT-Import fehlgeschlagen."); }
    finally { if (mounted.current) setBusy(false); }
  }
  async function start() {
    if (busy || running || loading) return;
    const body: { datSourceId?: string; fileIds?: number[]; expected?: { deviceFileId: number; romIndex: number }[] } = {};
    if (sourceId) body.datSourceId = sourceId;
    if (fileId) body.fileIds = [Number(fileId)];
    if (fileId && sourceId && expectedIndex !== "") body.expected = [{ deviceFileId: Number(fileId), romIndex: Number(expectedIndex) }];
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await json<{ job: IntegrityJobView }>(`/api/devices/${deviceId}/integrity`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!mounted.current || currentDevice.current !== deviceId) return;
      selectedJob.current = result.job.id; setCancelling(false); setSnapshot({ job: result.job, results: [], nextCursor: null }); setJobId(result.job.id);
      setHistory((previous) => [result.job, ...previous.filter((entry) => entry.id !== result.job.id)]);
    } catch (failure) { if (mounted.current) setError(failure instanceof Error ? failure.message : "Prüfung konnte nicht gestartet werden."); }
    finally { if (mounted.current) setBusy(false); }
  }
  async function cancel() {
    if (!jobId || cancelling) return;
    setCancelling(true); setError("");
    try { applySnapshot(await json<IntegritySnapshot>(`/api/integrity/jobs/${encodeURIComponent(jobId)}/cancel`, { method: "POST" })); }
    catch (failure) { if (mounted.current) { setCancelling(false); setError(failure instanceof Error ? failure.message : "Abbruch konnte nicht angefordert werden."); } }
  }
  async function loadMoreResults() {
    if (!snapshot?.nextCursor || running) return;
    try { applySnapshot(await json<IntegritySnapshot>(`/api/integrity/jobs/${encodeURIComponent(jobId)}?afterId=${snapshot.nextCursor}`), true); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Weitere Ergebnisse konnten nicht geladen werden."); }
  }
  async function loadFiles(append = false) {
    const generation = ++fileLookupGeneration.current;
    try {
      const data = await json<Overview>(`/api/devices/${deviceId}/integrity?q=${encodeURIComponent(fileQuery)}${append && fileCursor ? `&afterFileId=${fileCursor}` : ""}`);
      if (mounted.current && currentDevice.current === deviceId && generation === fileLookupGeneration.current) { setFiles((previous) => append ? [...previous, ...data.files] : data.files); setFileCursor(data.nextFilesCursor); if (data.totalFiles !== undefined) setTotalFiles(data.totalFiles); if (!append) { setFileId(""); setExpectedIndex(""); } }
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Dateien konnten nicht geladen werden."); }
  }
  async function moreRoms() {
    if (romCursor === null || !sourceId) return;
    try {
      const data = await json<{ roms: RomChoice[]; nextCursor: number | null }>(`/api/integrity/dats?sourceId=${encodeURIComponent(sourceId)}&afterIndex=${romCursor}&q=${encodeURIComponent(appliedRomQuery)}`);
      if (mounted.current && currentSource.current === sourceId && currentRomQuery.current === appliedRomQuery) { setRoms((previous) => [...previous, ...data.roms]); setRomCursor(data.nextCursor); }
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Revisionen konnten nicht geladen werden."); }
  }
  async function moreSources() {
    if (!sourceCursor) return;
    try {
      const data = await json<{ sources: IntegritySourceView[]; nextCursor: string | null }>(`/api/integrity/dats?afterId=${encodeURIComponent(sourceCursor)}`);
      if (mounted.current) { setSources((previous) => [...previous, ...data.sources]); setSourceCursor(data.nextCursor); }
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Quellen konnten nicht geladen werden."); }
  }
  async function moreHistory() {
    if (!historyCursor) return;
    try {
      const data = await json<Overview>(`/api/devices/${deviceId}/integrity?beforeJobId=${encodeURIComponent(historyCursor)}`);
      if (mounted.current && currentDevice.current === deviceId) { setHistory((previous) => [...previous, ...(data.jobs ?? []).filter((entry) => !previous.some((old) => old.id === entry.id))]); setHistoryCursor(data.nextJobsCursor ?? null); }
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Prüfverlauf konnte nicht geladen werden."); }
  }

  const job = snapshot?.job;
  const progressText = job ? `${job.checked}/${job.total} Dateien` : "";
  const jobText = job?.status === "cancelled" ? `Prüfung abgebrochen: ${progressText}.`
    : job?.status === "interrupted" ? `Prüfung unterbrochen: ${progressText}. Starte einen neuen Prüflauf.`
      : job?.status === "failed" ? `Prüfung fehlgeschlagen: ${progressText}. Bereits gespeicherte Ergebnisse bleiben erhalten.`
        : job?.status === "completed_with_stale" ? `Prüflauf abgeschlossen: ${progressText}. Geänderte Dateien bitte erneut scannen.`
          : job?.status === "completed" ? `Prüflauf abgeschlossen: ${progressText}.`
            : cancelling ? `Abbruch wird angefordert; laufende Dateiübertragung wird beendet: ${progressText}.`
              : job ? `Prüfung läuft: ${progressText}.` : "";
  return (
    <section className="card space-y-4" aria-labelledby={`${prefix}-title`}>
      <h2 id={`${prefix}-title`} className="font-heading text-lg font-bold">ROM-Integrität und DAT-Prüfung</h2>
      <p className="text-sm text-vault-muted">Dateien werden auf diesem Server gestreamt und mit Größe, CRC32, MD5, SHA-1 und SHA-256 geprüft. Ohne passenden DAT-Eintrag bleibt ein Inhalt unbekannt. Eine Abweichung erfordert eine ausdrücklich gewählte erwartete Revision.</p>
      {!inventoryComplete && <p className="text-sm text-amber-400">Der Gerätebestand ist unvollständig. Bitte erneut scannen; der Prüflauf umfasst ausschließlich bereits bestätigte physische Dateien.</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${prefix}-dat-file`} className="block text-sm text-vault-muted">Lokale DAT-Datei (XML oder clrmamepro, höchstens 5 MiB)</label>
          <input id={`${prefix}-dat-file`} type="file" accept=".dat,.xml,.txt" disabled={busy} onChange={(event) => { const selected = event.target.files?.[0] ?? null; setDatFile(selected); setDatName(selected?.name.slice(0, 120) ?? ""); }} className="w-full text-sm" />
          <label htmlFor={`${prefix}-dat-name`} className="block mt-2 text-sm text-vault-muted">Name der DAT-Quelle</label>
          <input id={`${prefix}-dat-name`} value={datName} maxLength={120} onChange={(event) => setDatName(event.target.value)} className="w-full bg-vault-bg border border-vault-border rounded-lg px-3 py-2 text-sm" />
          <button type="button" onClick={importDat} disabled={!datFile || busy} className="btn-secondary mt-2 disabled:opacity-50">DAT lokal importieren</button>
        </div>
        <div>
          <label htmlFor={`${prefix}-source`} className="block text-sm text-vault-muted">DAT-Quelle</label>
          <select id={`${prefix}-source`} value={sourceId} disabled={loading || busy || running} onChange={(event) => { setSourceId(event.target.value); setExpectedIndex(""); }} className="w-full bg-vault-bg border border-vault-border rounded-lg px-3 py-2 text-sm">
            <option value="">Ohne DAT – Hashes und Inhaltsduplikate</option>
            {sources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}
          </select>
          {sourceCursor && <button type="button" onClick={moreSources} className="btn-secondary mt-2">Weitere DAT-Quellen laden</button>}
          <p className="text-xs text-vault-muted mt-2">DAT-Dateien und Prüfergebnisse bleiben lokal. Namen wählen keine erwartete Revision automatisch aus.</p>
        </div>
      </div>
      <div>
        <label htmlFor={`${prefix}-scope`} className="block text-sm text-vault-muted">Prüfumfang</label>
        <select id={`${prefix}-scope`} value={fileId} disabled={loading || busy || running} onChange={(event) => { setFileId(event.target.value); setExpectedIndex(""); }} className="w-full bg-vault-bg border border-vault-border rounded-lg px-3 py-2 text-sm">
          <option value="">Alle bestätigten ROM-Dateien dieses Geräts</option>
          {files.map((file) => <option key={file.id} value={file.id}>{file.path}</option>)}
        </select>
        <div className="flex gap-2 mt-2">
          <input aria-label="Physische Datei suchen" maxLength={100} value={fileQuery} onChange={(event) => setFileQuery(event.target.value)} className="min-w-0 flex-1 bg-vault-bg border border-vault-border rounded-lg px-3 py-2 text-sm" />
          <button type="button" disabled={running} onClick={() => { void loadFiles(); }} className="btn-secondary">Datei suchen</button>
          {fileCursor !== null && <button type="button" onClick={() => { void loadFiles(true); }} className="btn-secondary">Weitere Dateien laden</button>}
        </div>
      </div>
      {sourceId && fileId && <div>
        <label htmlFor={`${prefix}-revision`} className="block text-sm text-vault-muted">Erwartete DAT-Revision</label>
        <select id={`${prefix}-revision`} value={expectedIndex} disabled={busy || running} onChange={(event) => setExpectedIndex(event.target.value)} className="w-full bg-vault-bg border border-vault-border rounded-lg px-3 py-2 text-sm">
          <option value="">Keine Erwartung – unbekannt bei fehlendem Treffer</option>
          {roms.map((rom) => <option key={rom.index} value={rom.index}>{rom.gameName} · {rom.name} · {rom.size} Bytes</option>)}
        </select>
        <div className="flex gap-2 mt-2">
          <input aria-label="DAT-Revision suchen" maxLength={100} value={romQuery} onChange={(event) => setRomQuery(event.target.value)} className="min-w-0 flex-1 bg-vault-bg border border-vault-border rounded-lg px-3 py-2 text-sm" />
          <button type="button" onClick={() => setAppliedRomQuery(romQuery)} className="btn-secondary">Revision suchen</button>
          {romCursor !== null && <button type="button" onClick={moreRoms} className="btn-secondary">Weitere Revisionen laden</button>}
        </div>
      </div>}
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={start} disabled={loading || busy || running || totalFiles === 0} className="btn-primary disabled:opacity-50">Integrität prüfen</button>
        {running && <button type="button" onClick={cancel} disabled={cancelling} className="btn-secondary disabled:opacity-50">Prüfung abbrechen</button>}
      </div>
      <p className="text-xs text-vault-muted">Grenzen: 100.000 Dateien, 64 GiB je Datei, 2 TiB je Prüflauf, 30 Minuten je Datei. Ergebnisse beschreiben den Inhalt zum Prüfzeitpunkt.</p>
      {loading && <p className="text-sm text-vault-muted">Bestand und DAT-Quellen werden geladen…</p>}
      {!loading && totalFiles === 0 && <p className="text-sm text-vault-muted">Keine bestätigten ROM-Dateien vorhanden. Erfasse zuerst die ROM-Wurzeln dieses Geräts mit einem Scan.</p>}
      {history.length > 0 && <div><label htmlFor={`${prefix}-history`} className="block text-sm text-vault-muted">Gespeicherter Prüflauf</label><select id={`${prefix}-history`} value={jobId} onChange={(event) => { selectedJob.current = event.target.value; setSnapshot(null); setCancelling(false); setJobId(event.target.value); }} className="w-full bg-vault-bg border border-vault-border rounded-lg px-3 py-2 text-sm">
        {history.map((entry) => <option key={entry.id} value={entry.id}>{new Date(String(entry.createdAt)).toLocaleString()} · {entry.checked}/{entry.total} Dateien · {entry.sourceName ?? "ohne DAT"}</option>)}
      </select>{historyCursor && <button type="button" onClick={moreHistory} className="btn-secondary mt-2">Ältere Prüfläufe laden</button>}</div>}
      {job && <div><progress aria-label="Prüffortschritt" max={100} value={job.progress} className="w-full" /><p role="status" className="text-sm text-vault-muted">{jobText}</p>{job.sourceName && <p className="text-xs text-vault-muted">Prüfquelle: {job.sourceName}</p>}</div>}
      {job && <button type="button" onClick={() => { setError(""); setPollVersion((previous) => previous + 1); }} className="btn-secondary">Ergebnisse aktualisieren</button>}
      {message && <p role="status" className="text-sm text-vault-muted">{message}</p>}
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      {!!snapshot?.results.length && <ul className="space-y-3">{snapshot.results.map((result) => <li key={result.id} className="rounded-lg border border-vault-border p-3 space-y-1">
        <p className="text-sm break-all">{result.path}</p>
        <p className={`text-sm font-semibold ${result.status === "verified" ? "text-green-400" : result.status === "mismatch" ? "text-red-400" : "text-amber-400"}`}>{statuses[result.status] ?? result.status}</p>
        {result.stale && <p className="text-xs text-vault-muted">Das gespeicherte Ergebnis stimmt nicht mehr mit dem aktuellen Manifest überein. Bitte erneut scannen und prüfen.</p>}
        {result.fingerprint.sha256 && <p className="font-mono text-xs text-vault-muted break-all">SHA-256: {result.fingerprint.sha256} · {result.fingerprint.size} Bytes</p>}
        {result.fingerprint.sha256 && <details className="text-xs text-vault-muted"><summary className="cursor-pointer">Alle Prüfsummen vergleichen</summary><dl className="font-mono break-all">{(["crc32", "md5", "sha1", "sha256"] as const).map((key) => <div key={key}><dt>{key.toUpperCase()}</dt><dd>{result.fingerprint[key] ?? "–"}{result.expectedRom?.[key] ? ` · erwartet: ${result.expectedRom[key]}` : ""}</dd></div>)}</dl></details>}
        {result.duplicateCount > 1 && <p className="text-sm text-amber-400">{result.duplicateCount} inhaltgleiche Dateien in diesem Prüflauf (gleiche Größe und SHA-256).</p>}
        {result.expectedRom && <p className="text-xs text-vault-muted">Erwartete Revision: {result.expectedRom.gameName} · {result.expectedRom.name}</p>}
        {result.sourceName && <p className="text-xs text-vault-muted">DAT-Quelle: {result.sourceName}</p>}
        {result.matchCount > 0 && <div className="text-xs text-vault-muted"><p>{result.matchCount} bekannte DAT-Einträge und Revisionen:</p><ul>{result.matches.map((rom, index) => <li key={`${rom.gameName}:${rom.name}:${index}`}>{rom.gameName} · {rom.name}</li>)}</ul>{result.matchCount > result.matches.length && <p>Weitere Einträge findest du über die Suche in dieser DAT-Quelle.</p>}</div>}
      </li>)}</ul>}
      {snapshot?.nextCursor && <button type="button" disabled={running} onClick={loadMoreResults} className="btn-secondary disabled:opacity-50">Weitere Prüfergebnisse laden</button>}
    </section>
  );
}
