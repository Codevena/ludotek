"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";

interface DeviceFile {
  deviceId: number;
  deviceName: string;
  filePath: string;
  fileName: string;
}

interface GameFilesProps {
  gameId: number;
  files: DeviceFile[];
}

export function GameFiles({ gameId, files }: GameFilesProps) {
  const [pendingDeletes, setPendingDeletes] = useState<Set<string>>(new Set());
  const [pendingRenames, setPendingRenames] = useState<Map<string, string>>(new Map());
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<DeviceFile | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  if (files.length === 0) return null;

  const fileKey = (f: DeviceFile) => `${f.deviceId}:${f.filePath}`;

  async function stageDelete(file: DeviceFile) {
    const key = fileKey(file);
    setLoading(key);
    try {
      const res = await fetch("/api/sync/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "delete",
          deviceId: file.deviceId,
          gameId,
          filePath: file.filePath,
        }),
      });
      if (res.ok) {
        setPendingDeletes((prev) => new Set(prev).add(key));
      } else {
        const data = await res.json();
        console.error("Failed to stage delete:", data.error);
      }
    } catch (err) {
      console.error("Failed to stage delete:", err);
    } finally {
      setLoading(null);
      setConfirmDelete(null);
    }
  }

  function startRename(file: DeviceFile) {
    const key = fileKey(file);
    setEditingKey(key);
    setEditValue(file.fileName);
  }

  async function stageRename(file: DeviceFile) {
    const key = fileKey(file);
    const safeName = editValue.trim();
    if (!safeName || safeName === file.fileName) {
      setEditingKey(null);
      return;
    }
    if (safeName.includes("/") || safeName.includes("\\") || safeName.includes("..")) {
      console.error("Invalid filename: must not contain path separators");
      return;
    }

    setLoading(key);
    const dir = file.filePath.substring(0, file.filePath.lastIndexOf("/"));
    const newPath = `${dir}/${safeName}`;

    try {
      const res = await fetch("/api/sync/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "rename",
          deviceId: file.deviceId,
          gameId,
          filePath: file.filePath,
          newPath,
        }),
      });
      if (res.ok) {
        setPendingRenames((prev) => new Map(prev).set(key, editValue));
      } else {
        const data = await res.json();
        console.error("Failed to stage rename:", data.error);
      }
    } catch (err) {
      console.error("Failed to stage rename:", err);
    } finally {
      setLoading(null);
      setEditingKey(null);
    }
  }

  // Group files by device
  const byDevice = new Map<number, { name: string; files: DeviceFile[] }>();
  for (const f of files) {
    const group = byDevice.get(f.deviceId) || { name: f.deviceName, files: [] };
    group.files.push(f);
    byDevice.set(f.deviceId, group);
  }

  return (
    <div className="mt-8">
      <h2 className="font-heading text-xl font-bold mb-4">Files on Devices</h2>
      <div className="space-y-3">
        {Array.from(byDevice.entries()).map(([deviceId, group]) => (
          <div key={deviceId} className="card">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-vault-amber">&#128187;</span>
              <h3 className="font-semibold text-sm">{group.name}</h3>
            </div>
            {group.files.map((file) => {
              const key = fileKey(file);
              const isDeleted = pendingDeletes.has(key);
              const renamedTo = pendingRenames.get(key);
              const isEditing = editingKey === key;
              const isLoading = loading === key;

              return (
                <div key={key} className="py-2 border-t border-vault-border/50 first:border-0">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-mono text-vault-muted break-all ${isDeleted ? "line-through opacity-50" : ""}`}>
                        {file.filePath}
                      </p>
                      {renamedTo && !isDeleted && (
                        <p className="text-xs font-mono text-vault-amber mt-0.5">
                          &#8594; {renamedTo}
                        </p>
                      )}
                      {isDeleted && (
                        <p className="text-xs text-red-400 mt-0.5">Staged for deletion</p>
                      )}
                    </div>
                    {!isDeleted && !isEditing && !renamedTo && (
                      <div className="flex gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => startRename(file)}
                          disabled={isLoading}
                          className="px-2 py-1 text-xs rounded border border-vault-border text-vault-muted hover:text-vault-text hover:border-vault-muted transition-colors disabled:opacity-50"
                        >
                          Rename
                        </button>
                        <button
                          onClick={() => setConfirmDelete(file)}
                          disabled={isLoading}
                          className="px-2 py-1 text-xs rounded border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                  {isEditing && (
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") stageRename(file);
                          if (e.key === "Escape") setEditingKey(null);
                        }}
                        autoFocus
                        onFocus={(e) => e.target.select()}
                        className="flex-1 bg-vault-bg border border-vault-border rounded px-2 py-1 text-xs font-mono text-vault-text focus:outline-none focus:border-vault-amber/50"
                      />
                      <button
                        onClick={() => stageRename(file)}
                        disabled={isLoading}
                        className="px-2 py-1 text-xs rounded bg-vault-amber/20 text-vault-amber border border-vault-amber/30 hover:bg-vault-amber/30 transition-colors disabled:opacity-50"
                      >
                        Stage
                      </button>
                      <button
                        onClick={() => setEditingKey(null)}
                        className="px-2 py-1 text-xs rounded border border-vault-border text-vault-muted hover:text-vault-text transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Stage Deletion"
        message={
          confirmDelete
            ? `Stage deletion of "${confirmDelete.fileName}" from ${confirmDelete.deviceName}? The file won't be deleted until you apply changes in the Sync Panel.`
            : ""
        }
        confirmLabel="Stage Delete"
        confirmVariant="danger"
        onConfirm={() => confirmDelete && stageDelete(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
