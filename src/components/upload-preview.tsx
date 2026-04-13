"use client";

import type { DetectedGame } from "@/lib/upload-detector";

interface UploadPreviewProps {
  games: DetectedGame[];
  onConfirm: (gameIds: string[]) => void;
  disabled?: boolean;
}

function formatSize(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  if (bytes >= 1_000_000) return `${Math.round(bytes / 1_000_000)} MB`;
  if (bytes >= 1_000) return `${Math.round(bytes / 1_000)} KB`;
  return `${bytes} B`;
}

function conversionLabel(conversion: DetectedGame["conversion"]) {
  switch (conversion) {
    case "chd":
      return <span className="text-blue-400">Will convert to .chd</span>;
    case "rvz":
      return <span className="text-purple-400">Will convert to .rvz</span>;
    case "none":
      return <span className="text-vault-muted">No conversion needed</span>;
  }
}

export default function UploadPreview({
  games,
  onConfirm,
  disabled = false,
}: UploadPreviewProps) {
  const totalSize = games.reduce((sum, g) => sum + g.totalSize, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg text-vault-text">
          Detected Games ({games.length})
        </h2>
        <span className="text-sm text-vault-muted">
          {formatSize(totalSize)} total
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {games.map((game) => (
          <div
            key={game.id}
            className="card flex flex-col gap-1.5 rounded-lg p-4"
          >
            <div className="flex items-center gap-2">
              <span className="truncate font-heading text-vault-text">
                {game.title}
              </span>
              {game.type === "multi-disc" && (
                <span className="shrink-0 rounded bg-vault-amber/20 px-2 py-0.5 text-xs font-medium text-vault-amber">
                  {game.discCount} Discs
                </span>
              )}
            </div>
            <div className="text-sm">{conversionLabel(game.conversion)}</div>
            <div className="flex gap-3 text-xs text-vault-muted">
              <span>{formatSize(game.totalSize)}</span>
              <span>
                {game.files.length} {game.files.length === 1 ? "file" : "files"}
              </span>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        disabled={disabled || games.length === 0}
        onClick={() => onConfirm(games.map((g) => g.id))}
        className="w-full rounded-lg bg-vault-amber py-3 font-heading font-semibold text-black transition-colors hover:bg-vault-amber-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        Upload to Steam Deck ({formatSize(totalSize)})
      </button>
    </div>
  );
}
