"use client";

import { useState, useEffect, useCallback } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";

interface SyncItem {
  id: number;
  type: "rename" | "delete";
  filePath: string;
  newPath: string | null;
  status: string;
  error: string | null;
  device: { id: number; name: string };
  game: { id: number; title: string; platform: string };
}

interface ApplyResult {
  applied: number;
  failed: number;
  orphansRemoved: number;
  results: { id: number; status: string; error?: string }[];
}

export function SyncPanel() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<SyncItem[]>([]);
  const [count, setCount] = useState(0);
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<ApplyResult | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const loadQueue = useCallback(async () => {
    try {
      const res = await fetch("/api/sync/queue");
      if (res.ok) {
        const data = await res.json();
        setItems(data.items);
        setCount(data.count);
      }
    } catch (err) {
      console.error("Failed to load sync queue:", err);
    }
  }, []);

  // Poll for queue updates every 5 seconds
  useEffect(() => {
    loadQueue();
    const interval = setInterval(loadQueue, 5000);
    return () => clearInterval(interval);
  }, [loadQueue]);

  // Reload when panel opens
  useEffect(() => {
    if (open) loadQueue();
  }, [open, loadQueue]);

  async function removeItem(id: number) {
    try {
      await fetch(`/api/sync/queue/${id}`, { method: "DELETE" });
      await loadQueue();
    } catch (err) {
      console.error("Failed to remove item:", err);
    }
  }

  async function clearAll() {
    try {
      await fetch("/api/sync/queue", { method: "DELETE" });
      setConfirmClear(false);
      await loadQueue();
    } catch (err) {
      console.error("Failed to clear queue:", err);
    }
  }

  async function applyAll() {
    setApplying(true);
    setApplyResult(null);
    try {
      const res = await fetch("/api/sync/apply", { method: "POST" });
      if (res.ok) {
        const result: ApplyResult = await res.json();
        setApplyResult(result);
        await loadQueue();
      } else {
        const data = await res.json();
        console.error("Apply failed:", data.error);
      }
    } catch (err) {
      console.error("Apply failed:", err);
    } finally {
      setApplying(false);
    }
  }

  // Group items by device
  const byDevice = new Map<number, { name: string; items: SyncItem[] }>();
  for (const item of items) {
    const group = byDevice.get(item.device.id) || {
      name: item.device.name,
      items: [],
    };
    group.items.push(item);
    byDevice.set(item.device.id, group);
  }

  const fileName = (path: string) => path.split("/").pop() || path;

  return (
    <>
      {/* Badge button */}
      <button
        onClick={() => setOpen(true)}
        className="relative flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-vault-border text-vault-muted hover:text-vault-text hover:border-vault-muted transition-colors"
        title="Sync Queue"
      >
        <span>&#8635;</span>
        <span>Sync</span>
        {count > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-vault-amber text-vault-bg text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {count}
          </span>
        )}
      </button>

      {/* Drawer overlay */}
      {open && (
        <div className="fixed inset-0 z-50" onClick={() => setOpen(false)}>
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

          {/* Drawer panel */}
          <div
            className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-vault-surface border-l border-vault-border shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-vault-border">
              <h2 className="font-heading font-semibold">
                Pending Changes{" "}
                {count > 0 && (
                  <span className="text-vault-amber">({count})</span>
                )}
              </h2>
              <div className="flex items-center gap-2">
                {count > 0 && (
                  <button
                    onClick={() => setConfirmClear(true)}
                    className="text-xs text-vault-muted hover:text-red-400 transition-colors"
                  >
                    Clear All
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="text-vault-muted hover:text-vault-text transition-colors text-lg"
                >
                  &#10005;
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5">
              {items.length === 0 && !applyResult && (
                <p className="text-vault-muted text-sm text-center py-8">
                  No pending changes. Use Rename/Delete on game pages to stage
                  changes.
                </p>
              )}

              {applyResult && (
                <div className="mb-4 p-3 rounded-lg border border-vault-border bg-vault-bg">
                  <p className="text-sm font-medium">
                    <span className="text-green-400">
                      {applyResult.applied} applied
                    </span>
                    {applyResult.failed > 0 && (
                      <>
                        {", "}
                        <span className="text-red-400">
                          {applyResult.failed} failed
                        </span>
                      </>
                    )}
                    {applyResult.orphansRemoved > 0 && (
                      <span className="text-vault-muted text-xs ml-2">
                        ({applyResult.orphansRemoved} orphaned games removed)
                      </span>
                    )}
                  </p>
                </div>
              )}

              <div className="space-y-4">
                {Array.from(byDevice.entries()).map(([deviceId, group]) => (
                  <div key={deviceId}>
                    <h3 className="text-sm font-semibold text-vault-text mb-2">
                      {group.name}
                    </h3>
                    <div className="space-y-1.5">
                      {group.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-start gap-2 py-1.5 px-2 rounded bg-vault-bg/50 group"
                        >
                          <span
                            className={`text-xs mt-0.5 ${item.type === "delete" ? "text-red-400" : "text-vault-amber"}`}
                          >
                            {item.type === "delete" ? "\u2715" : "\u21BB"}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-vault-muted">
                              {item.type === "delete" ? "Delete" : "Rename"}:{" "}
                              <span className="text-vault-text">
                                {fileName(item.filePath)}
                              </span>
                            </p>
                            {item.type === "rename" && item.newPath && (
                              <p className="text-xs text-vault-amber">
                                &#8594; {fileName(item.newPath)}
                              </p>
                            )}
                            <p className="text-[10px] text-vault-muted/60">
                              {item.game.title}
                            </p>
                            {item.error && (
                              <p className="text-[10px] text-red-400 mt-0.5">
                                {item.error}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => removeItem(item.id)}
                            className="text-vault-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all text-xs"
                            title="Remove from queue"
                          >
                            &#10005;
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            {count > 0 && (
              <div className="px-5 py-4 border-t border-vault-border">
                <button
                  onClick={applyAll}
                  disabled={applying}
                  className="w-full py-2.5 text-sm font-medium rounded-lg bg-vault-amber/20 text-vault-amber border border-vault-amber/30 hover:bg-vault-amber/30 transition-colors disabled:opacity-50"
                >
                  {applying ? "Applying..." : "Apply All Changes"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmClear}
        title="Clear Queue"
        message="Remove all pending changes without applying them?"
        confirmLabel="Clear All"
        confirmVariant="warning"
        onConfirm={clearAll}
        onCancel={() => setConfirmClear(false)}
      />
    </>
  );
}
