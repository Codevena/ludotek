"use client";

import { useState, useEffect, useCallback } from "react";
import { ConfirmDialog, AlertDialog } from "@/components/confirm-dialog";

interface DetailedEntry {
  name: string;
  type: "dir" | "file" | "symlink";
  size: number;
  modifiedAt?: string;
  symlinkTarget?: string;
}

interface DeviceOption {
  id: number;
  name: string;
}

interface FilePanelProps {
  side: "left" | "right";
  devices: DeviceOption[];
  selectedDeviceId: number | null;
  onDeviceChange: (id: number | null) => void;
  onSelectionChange: (paths: string[], deviceId: number) => void;
  currentPath: string;
  onPathChange: (path: string) => void;
  onPreview: (deviceId: number, filePath: string) => void;
  refreshKey?: number;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "\u2014";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function FilePanel({
  side,
  devices,
  selectedDeviceId,
  onDeviceChange,
  onSelectionChange,
  currentPath,
  onPathChange,
  onPreview,
  refreshKey,
}: FilePanelProps) {
  const [entries, setEntries] = useState<DetailedEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mkdirMode, setMkdirMode] = useState(false);
  const [mkdirName, setMkdirName] = useState("");
  const [renameTarget, setRenameTarget] = useState<string | null>(null);
  const [renameName, setRenameName] = useState("");
  const [showHidden, setShowHidden] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteAlertErrors, setDeleteAlertErrors] = useState<string[] | null>(null);

  const browse = useCallback(
    async (path: string) => {
      if (!selectedDeviceId) return;
      setLoading(true);
      setError(null);
      setSelected(new Set());
      try {
        const res = await fetch(
          `/api/devices/${selectedDeviceId}/browse?path=${encodeURIComponent(path)}`,
        );
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error ?? `Browse failed (${res.status})`);
        }
        const data = await res.json();
        setEntries(data.entries ?? []);
        onPathChange(path);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to browse");
        setEntries([]);
      } finally {
        setLoading(false);
      }
    },
    [selectedDeviceId, onPathChange],
  );

  useEffect(() => {
    if (selectedDeviceId) {
      browse(currentPath);
    } else {
      setEntries([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDeviceId, refreshKey]);

  useEffect(() => {
    if (selectedDeviceId) {
      onSelectionChange(
        Array.from(selected).map((name) => {
          return currentPath === "/" ? `/${name}` : `${currentPath}/${name}`;
        }),
        selectedDeviceId,
      );
    }
  }, [selected, currentPath, selectedDeviceId, onSelectionChange]);

  const visibleEntries = showHidden
    ? entries
    : entries.filter((e) => !e.name.startsWith("."));

  function toggleSelect(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === visibleEntries.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(visibleEntries.map((e) => e.name)));
    }
  }

  function navigateToParent() {
    if (currentPath === "/") return;
    const parts = currentPath.split("/").filter(Boolean);
    parts.pop();
    browse(parts.length === 0 ? "/" : `/${parts.join("/")}`);
  }

  async function handleMkdir() {
    if (!selectedDeviceId || !mkdirName.trim()) return;
    const newPath =
      currentPath === "/"
        ? `/${mkdirName.trim()}`
        : `${currentPath}/${mkdirName.trim()}`;
    try {
      const res = await fetch(
        `/api/devices/${selectedDeviceId}/files/mkdir`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: newPath }),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "mkdir failed");
      }
      setMkdirMode(false);
      setMkdirName("");
      browse(currentPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "mkdir failed");
    }
  }

  async function handleRename() {
    if (!selectedDeviceId || !renameTarget || !renameName.trim()) return;
    const oldPath =
      currentPath === "/"
        ? `/${renameTarget}`
        : `${currentPath}/${renameTarget}`;
    const newPath =
      currentPath === "/"
        ? `/${renameName.trim()}`
        : `${currentPath}/${renameName.trim()}`;
    try {
      const res = await fetch(
        `/api/devices/${selectedDeviceId}/files/rename`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ oldPath, newPath }),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "rename failed");
      }
      setRenameTarget(null);
      setRenameName("");
      browse(currentPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "rename failed");
    }
  }

  function handleDelete() {
    if (!selectedDeviceId || selected.size === 0) return;
    setDeleteConfirm(true);
  }

  async function doDelete() {
    if (!selectedDeviceId || selected.size === 0) return;
    const names = Array.from(selected);
    const paths = names.map((name) =>
      currentPath === "/" ? `/${name}` : `${currentPath}/${name}`,
    );
    try {
      const res = await fetch(`/api/devices/${selectedDeviceId}/files`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paths }),
      });
      if (res.status === 207) {
        const data = await res.json().catch(() => null);
        const errors: string[] = data?.errors ?? ["Some files could not be deleted"];
        setDeleteAlertErrors(errors);
      } else if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "delete failed");
      }
      setSelected(new Set());
      browse(currentPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "delete failed");
    }
  }

  const selectedCount = selected.size;
  const selectedSize = visibleEntries
    .filter((e) => selected.has(e.name))
    .reduce((sum, e) => sum + e.size, 0);

  return (
    <div data-side={side} className="flex flex-col rounded-xl border border-vault-border bg-vault-surface overflow-hidden min-h-[500px]">
      {/* Device selector */}
      <div className="px-3 py-2 border-b border-vault-border bg-vault-bg">
        <select
          value={selectedDeviceId ?? ""}
          onChange={(e) =>
            onDeviceChange(e.target.value ? Number(e.target.value) : null)
          }
          className="w-full bg-vault-surface border border-vault-border rounded-lg px-2 py-1.5 text-sm text-vault-text focus:outline-none focus:border-vault-amber/50"
        >
          <option value="">Select device...</option>
          {devices.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      {/* Path bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-vault-border bg-vault-bg">
        <button
          type="button"
          onClick={navigateToParent}
          disabled={currentPath === "/" || !selectedDeviceId}
          className="px-2 py-1 text-sm rounded border border-vault-border text-vault-muted hover:border-vault-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title="Go to parent"
        >
          &larr;
        </button>
        <button
          type="button"
          onClick={() => browse("/")}
          disabled={currentPath === "/" || !selectedDeviceId}
          className="px-2 py-1 text-sm rounded border border-vault-border text-vault-muted hover:border-vault-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title="Go to root"
        >
          /
        </button>
        <span
          className="text-sm text-vault-text truncate flex-1"
          title={currentPath}
        >
          {currentPath}
        </span>
        <button
          type="button"
          onClick={() => setShowHidden((v) => !v)}
          className={`px-2 py-1 text-xs rounded border transition-colors ${
            showHidden
              ? "border-vault-amber/50 text-vault-amber bg-vault-amber/10"
              : "border-vault-border text-vault-muted hover:border-vault-muted"
          }`}
          title={showHidden ? "Hide hidden files" : "Show hidden files"}
        >
          .*
        </button>
      </div>

      {/* Select All header */}
      {selectedDeviceId && visibleEntries.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-vault-border/50 bg-vault-bg/50">
          <input
            type="checkbox"
            checked={selected.size === visibleEntries.length && visibleEntries.length > 0}
            onChange={toggleSelectAll}
            className="accent-vault-amber"
          />
          <span className="text-xs text-vault-muted">
            {selectedCount > 0
              ? `${selectedCount} selected (${formatSize(selectedSize)})`
              : "Select all"}
          </span>
        </div>
      )}

      {/* File list */}
      <div className="flex-1 overflow-y-auto max-h-[400px]">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="h-5 w-5 border-2 border-vault-amber border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && error && (
          <div className="px-4 py-6 text-center text-sm text-red-400">
            {error}
          </div>
        )}

        {!loading && !error && !selectedDeviceId && (
          <div className="px-4 py-6 text-center text-sm text-vault-muted">
            Select a device to browse files
          </div>
        )}

        {!loading && !error && selectedDeviceId && visibleEntries.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-vault-muted">
            Empty directory
          </div>
        )}

        {/* Inline mkdir input */}
        {mkdirMode && (
          <div className="flex items-center gap-2 px-3 py-2 border-b border-vault-border/50 bg-vault-amber/5">
            <span>{"\uD83D\uDCC1"}</span>
            <input
              autoFocus
              value={mkdirName}
              onChange={(e) => setMkdirName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleMkdir();
                if (e.key === "Escape") {
                  setMkdirMode(false);
                  setMkdirName("");
                }
              }}
              placeholder="Folder name..."
              className="flex-1 bg-transparent border-b border-vault-amber/50 text-sm text-vault-text focus:outline-none"
            />
          </div>
        )}

        {!loading &&
          !error &&
          visibleEntries.map((entry) => (
            <div
              key={entry.name}
              className="flex items-center gap-2 px-3 py-2 text-sm border-b border-vault-border/50 last:border-b-0 hover:bg-vault-amber/5"
            >
              <input
                type="checkbox"
                checked={selected.has(entry.name)}
                onChange={() => toggleSelect(entry.name)}
                className="accent-vault-amber"
              />
              <span>{entry.type === "dir" ? "\uD83D\uDCC1" : entry.type === "symlink" ? "\uD83D\uDD17" : "\uD83D\uDCC4"}</span>
              {renameTarget === entry.name ? (
                <input
                  autoFocus
                  value={renameName}
                  onChange={(e) => setRenameName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRename();
                    if (e.key === "Escape") {
                      setRenameTarget(null);
                      setRenameName("");
                    }
                  }}
                  className="flex-1 bg-transparent border-b border-vault-amber/50 text-sm text-vault-text focus:outline-none"
                />
              ) : (
                <span
                  className={`truncate flex-1 ${
                    entry.type === "dir" || entry.type === "symlink"
                      ? "cursor-pointer text-vault-text hover:text-vault-amber"
                      : "cursor-pointer text-vault-muted hover:text-vault-text"
                  }`}
                  onClick={() => {
                    if (entry.type === "dir" || entry.type === "symlink") {
                      const nextPath =
                        currentPath === "/"
                          ? `/${entry.name}`
                          : `${currentPath}/${entry.name}`;
                      browse(nextPath);
                    } else if (selectedDeviceId) {
                      const filePath =
                        currentPath === "/"
                          ? `/${entry.name}`
                          : `${currentPath}/${entry.name}`;
                      onPreview(selectedDeviceId, filePath);
                    }
                  }}
                >
                  {entry.name}
                </span>
              )}
              <span className="text-xs text-vault-muted whitespace-nowrap">
                {entry.type === "dir"
                  ? "\u2014"
                  : entry.type === "symlink"
                    ? entry.symlinkTarget
                      ? `\u2192 ${entry.symlinkTarget}`
                      : "\u{1F517}"
                    : formatSize(entry.size)}
              </span>
            </div>
          ))}
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-t border-vault-border bg-vault-bg">
        <button
          type="button"
          onClick={() => {
            setMkdirMode(true);
            setMkdirName("");
          }}
          disabled={!selectedDeviceId}
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-vault-surface border border-vault-border text-vault-muted hover:text-vault-text hover:border-vault-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          New Folder
        </button>
        <button
          type="button"
          onClick={() => {
            if (selectedCount === 1) {
              const name = Array.from(selected)[0];
              setRenameTarget(name);
              setRenameName(name);
            }
          }}
          disabled={selectedCount !== 1}
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-vault-surface border border-vault-border text-vault-muted hover:text-vault-text hover:border-vault-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Rename
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={selectedCount === 0}
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Delete
        </button>
      </div>

      <ConfirmDialog
        open={deleteConfirm}
        title="Delete Items"
        message={`Delete ${selectedCount} item${selectedCount > 1 ? "s" : ""}? This cannot be undone.`}
        items={Array.from(selected)}
        confirmLabel="Delete"
        confirmVariant="danger"
        onConfirm={() => {
          setDeleteConfirm(false);
          doDelete();
        }}
        onCancel={() => setDeleteConfirm(false)}
      />
      <AlertDialog
        open={deleteAlertErrors !== null}
        title="Delete Errors"
        message="Some items could not be deleted:"
        items={deleteAlertErrors ?? []}
        onClose={() => setDeleteAlertErrors(null)}
      />
    </div>
  );
}
