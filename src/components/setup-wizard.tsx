"use client";

import { useState } from "react";

interface WizardState {
  step: number;
  deviceId: number | null;
  scanPaths: { path: string; type: "rom" | "steam" }[];
  igdbConfigured: boolean;
}

const STEPS = [
  { label: "Welcome", short: "1" },
  { label: "Device", short: "2" },
  { label: "Paths", short: "3" },
  { label: "API Keys", short: "4" },
  { label: "Scan", short: "5" },
];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {STEPS.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={s.label} className="flex items-center gap-2">
            {i > 0 && (
              <div
                className={`h-px w-6 sm:w-10 ${done ? "bg-vault-amber" : "bg-vault-border"}`}
              />
            )}
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium border-2 transition-colors ${
                  done
                    ? "bg-vault-amber border-vault-amber text-black"
                    : active
                      ? "border-vault-amber text-vault-amber"
                      : "border-vault-border text-vault-muted"
                }`}
              >
                {done ? "✓" : i + 1}
              </div>
              <span
                className={`text-xs hidden sm:block ${active ? "text-vault-text" : "text-vault-muted"}`}
              >
                {s.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function SetupWizard() {
  const [state, setState] = useState<WizardState>({
    step: 0,
    deviceId: null,
    scanPaths: [],
    igdbConfigured: false,
  });

  const setStep = (step: number) => setState((s) => ({ ...s, step }));

  return (
    <div className="w-full max-w-2xl">
      <StepIndicator current={state.step} />
      <div className="bg-vault-dark border border-vault-border rounded-2xl p-6 sm:p-8">
        {state.step === 0 && (
          <StepWelcome onNext={() => setStep(1)} />
        )}
        {state.step === 1 && (
          <div className="text-vault-muted text-sm">Step 2: Device (placeholder)</div>
        )}
        {state.step === 2 && (
          <div className="text-vault-muted text-sm">Step 3: Paths (placeholder)</div>
        )}
        {state.step === 3 && (
          <div className="text-vault-muted text-sm">Step 4: API Keys (placeholder)</div>
        )}
        {state.step === 4 && (
          <div className="text-vault-muted text-sm">Step 5: Scan (placeholder)</div>
        )}
      </div>
      <div className="text-center mt-4">
        <a href="/?skipSetup=1" className="text-xs text-vault-muted hover:text-vault-text transition-colors">
          Skip setup
        </a>
      </div>
    </div>
  );
}

function StepWelcome({ onNext }: { onNext: () => void }) {
  return (
    <div className="text-center space-y-6">
      <h1 className="font-heading text-2xl font-bold text-vault-text">
        Welcome to Game Vault
      </h1>
      <p className="text-vault-muted text-sm leading-relaxed max-w-md mx-auto">
        Game Vault scans your devices for ROMs, enriches them with metadata from
        IGDB, and gives you a beautiful library to browse your collection.
      </p>
      <div className="text-left bg-vault-bg rounded-xl border border-vault-border/50 p-4 space-y-2">
        <p className="text-sm font-medium text-vault-text mb-2">
          What you&apos;ll need:
        </p>
        <div className="flex items-start gap-2 text-sm text-vault-muted">
          <span className="text-vault-amber mt-0.5">1.</span>
          <span>A device with ROMs (Steam Deck, Android, or local PC)</span>
        </div>
        <div className="flex items-start gap-2 text-sm text-vault-muted">
          <span className="text-vault-amber mt-0.5">2.</span>
          <span>
            IGDB API credentials (free) —{" "}
            <a
              href="https://dev.twitch.tv/console/apps"
              target="_blank"
              rel="noopener noreferrer"
              className="text-vault-amber hover:underline"
            >
              Get them at dev.twitch.tv
            </a>
          </span>
        </div>
      </div>
      <button
        onClick={onNext}
        className="bg-vault-amber text-black hover:bg-vault-amber-hover px-6 py-2.5 text-sm font-medium rounded-lg transition-colors"
      >
        Get Started →
      </button>
    </div>
  );
}
