"use client";

import { useState } from "react";

interface DiscoverWizardProps {
  platforms: { id: string; label: string; icon: string; gameCount: number }[];
  onGenerate: (
    selectedPlatforms: string[],
    selectedGenres: string[],
    selectedThemes: string[],
  ) => void;
  disabled?: boolean;
}

export function DiscoverWizard({
  platforms,
  onGenerate,
  disabled,
}: DiscoverWizardProps) {
  const [step, setStep] = useState(1);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const visiblePlatforms = platforms.filter((p) => p.gameCount > 0);

  // Fixed categories — the AI understands these directly, no need to query DB
  const CATEGORIES = [
    "RPG", "Action", "Adventure", "Platformer", "Puzzle", "Racing",
    "Fighting", "Shooter", "Strategy", "Sport", "Simulation",
    "Horror", "Survival", "Open World", "Fantasy", "Sci-Fi",
    "Stealth", "Hack & Slash", "Turn-Based", "Roguelike",
    "Co-op", "Party", "Retro", "Indie",
  ];

  function togglePlatform(id: string) {
    setSelectedPlatforms((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  }

  function toggleCategory(cat: string) {
    setSelectedGenres((prev) =>
      prev.includes(cat) ? prev.filter((g) => g !== cat) : [...prev, cat],
    );
  }

  function goToStep2() {
    setStep(2);
  }

  function goBack() {
    setStep(1);
    setSelectedGenres([]);
  }

  function handleGenerate() {
    onGenerate(selectedPlatforms, selectedGenres, []);
  }

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-3">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
            step > 1
              ? "bg-green-500/20 text-green-400"
              : "bg-vault-amber/20 text-vault-amber"
          }`}
        >
          {step > 1 ? (
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          ) : (
            "1"
          )}
        </div>
        <div className="h-px w-8 bg-vault-border" />
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
            step === 2
              ? "bg-vault-amber/20 text-vault-amber"
              : "bg-vault-surface text-vault-muted"
          }`}
        >
          2
        </div>
        <span className="ml-2 text-sm text-vault-muted">
          Step {step} of 2
        </span>
      </div>

      {/* Step 1: Platform Selection */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <h2 className="font-heading text-xl font-bold text-vault-text">
              Welche Konsolen?
            </h2>
            <p className="mt-1 text-sm text-vault-muted">
              Waehle eine oder mehrere Plattformen
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {visiblePlatforms.map((platform) => {
              const isSelected = selectedPlatforms.includes(platform.id);
              return (
                <button
                  key={platform.id}
                  onClick={() => togglePlatform(platform.id)}
                  disabled={disabled}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
                    isSelected
                      ? "border-vault-amber bg-vault-amber/15 text-vault-amber"
                      : "border-vault-border bg-vault-surface text-vault-muted hover:border-vault-amber hover:text-vault-text"
                  }`}
                >
                  <img src={`/platforms/${platform.id}.png`} alt="" className="w-5 h-5 object-contain inline-block mr-1.5 -mt-0.5" />
                  {platform.label}
                </button>
              );
            })}
          </div>

          <div className="flex justify-end">
            <button
              onClick={goToStep2}
              disabled={selectedPlatforms.length === 0 || disabled}
              className="rounded-lg bg-vault-amber px-6 py-3 text-sm font-medium text-black transition-colors hover:bg-vault-amber-hover disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Genre/Theme Selection */}
      {step === 2 && (
        <div className="space-y-4">
          <div>
            <h2 className="font-heading text-xl font-bold text-vault-text">
              Was interessiert dich?
            </h2>
            <p className="mt-1 text-sm text-vault-muted">
              Waehle Genres und Kategorien
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => {
              const isSelected = selectedGenres.includes(cat);
              return (
                <button
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  disabled={disabled}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
                    isSelected
                      ? "border-vault-amber bg-vault-amber/15 text-vault-amber"
                      : "border-vault-border bg-vault-surface text-vault-muted hover:border-vault-amber hover:text-vault-text"
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          <div className="flex justify-between">
            <button
              onClick={goBack}
              disabled={disabled}
              className="rounded-lg border border-vault-border bg-vault-surface px-6 py-3 text-sm font-medium text-vault-text transition-colors hover:border-vault-amber disabled:opacity-50"
            >
              Back
            </button>
            <button
              onClick={handleGenerate}
              disabled={selectedGenres.length === 0 || disabled}
              className="rounded-lg bg-vault-amber px-6 py-3 text-sm font-medium text-black transition-colors hover:bg-vault-amber-hover disabled:opacity-50"
            >
              Generate
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
