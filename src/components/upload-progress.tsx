"use client";

import Link from "next/link";

export interface GameProgress {
  gameId: string;
  title: string;
  status: "queued" | "processing" | "done" | "failed";
  step?: "convert" | "transfer" | "scan" | "enrich";
  convertPercent?: number;
  transferPercent?: number;
  error?: string;
  dbId?: number;
  coverUrl?: string | null;
}

interface UploadProgressProps {
  games: GameProgress[];
  totalGames: number;
  isComplete: boolean;
  succeeded: number;
  failed: number;
}

const STEPS = ["convert", "transfer", "scan", "enrich"] as const;

const STEP_LABELS: Record<string, string> = {
  convert: "Converting",
  transfer: "Transferring",
  scan: "Scanning",
  enrich: "Enriching",
};

function StatusIcon({ status }: { status: GameProgress["status"] }) {
  switch (status) {
    case "done":
      return (
        <span className="text-green-400" aria-label="Done">
          &#10003;
        </span>
      );
    case "processing":
      return (
        <span
          className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-vault-amber"
          aria-label="Processing"
        />
      );
    case "failed":
      return (
        <span className="text-red-400" aria-label="Failed">
          &#10005;
        </span>
      );
    case "queued":
      return (
        <span className="text-vault-muted" aria-label="Queued">
          &middot;&middot;&middot;
        </span>
      );
  }
}

function segmentColor(
  step: string,
  currentStep: string | undefined,
  status: GameProgress["status"],
): string {
  if (status === "done") return "bg-green-500";
  if (status !== "processing" || !currentStep) return "bg-vault-border";

  const currentIdx = STEPS.indexOf(currentStep as (typeof STEPS)[number]);
  const stepIdx = STEPS.indexOf(step as (typeof STEPS)[number]);

  if (stepIdx < currentIdx) return "bg-green-500";
  if (stepIdx === currentIdx) return "bg-vault-amber";
  return "bg-vault-border";
}

export default function UploadProgress({
  games,
  totalGames,
  isComplete,
  succeeded,
  failed,
}: UploadProgressProps) {
  const doneCount = games.filter(
    (g) => g.status === "done" || g.status === "failed",
  ).length;

  return (
    <div className="flex flex-col gap-5">
      {/* Overall progress */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-vault-text">
            {doneCount} / {totalGames} games
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-vault-border">
          <div
            className="h-full rounded-full bg-vault-amber transition-all"
            style={{
              width: totalGames > 0 ? `${(doneCount / totalGames) * 100}%` : "0%",
            }}
          />
        </div>
      </div>

      {/* Per-game cards */}
      <div className="flex flex-col gap-3">
        {games.map((game) => (
          <div key={game.gameId} className="card rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <StatusIcon status={game.status} />
                <span className="truncate font-heading text-vault-text">
                  {game.title}
                </span>
              </div>
              {game.status === "processing" && game.step && (
                <span className="shrink-0 text-sm text-vault-muted">
                  {STEP_LABELS[game.step]}
                </span>
              )}
            </div>

            {/* 4-segment pipeline bar */}
            <div className="mt-2 flex gap-1">
              {STEPS.map((s) => (
                <div
                  key={s}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${segmentColor(s, game.step, game.status)}`}
                />
              ))}
            </div>

            {/* Sub-progress for convert */}
            {game.status === "processing" &&
              game.step === "convert" &&
              game.convertPercent !== undefined && (
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-vault-border">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all"
                    style={{ width: `${game.convertPercent}%` }}
                  />
                </div>
              )}

            {/* Sub-progress for transfer */}
            {game.status === "processing" &&
              game.step === "transfer" &&
              game.transferPercent !== undefined && (
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-vault-border">
                  <div
                    className="h-full rounded-full bg-green-500 transition-all"
                    style={{ width: `${game.transferPercent}%` }}
                  />
                </div>
              )}

            {/* Error message */}
            {game.error && (
              <p className="mt-2 text-sm text-red-400">{game.error}</p>
            )}
          </div>
        ))}
      </div>

      {/* Completion summary */}
      {isComplete && (
        <div className="flex flex-col items-center gap-3 pt-2">
          <div className="flex gap-4 text-sm">
            <span className="text-green-400">{succeeded} succeeded</span>
            {failed > 0 && (
              <span className="text-red-400">{failed} failed</span>
            )}
          </div>
          <div className="flex gap-3">
            <Link
              href="/"
              className="rounded-lg bg-vault-amber px-6 py-2.5 font-heading font-semibold text-black transition-colors hover:bg-vault-amber-hover"
            >
              View Library
            </Link>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-lg bg-vault-surface px-6 py-2.5 font-heading font-medium text-vault-text transition-colors hover:bg-vault-border"
            >
              Upload More
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
