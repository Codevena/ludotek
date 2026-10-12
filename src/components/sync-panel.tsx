"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback, useRef } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FilePlanPanel } from "@/components/file-plan-panel";
import type { FilePlanView } from "@/lib/file-plans";

interface SyncItem {
  id: number; type: "rename" | "delete"; filePath: string; newPath: string | null; status: string; error: string | null;
  planId: string | null; plan: FilePlanView | null; canApply: boolean; canRemove: boolean;
  device: { id: number; name: string }; game: { id: number; title: string; platform: string };
}
interface ApplyResult {
  applied: number; failed: number; ignored: number;
  results: { id: number; status: string; error?: string; planId?: string; plan?: FilePlanView }[];
}
async function checkedJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Die Sync-Vorschau konnte nicht verarbeitet werden.");
  return data;
}

export function SyncPanel() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<SyncItem[]>([]);
  const [count, setCount] = useState(0);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<ApplyResult | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<FilePlanView | null>(null);
  const [error, setError] = useState("");
  const alive = useRef(true);
  const loadGeneration = useRef(0);
  const invalidateLoads = useCallback(() => { loadGeneration.current++; }, []);

  const loadQueue = useCallback(async () => {
    const generation = ++loadGeneration.current;
    try {
      const data = await checkedJson("/api/sync/queue");
      if (alive.current && generation === loadGeneration.current) {
        setItems(data.items ?? []); setCount(data.count ?? 0); setNextCursor(data.nextCursor ?? null);
      }
    } catch (failure) { if (alive.current && generation === loadGeneration.current) setError(failure instanceof Error ? failure.message : "Sync-Vorschau konnte nicht geladen werden."); }
  }, []);
  useEffect(() => { alive.current = true; void loadQueue(); return () => { alive.current = false; invalidateLoads(); }; }, [loadQueue, invalidateLoads]);
  useEffect(() => { if (open) void loadQueue(); }, [open, loadQueue]);
  useEffect(() => { const timer = setInterval(() => { void loadQueue(); }, count > 0 || open ? 5000 : 30000); return () => clearInterval(timer); }, [loadQueue, count, open]);

  async function remove(ids: number[]) {
    setError("");
    try {
      await checkedJson("/api/sync/queue", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
      if (alive.current) { setConfirmClear(false); await loadQueue(); }
    } catch (failure) { if (alive.current) setError(failure instanceof Error ? failure.message : "Vorschau konnte nicht entfernt werden."); }
  }
  async function applyAll() {
    const ids = items.filter((item) => item.canApply).slice(0, 100).map((item) => item.id);
    if (!ids.length || applying) return;
    setApplying(true); setApplyResult(null); setError("");
    try {
      const result = await checkedJson("/api/sync/apply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) }) as ApplyResult;
      if (alive.current) {
        setApplyResult(result);
        setSelectedPlan(result.results.find((entry) => entry.plan)?.plan ?? null);
        await loadQueue(); router.refresh();
      }
    } catch (failure) { if (alive.current) setError(failure instanceof Error ? failure.message : "Sync wurde nicht abgeschlossen; den gespeicherten Dateiplan prüfen."); }
    finally { if (alive.current) setApplying(false); }
  }
  async function more() {
    if (!nextCursor) return;
    try {
      const data = await checkedJson("/api/sync/queue?afterId=" + nextCursor);
      if (alive.current) { setItems((previous) => [...previous, ...(data.items as SyncItem[]).filter((entry) => !previous.some((old) => old.id === entry.id))]); setNextCursor(data.nextCursor ?? null); }
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Weitere Einträge konnten nicht geladen werden."); }
  }
  const applicable = items.filter((item) => item.canApply);
  const removable = items.filter((item) => item.canRemove).slice(0, 100);
  return <>
    <button type="button" onClick={() => setOpen(true)} title="Sync Queue" className="relative flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-vault-border text-vault-muted hover:text-vault-text">
      <span>↻</span><span>Sync</span>{count > 0 && <span className="bg-vault-amber text-vault-bg text-xs rounded-full px-1.5">{count}</span>}
    </button>
    {open && <div className="fixed inset-0 z-50" onClick={() => { setOpen(false); setSelectedPlan(null); }}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div role="dialog" aria-modal="true" aria-label="Gespeicherte Sync-Vorschauen" className="absolute right-0 top-0 bottom-0 w-full max-w-xl bg-vault-surface border-l border-vault-border shadow-2xl flex flex-col" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-vault-border">
          <h2 className="font-heading font-semibold">Sync-Vorschauen ({count})</h2>
          <button type="button" aria-label="Sync schließen" onClick={() => { setOpen(false); setSelectedPlan(null); }} className="btn-secondary">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <p className="text-sm text-vault-muted">Jede Änderung besitzt einen gespeicherten Dateiplan. Vorschau und Ergebnis zeigen den tatsächlichen Gerätepfad; Löschen bewahrt Dateien in Quarantäne.</p>
          {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
          {applyResult && <div role="status" className="text-sm"><span className="text-green-400">{applyResult.applied} bestätigt abgeschlossen</span> · <span className="text-red-400">{applyResult.failed} fehlgeschlagen oder prüfbedürftig</span> · {applyResult.ignored} unverändert</div>}
          {applyResult?.results.filter((result) => result.error).map((result) => <p key={result.id} className="text-sm text-red-400">{result.error}{result.planId && <> · <Link className="underline" href={`/files?plan=${encodeURIComponent(result.planId)}`}>Journal und Wiederherstellung öffnen</Link></>}</p>)}
          {items.length === 0 && <p className="text-sm text-vault-muted">Keine offenen Vorschauen. Auf einer Spielseite eine bestätigte Datei auswählen und eine Änderung vorbereiten.</p>}
          {items.map((item) => <article key={item.id} className="rounded-lg border border-vault-border p-3 space-y-2">
            <p className="text-sm font-semibold">{item.device.name} · {item.game.title}</p>
            <p className="text-xs font-mono break-all text-vault-muted">{item.filePath}</p>
            {item.newPath && <p className="text-xs font-mono break-all text-vault-amber">→ {item.newPath}</p>}
            <p className="text-xs text-vault-muted">{item.type === "delete" ? "In Quarantäne verschieben" : "Umbenennen"} · {item.status === "review_required" ? "Erneuter Scan und neue Vorschau nötig" : item.status === "metadata_pending" || item.status === "metadata_failed" ? "Dateiplan abgeschlossen; Queue-Metadaten müssen bestätigt werden" : item.status === "in_progress" ? "Queue-Eintrag beansprucht; Journalstatus prüfen" : item.plan?.status ?? item.status}</p>
            {item.error && <p className="text-xs text-red-400">{item.error}</p>}
            <div className="flex gap-2 flex-wrap">
              {item.plan && <button type="button" className="btn-secondary" onClick={() => setSelectedPlan(item.plan)}>Vorschau und Ergebnis prüfen</button>}
              {item.planId && <Link className="text-sm text-vault-amber underline" href={`/files?plan=${encodeURIComponent(item.planId)}`}>Rücknahme / Wiederherstellung</Link>}
              {item.canRemove && <button type="button" disabled={applying} className="btn-secondary disabled:opacity-50" onClick={() => { void remove([item.id]); }}>Vorschau entfernen</button>}
            </div>
          </article>)}
          {nextCursor && <button type="button" onClick={more} className="btn-secondary">Weitere Queue-Einträge laden</button>}
          {selectedPlan && <FilePlanPanel plan={selectedPlan} onChanged={() => { void loadQueue(); router.refresh(); }} />}
        </div>
        <div className="px-5 py-4 border-t border-vault-border space-y-2">
          <button type="button" onClick={applyAll} disabled={applying || !applicable.length} className="btn-primary w-full disabled:opacity-50">{applying ? "Gespeicherte Pläne laufen…" : `${Math.min(applicable.length, 100)} angezeigte Pläne bestätigen`}</button>
          {removable.length > 0 && <button type="button" disabled={applying} onClick={() => setConfirmClear(true)} className="btn-secondary w-full">Angezeigte Vorschauen entfernen</button>}
        </div>
      </div>
    </div>}
    <ConfirmDialog open={confirmClear} title="Vorschauen entfernen" message="Diese Queue-Einträge entfernen? Die Dateien und gespeicherten Journale bleiben erhalten." confirmLabel="Vorschauen entfernen" confirmVariant="warning" onConfirm={() => { void remove(removable.map((item) => item.id)); }} onCancel={() => setConfirmClear(false)} />
  </>;
}
