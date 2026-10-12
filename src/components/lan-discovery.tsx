"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LanInterfaceChoice, LanResult, LanSelection } from "@/lib/lan-discovery";

export function LanDiscovery({ onSelect }: { onSelect: (selection: LanSelection) => void }) {
  const [interfaces, setInterfaces] = useState<LanInterfaceChoice[]>([]);
  const [interfaceId, setInterfaceId] = useState("");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<LanResult[]>([]);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const selected = interfaces.find((choice) => choice.id === interfaceId);
  const stopCurrent = useCallback(() => { generation.current++; controller.current?.abort(); }, []);

  useEffect(() => {
    const lookup = new AbortController();
    let mounted = true;
    void (async () => {
      try {
        const response = await fetch("/api/devices/discovery", { signal: lookup.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Netzwerkschnittstellen konnten nicht geladen werden.");
        if (mounted) setInterfaces(data.interfaces ?? []);
      } catch (failure) {
        if (mounted) setError(failure instanceof Error ? failure.message : "Netzwerkschnittstellen konnten nicht geladen werden.");
      } finally { if (mounted) setLoading(false); }
    })();
    return () => { mounted = false; lookup.abort(); stopCurrent(); };
  }, [stopCurrent]);

  async function start() {
    if (!selected?.available || running) return;
    const token = ++generation.current;
    const active = new AbortController();
    controller.current = active;
    setRunning(true); setResults([]); setMessage(""); setError(""); setProgress({ completed: 0, total: selected.hostCount * 2 });
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    let done = false;
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; active.abort(); }, 55000);
    const current = () => generation.current === token;
    try {
      const response = await fetch("/api/devices/discovery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ interfaceId }), signal: active.signal });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Die LAN-Suche konnte nicht gestartet werden.");
      }
      if (!response.body || !response.headers.get("Content-Type")?.startsWith("text/event-stream")) throw new Error("Ungültige Antwort der LAN-Suche.");
      reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let bytes = 0;
      while (!active.signal.aborted) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > 256 * 1024) throw new Error("Antwort der LAN-Suche zu groß.");
        buffer += decoder.decode(chunk.value, { stream: true });
        let boundary: number;
        while ((boundary = buffer.indexOf("\n\n")) >= 0) {
          const block = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          if (!block.startsWith("data: ")) continue;
          const event = JSON.parse(block.slice(6));
          if (!current()) continue;
          if (event.type === "result" && event.result) {
            const result = event.result as LanResult;
            if (typeof result.host !== "string" || ![21, 22].includes(result.port) || !["ssh", "ftp"].includes(result.protocol)) throw new Error("Ungültiges Suchergebnis.");
            setResults((previous) => previous.some((item) => item.host === result.host && item.port === result.port) ? previous : [...previous, result]);
          }
          if (event.type === "progress" || event.type === "done") {
            if (!Number.isSafeInteger(event.completed) || !Number.isSafeInteger(event.total) || event.completed < 0 || event.completed > event.total || event.total > 512) throw new Error("Ungültiger Suchfortschritt.");
            setProgress({ completed: event.completed, total: event.total });
          }
          if (event.type === "done") {
            done = true;
            setMessage(event.stopped ? event.reason || "Suche abgebrochen." : `Suche abgeschlossen: ${event.completed}/${event.total} Verbindungen geprüft.`);
          }
          if (event.type === "error") throw new Error(event.error || "Die Suche wurde unterbrochen.");
        }
        if (buffer.length > 16384) throw new Error("Ungültige Antwort der LAN-Suche.");
      }
      if (active.signal.aborted) throw new DOMException("Aborted", "AbortError");
      if (!done) throw new Error("Die Suche wurde vor Abschluss unterbrochen.");
    } catch (failure) {
      if (current()) {
        if (active.signal.aborted) setMessage(timedOut ? "Zeitlimit der LAN-Suche erreicht." : "Suche abgebrochen.");
        else setError(failure instanceof Error ? failure.message : "Die LAN-Suche wurde unterbrochen.");
      }
    } finally {
      clearTimeout(timer);
      try { await reader?.cancel(); } catch { /* A cancelled response may already have errored. */ }
      reader?.releaseLock();
      if (current()) { controller.current = null; setRunning(false); }
    }
  }

  return (
    <section className="card space-y-4" aria-labelledby="lan-discovery-title">
      <h2 id="lan-discovery-title" className="font-heading text-lg font-bold">Geräte im eigenen LAN finden</h2>
      <p className="text-sm text-vault-muted">Wähle ein privates Subnetz dieses Ludotek-Servers und starte die Suche ausdrücklich. Geprüft werden nur SSH (22) und FTP (21), ohne Anmeldeversuche. Ein offener Port bestätigt kein Gerätemodell.</p>
      {loading ? <p className="text-sm text-vault-muted">Netzwerkschnittstellen werden geladen…</p> : (
        <>
          <label htmlFor="lan-interface" className="block text-sm text-vault-muted">Privates lokales Subnetz</label>
          <select id="lan-interface" value={interfaceId} disabled={running} onChange={(event) => setInterfaceId(event.target.value)} className="w-full bg-vault-bg border border-vault-border rounded-lg px-3 py-2 text-sm">
            <option value="">Bitte auswählen</option>
            {interfaces.map((choice) => <option key={choice.id} value={choice.id} disabled={!choice.available}>{choice.name} · {choice.subnet ?? choice.address} · {choice.family}{choice.available ? ` · ${choice.hostCount} Hosts` : " · nicht verfügbar"}</option>)}
          </select>
          {interfaces.length === 0 && <p className="text-sm text-vault-muted">Keine geeignete private Netzwerkschnittstelle gefunden. Du kannst Geräte weiterhin manuell hinzufügen.</p>}
          {interfaces.filter((choice) => !choice.available).map((choice) => <p key={choice.id} className="text-sm text-vault-muted">{choice.reason}</p>)}
          <div className="flex gap-3">
            <button type="button" disabled={!selected?.available || running} onClick={start} className="btn-primary disabled:opacity-50">LAN-Suche starten</button>
            {running && <button type="button" onClick={() => controller.current?.abort()} className="btn-secondary">Suche abbrechen</button>}
          </div>
        </>
      )}
      {progress.total > 0 && <p aria-live="polite" className="text-sm text-vault-muted">{progress.completed}/{progress.total} Verbindungen geprüft.</p>}
      {message && <p role="status" className="text-sm text-vault-muted">{message}</p>}
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      {results.length > 0 && <ul className="space-y-3">{results.map((result) => (
        <li key={`${result.host}:${result.port}`} className="border border-vault-border rounded-lg p-3">
          <p className="text-sm font-medium break-all">{result.host} · {result.protocol.toUpperCase()}:{result.port}</p>
          <p className="text-sm text-vault-muted mt-1">{result.hint}</p>
          <button type="button" onClick={() => onSelect({ host: result.host, port: result.port, protocol: result.protocol, type: "custom" })} aria-label={`${result.host} als Gerät vorbereiten`} className="text-sm text-vault-amber hover:text-vault-amber-hover mt-2">Als Gerät vorbereiten</button>
        </li>
      ))}</ul>}
      <p className="text-xs text-vault-muted">Die Auswahl füllt den Geräte-Dialog. Erst dein ausdrückliches Speichern legt das Gerät an.</p>
    </section>
  );
}
