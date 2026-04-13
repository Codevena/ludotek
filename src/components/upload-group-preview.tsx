"use client";

import { useState } from "react";
import { PLATFORM_CONFIG } from "@/lib/platforms";
import type { PlatformGroup } from "@/lib/platform-detector";

interface UploadGroupPreviewProps {
  groups: PlatformGroup[];
  unknownFiles: { file: File; relativePath: string }[];
  onConfirm: (finalGroups: PlatformGroup[]) => void;
  disabled?: boolean;
}

function formatSize(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${Math.round(bytes / 1_000)} KB`;
}

function groupTotalSize(files: { file: File }[]): number {
  return files.reduce((sum, f) => sum + f.file.size, 0);
}

const CONFIDENCE_BADGES: Record<
  PlatformGroup["confidence"],
  { label: string; className: string }
> = {
  high: {
    label: "Auto-detected",
    className:
      "bg-green-500/20 text-green-400 border border-green-500/30",
  },
  medium: {
    label: "Likely match",
    className:
      "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30",
  },
  low: {
    label: "Extension match",
    className: "bg-red-500/20 text-red-400 border border-red-500/30",
  },
};

export default function UploadGroupPreview({
  groups: initialGroups,
  unknownFiles: initialUnknown,
  onConfirm,
  disabled = false,
}: UploadGroupPreviewProps) {
  const [groups, setGroups] = useState<PlatformGroup[]>(initialGroups);
  const [unknownFiles, setUnknownFiles] =
    useState<{ file: File; relativePath: string }[]>(initialUnknown);
  const [unknownPlatformId, setUnknownPlatformId] = useState("");

  const totalFiles = groups.reduce((sum, g) => sum + g.files.length, 0);
  const totalSize = groups.reduce(
    (sum, g) => sum + groupTotalSize(g.files),
    0,
  );
  const uniquePlatforms = new Set(groups.map((g) => g.platformId)).size;

  const hasUnassignedUnknown = unknownFiles.length > 0;
  const canUpload =
    !disabled && groups.length > 0 && !hasUnassignedUnknown;

  function handlePlatformChange(groupIndex: number, newPlatformId: string) {
    const platform = PLATFORM_CONFIG.find((p) => p.id === newPlatformId);
    if (!platform) return;

    setGroups((prev) =>
      prev.map((g, i) =>
        i === groupIndex
          ? { ...g, platformId: newPlatformId, platform }
          : g,
      ),
    );
  }

  function handleAssignUnknown() {
    if (!unknownPlatformId || unknownFiles.length === 0) return;

    const platform = PLATFORM_CONFIG.find((p) => p.id === unknownPlatformId);
    if (!platform) return;

    setGroups((prev) => {
      const existingIndex = prev.findIndex((g) => g.platformId === unknownPlatformId);
      if (existingIndex >= 0) {
        // Merge into existing group
        return prev.map((g, i) =>
          i === existingIndex
            ? { ...g, files: [...g.files, ...unknownFiles] }
            : g
        );
      }
      // Create new group
      return [...prev, {
        platformId: unknownPlatformId,
        platform,
        confidence: "low" as const,
        files: unknownFiles,
      }];
    });
    setUnknownFiles([]);
    setUnknownPlatformId("");
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Group cards */}
      <div className="flex flex-col gap-3">
        {groups.map((group, index) => {
          const badge = CONFIDENCE_BADGES[group.confidence];
          const size = groupTotalSize(group.files);

          return (
            <div
              key={`${group.platformId}-${index}`}
              className="card rounded-xl border border-vault-border bg-vault-surface p-4"
            >
              <div className="flex items-center justify-between gap-3">
                {/* Left: icon + label + badge */}
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-2xl shrink-0">
                    {group.platform.icon}
                  </span>
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="truncate font-heading text-vault-text">
                      {group.platform.label}
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                      <span className="text-xs text-vault-muted">
                        {group.files.length}{" "}
                        {group.files.length === 1 ? "file" : "files"}
                        {" · "}
                        {formatSize(size)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: platform override dropdown */}
                <select
                  value={group.platformId}
                  onChange={(e) =>
                    handlePlatformChange(index, e.target.value)
                  }
                  className="shrink-0 rounded-lg border border-vault-border bg-vault-surface px-3 py-1.5 text-sm text-vault-text focus:outline-none focus:ring-1 focus:ring-vault-amber"
                >
                  {PLATFORM_CONFIG.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.icon} {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          );
        })}
      </div>

      {/* Unknown files section */}
      {unknownFiles.length > 0 && (
        <div className="rounded-xl border border-red-500/30 bg-vault-surface p-4">
          <h3 className="font-heading text-vault-text mb-2">
            Unrecognized Files{" "}
            <span className="text-sm text-vault-muted">
              ({unknownFiles.length})
            </span>
          </h3>

          <ul className="mb-3 flex flex-col gap-1 text-sm text-vault-muted max-h-40 overflow-y-auto">
            {unknownFiles.map((f, i) => (
              <li key={i} className="truncate">
                {f.relativePath || f.file.name}
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-2">
            <select
              value={unknownPlatformId}
              onChange={(e) => setUnknownPlatformId(e.target.value)}
              className="flex-1 rounded-lg border border-vault-border bg-vault-surface px-3 py-1.5 text-sm text-vault-text focus:outline-none focus:ring-1 focus:ring-vault-amber"
            >
              <option value="">Select a platform…</option>
              {PLATFORM_CONFIG.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.icon} {p.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!unknownPlatformId}
              onClick={handleAssignUnknown}
              className="shrink-0 rounded-lg border border-vault-border bg-vault-surface px-3 py-1.5 text-sm text-vault-text transition-colors hover:border-vault-amber disabled:cursor-not-allowed disabled:opacity-50"
            >
              Assign Platform
            </button>
          </div>
        </div>
      )}

      {/* Bottom bar */}
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm text-vault-muted">
          {totalFiles} {totalFiles === 1 ? "game" : "games"} across{" "}
          {uniquePlatforms} {uniquePlatforms === 1 ? "system" : "systems"}
        </span>
        <button
          type="button"
          disabled={!canUpload}
          onClick={() => onConfirm(groups)}
          className="bg-vault-amber text-black hover:bg-vault-amber-hover px-6 py-3 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        >
          Upload All ({formatSize(totalSize)})
        </button>
      </div>
    </div>
  );
}
