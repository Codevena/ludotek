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
  const [selectedThemes, setSelectedThemes] = useState<string[]>([]);
  const [availableGenres, setAvailableGenres] = useState<string[]>([]);
  const [availableThemes, setAvailableThemes] = useState<string[]>([]);
  const [loadingGenres, setLoadingGenres] = useState(false);

  const visiblePlatforms = platforms.filter((p) => p.gameCount > 0);

  function togglePlatform(id: string) {
    setSelectedPlatforms((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  }

  function toggleGenre(genre: string) {
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre],
    );
  }

  function toggleTheme(theme: string) {
    setSelectedThemes((prev) =>
      prev.includes(theme) ? prev.filter((t) => t !== theme) : [...prev, theme],
    );
  }

  async function goToStep2() {
    setStep(2);
    setLoadingGenres(true);
    try {
      const res = await fetch(
        `/api/discover/genres?platforms=${selectedPlatforms.join(",")}`,
      );
      const data = await res.json();
      setAvailableGenres(data.genres ?? []);
      setAvailableThemes(data.themes ?? []);
    } catch (err) {
      console.error("Failed to fetch genres:", err);
    }
    setLoadingGenres(false);
  }

  function goBack() {
    setStep(1);
    setSelectedGenres([]);
    setSelectedThemes([]);
  }

  function handleGenerate() {
    onGenerate(selectedPlatforms, selectedGenres, selectedThemes);
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
                  {platform.icon} {platform.label}
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

          {loadingGenres ? (
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 animate-pulse rounded-full bg-vault-amber" />
              <span className="text-sm text-vault-muted">
                Loading genres...
              </span>
            </div>
          ) : (
            <>
              {/* Combined Genres + Themes */}
              <div className="flex flex-wrap gap-2">
                {availableGenres.map((genre) => {
                  const isSelected = selectedGenres.includes(genre);
                  return (
                    <button
                      key={`g-${genre}`}
                      onClick={() => toggleGenre(genre)}
                      disabled={disabled}
                      className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
                        isSelected
                          ? "border-vault-amber bg-vault-amber/15 text-vault-amber"
                          : "border-vault-border bg-vault-surface text-vault-muted hover:border-vault-amber hover:text-vault-text"
                      }`}
                    >
                      {genre}
                    </button>
                  );
                })}
                {availableThemes.map((theme) => {
                  const isSelected = selectedThemes.includes(theme);
                  return (
                    <button
                      key={`t-${theme}`}
                      onClick={() => toggleTheme(theme)}
                      disabled={disabled}
                      className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
                        isSelected
                          ? "border-indigo-500 bg-indigo-500/15 text-indigo-400"
                          : "border-vault-border bg-vault-surface text-vault-muted hover:border-indigo-400 hover:text-vault-text"
                      }`}
                    >
                      {theme}
                    </button>
                  );
                })}
              </div>
            </>
          )}

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
              disabled={(selectedGenres.length === 0 && selectedThemes.length === 0) || disabled}
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
