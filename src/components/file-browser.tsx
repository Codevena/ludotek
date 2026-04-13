"use client";

import { useState, useEffect, useCallback } from "react";

interface FileBrowserProps {
  deviceId: number;
  onAddPath: (path: string, type: "rom" | "steam") => void;
  existingPaths: string[];
}

interface BrowseEntry {
  name: string;
  type: "dir" | "file";
}

export function FileBrowser({ deviceId, onAddPath, existingPaths }: FileBrowserProps) {
  const [currentPath, setCurrentPath] = useState("/");
  const [entries, setEntries] = useState<BrowseEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const browse = useCallback(
    async (path: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/devices/${deviceId}/browse?path=${encodeURIComponent(path)}`
        );
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error ?? `Browse failed (${res.status})`);
        }
        const data = await res.json();
        setEntries(data.entries ?? []);
        setCurrentPath(path);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to browse");
        setEntries([]);
      } finally {
        setLoading(false);
      }
    },
    [deviceId]
  );

  useEffect(() => {
    browse("/");
  }, [browse]);

  function navigateToFolder(folderName: string) {
    const nextPath =
      currentPath === "/" ? `/${folderName}` : `${currentPath}/${folderName}`;
    browse(nextPath);
  }

  function navigateToParent() {
    if (currentPath === "/") return;
    const parts = currentPath.split("/").filter(Boolean);
    parts.pop();
    const parentPath = parts.length === 0 ? "/" : `/${parts.join("/")}`;
    browse(parentPath);
  }

  const alreadyAdded = existingPaths.includes(currentPath);

  return (
    <div className="rounded-xl border border-vault-border bg-vault-surface overflow-hidden">
      {/* Path bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-vault-border bg-vault-bg">
        <button
          type="button"
          onClick={navigateToParent}
          disabled={currentPath === "/"}
          className="px-2 py-1 text-sm rounded border border-vault-border text-vault-muted hover:border-vault-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title="Go to parent"
        >
          &larr;
        </button>
        <button
          type="button"
          onClick={() => browse("/")}
          disabled={currentPath === "/"}
          className="px-2 py-1 text-sm rounded border border-vault-border text-vault-muted hover:border-vault-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title="Go to root"
        >
          /
        </button>
        <span className="text-sm text-vault-text truncate flex-1" title={currentPath}>
          {currentPath}
        </span>
      </div>

      {/* Entry list */}
      <div className="max-h-[400px] overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="h-5 w-5 border-2 border-vault-amber border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && error && (
          <div className="px-4 py-6 text-center text-sm text-red-400">{error}</div>
        )}

        {!loading && !error && entries.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-vault-muted">
            Empty directory
          </div>
        )}

        {!loading &&
          !error &&
          entries.map((entry) => (
            <div
              key={entry.name}
              className={`flex items-center gap-2 px-3 py-2 text-sm border-b border-vault-border/50 last:border-b-0 ${
                entry.type === "dir"
                  ? "cursor-pointer hover:bg-vault-amber/5 text-vault-text"
                  : "text-vault-muted"
              }`}
              onClick={
                entry.type === "dir"
                  ? () => navigateToFolder(entry.name)
                  : undefined
              }
            >
              <span>{entry.type === "dir" ? "\u{1F4C1}" : "\u{1F4C4}"}</span>
              <span className="truncate">{entry.name}</span>
            </div>
          ))}
      </div>

      {/* Add Path buttons */}
      <div className="flex items-center gap-3 px-3 py-3 border-t border-vault-border bg-vault-bg">
        {alreadyAdded ? (
          <span className="text-sm text-vault-muted">Already added</span>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onAddPath(currentPath, "rom")}
              className="px-3 py-1.5 text-sm font-medium rounded-lg bg-purple-600/20 text-purple-400 border border-purple-500/30 hover:bg-purple-600/30 transition-colors"
            >
              + ROM Path
            </button>
            <button
              type="button"
              onClick={() => onAddPath(currentPath, "steam")}
              className="px-3 py-1.5 text-sm font-medium rounded-lg bg-vault-amber/20 text-vault-amber border border-vault-amber/30 hover:bg-vault-amber/30 transition-colors"
            >
              + Steam Path
            </button>
          </>
        )}
      </div>
    </div>
  );
}
