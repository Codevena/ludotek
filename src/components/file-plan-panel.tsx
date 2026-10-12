"use client";

import { useEffect, useRef, useState } from "react";
import type { FilePlanView } from "@/lib/file-plans";

const STATUS: Record<string, string> = { ready: "Vorbereitet", applying: "Wird ausgeführt", applied: "Abgeschlossen", undone: "Zurückgenommen",
  undoing: "Wird zurückgenommen", compensated: "Änderungen zurückgenommen", recovery_needed: "Wiederherstellung nötig", recovery_conflict: "Wiederherstellungskonflikt",
  failed: "Fehlgeschlagen", cancelled: "Abgebrochen", undo_conflict: "Konflikt beim Zurücknehmen", rolling_back: "Änderungen werden zurückgenommen", rolled_back: "Änderungen zurückgenommen" };
const KINDS: Record<string, string> = { copy: "Kopieren", move: "Verschieben", rename: "Umbenennen", delete: "In Quarantäne verschieben", mkdir: "Ordner erstellen", upload: "Upload", save_restore: "Save wiederherstellen", rewrite: "Referenzen aktualisieren", descriptor: "Referenzen aktualisieren" };
function validView(value: unknown): value is FilePlanView {
  if (!value || typeof value !== "object") return false;
  const plan = value as FilePlanView;
  return typeof plan.id === "string" && typeof plan.status === "string" && typeof plan.kind === "string" &&
    typeof plan.totalBytes === "string" && /^\d+$/.test(plan.totalBytes) && Array.isArray(plan.operations) && plan.operations.length <= 100;
}

export function FilePlanPanel({ plan, onChanged }: { plan: FilePlanView; onChanged?: (plan: FilePlanView) => void }) {
  const [current, setCurrent] = useState(plan);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const incoming = useRef(plan); incoming.current = plan;
  const planId = plan.id;
  const callback = useRef(onChanged); callback.current = onChanged;
  useEffect(() => {
    const epoch = generation;
    const pending = request;
    epoch.current++; pending.current?.abort(); pending.current = null; setCurrent(incoming.current); setBusy(false); setError("");
    return () => { epoch.current++; pending.current?.abort(); };
  }, [planId]);
  useEffect(() => { if (!request.current) setCurrent(plan); }, [plan]);

  async function reload(signal?: AbortSignal) {
    const response = await fetch(`/api/file-plans/${current.id}`, { signal, cache: "no-store" });
    const data = await response.json();
    if (!response.ok || !validView(data.plan)) throw new Error(data.error || "Planstatus konnte nicht geladen werden.");
    return data.plan;
  }

  async function act(action: "apply" | "undo" | "reconcile") {
    if (busy) return;
    const token = ++generation.current;
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setError("");
    let polling = false;
    const active = () => generation.current === token;
    const accept = (value: FilePlanView) => { if (active()) {
      setCurrent(value); callback.current?.(value);
      if (["copy", "move"].includes(value.kind) && value.status !== "ready") window.__transferBarPoll?.();
    } };
    const timer = setTimeout(() => controller.abort(), 3600000);
    const interval = setInterval(() => {
      if (polling || controller.signal.aborted) return;
      polling = true;
      void reload(controller.signal).then(accept).catch(() => {}).finally(() => { polling = false; });
    }, 1500);
    try {
      const response = await fetch(`/api/file-plans/${current.id}/${action}`, { method: "POST", signal: controller.signal });
      const data = await response.json();
      if (!response.ok || !validView(data.plan)) throw new Error(data.error || "Dateiplan konnte nicht abgeschlossen werden.");
      accept(data.plan);
    } catch (failure) {
      if (active()) {
        setError(controller.signal.aborted ? "Abbruch angefordert. Den gespeicherten Planstatus und mögliche Wiederherstellung prüfen." : failure instanceof Error ? failure.message : "Dateiplan fehlgeschlagen.");
        // A failed HTTP response may follow a real filesystem change. Read the
        // durable journal rather than reverting the UI to an untouched draft.
        try { accept(await reload()); } catch { /* Keep the last observed state. */ }
      }
    } finally {
      clearTimeout(timer); clearInterval(interval);
      if (active()) { generation.current++; request.current = null; setBusy(false); }
      controller.abort();
    }
  }

  const recovery = ["applying", "undoing", "recovery_needed", "recovery_conflict", "failed", "cancelled", "undo_conflict"].includes(current.status);
  return (
    <section className="card space-y-4" aria-labelledby={`file-plan-${current.id}`}>
      <div className="flex justify-between gap-4 flex-wrap">
        <h2 id={`file-plan-${current.id}`} className="font-heading text-lg font-bold">Dateiplan prüfen</h2>
        <p role="status" className="text-sm text-vault-amber">{STATUS[current.status] ?? current.status}</p>
      </div>
      <p className="text-sm text-vault-muted">{current.operations.length} Schritte · {Number(current.totalBytes).toLocaleString("de-DE")} Bytes. Die Vorschau verändert keine Dateien. Löschen bewahrt Dateien in der Quarantäne.</p>
      {current.warningLevel === "checked_ftp" && <div role="note" className="rounded-lg border border-vault-amber p-3 text-sm text-vault-amber">
        <p className="font-medium">FTP/FTPS: geprüfter Transfer mit begrenzter Wiederherstellung</p>
        <ul className="mt-2 list-disc pl-5 space-y-1">{current.limitations?.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul>
      </div>}
      <ol className="space-y-3">{current.operations.map((entry, index) => {
        const operation = entry as unknown as Record<string, unknown>;
        const source = typeof operation.sourcePath === "string" ? operation.sourcePath : typeof operation.filePath === "string" ? operation.filePath : "";
        const target = typeof operation.targetPath === "string" ? operation.targetPath : typeof operation.newPath === "string" ? operation.newPath : "";
        return <li key={typeof operation.id === "string" ? operation.id : index} className="border border-vault-border rounded-lg p-3">
          <p className="text-sm font-medium">{KINDS[String(operation.kind)] ?? "Dateiänderung"}{operation.descriptorRewrite || operation.rewritesDescriptor ? " · Disc-/Playlistreferenzen aktualisieren" : ""}</p>
          {source && <p className="text-xs font-mono text-vault-muted break-all mt-1">{source}</p>}
          {target && <p className="text-xs font-mono text-vault-amber break-all mt-1">→ {target}</p>}
          {typeof operation.error === "string" && operation.error && <p className="text-sm text-red-400 mt-1">{operation.error}</p>}
        </li>;
      })}</ol>
      {(error || current.error) && <p role="alert" className="text-sm text-red-400">{error || current.error}</p>}
      <div className="flex gap-3 flex-wrap">
        {!busy && current.status === "ready" && <button type="button" onClick={() => act("apply")} className="btn-primary">Plan ausführen</button>}
        {!busy && current.status === "applied" && <button type="button" onClick={() => act("undo")} className="btn-secondary">Rückgängig machen</button>}
        {!busy && recovery && <button type="button" onClick={() => act("reconcile")} className="btn-secondary">Wiederherstellung prüfen</button>}
        {busy && <><p aria-live="polite" className="text-sm text-vault-muted">Dateiplan läuft. Bestätigte Ergebnisse werden aus dem Journal geladen.</p><button type="button" onClick={() => request.current?.abort()} className="btn-secondary">Ausführung abbrechen</button></>}
      </div>
      <p className="text-xs text-vault-muted">{current.warningLevel === "checked_ftp" ? "FTP/FTPS hält erkennbare Inhaltsänderungen und unklare Serverantworten als Konflikt an. Rücknahme ist nur ohne gleichzeitige externe Schreibzugriffe möglich; identische fremde Ersetzungen sind nicht unterscheidbar." : "Bei fremden Änderungen wird Rücknahme oder Wiederherstellung als Konflikt angehalten."} Gesicherte Dateien bleiben erhalten.</p>
    </section>
  );
}

export function FilePlanHistory({ onChanged }: { onChanged?: (plan: FilePlanView) => void }) {
  const [plans, setPlans] = useState<Array<{ id: string; kind: string; status: string }>>([]);
  const [selected, setSelected] = useState<FilePlanView | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const detailController = useRef<AbortController | null>(null);
  async function load(before?: string) {
    if (busy) return; setBusy(true); setError("");
    const active = new AbortController(); controller.current?.abort(); controller.current = active;
    try {
      const response = await fetch(`/api/file-plans${before ? `?before=${encodeURIComponent(before)}` : ""}`, { signal: active.signal, cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.plans)) throw new Error(data.error || "Dateipläne konnten nicht geladen werden.");
      if (active.signal.aborted) return;
      setPlans((previous) => before ? [...previous, ...data.plans] : data.plans); setNextCursor(data.nextCursor ?? null);
    } catch (failure) { if (!active.signal.aborted) setError(failure instanceof Error ? failure.message : "Dateipläne konnten nicht geladen werden."); }
    finally { if (controller.current === active) setBusy(false); }
  }
  async function select(id: string) {
    const active = new AbortController(); detailController.current?.abort(); detailController.current = active;
    setError("");
    try {
      const response = await fetch(`/api/file-plans/${encodeURIComponent(id)}`, { signal: active.signal, cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !validView(data.plan)) throw new Error(data.error || "Dateiplan konnte nicht geladen werden.");
      if (!active.signal.aborted) setSelected(data.plan);
    } catch (failure) { if (!active.signal.aborted) setError(failure instanceof Error ? failure.message : "Dateiplan konnte nicht geladen werden."); }
  }
  useEffect(() => {
    void load();
    const query = new URLSearchParams(window.location.search);
    const id = query.get("plan") ?? query.get("planId");
    if (id && /^[0-9a-f-]{36}$/i.test(id)) void select(id);
    return () => { controller.current?.abort(); detailController.current?.abort(); };
    // History entry runs once; actions below explicitly refresh/select it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <div className="space-y-4">
    <div className="flex items-center gap-3"><h2 className="font-heading text-lg font-bold">Gespeicherte Dateipläne</h2><button type="button" disabled={busy} onClick={() => load()} className="btn-secondary">Aktualisieren</button></div>
    {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
    <ul className="space-y-2">{plans.map((plan) => <li key={plan.id}><button type="button" onClick={() => select(plan.id)} className="text-sm text-vault-amber">{KINDS[plan.kind] ?? plan.kind} · {STATUS[plan.status] ?? plan.status} · {plan.id.slice(0, 8)}</button></li>)}</ul>
    {nextCursor && <button type="button" disabled={busy} onClick={() => load(nextCursor)} className="btn-secondary">Weitere Pläne</button>}
    {selected && <FilePlanPanel plan={selected} onChanged={(plan) => { setPlans((previous) => previous.map((entry) => entry.id === plan.id ? { ...entry, status: plan.status } : entry)); onChanged?.(plan); }} />}
  </div>;
}
