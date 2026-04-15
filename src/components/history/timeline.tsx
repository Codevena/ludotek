"use client";

import { useMemo, useCallback } from "react";
import { ConsoleCard } from "./console-card";

interface TimelineEntry {
  platformId: string;
  name: string;
  alternateNames: string[];
  manufacturer: string;
  releaseYear: number;
  color: string;
  romCount: number;
  history: string[];
  facts: {
    unitsSold: string;
    cpu: string;
    gameLibrary: string;
    launchPrice: string;
  };
  milestones: {
    title: string;
    year: number;
    description: string;
  }[];
}

interface TimelineProps {
  entries: TimelineEntry[];
}

const DECADES = [
  { label: "1970s", minYear: 1970, maxYear: 1979, color: "#92400e" },
  { label: "1980s", minYear: 1980, maxYear: 1989, color: "#dc2626" },
  { label: "1990s", minYear: 1990, maxYear: 1999, color: "#7c3aed" },
  { label: "2000s", minYear: 2000, maxYear: 2009, color: "#3b82f6" },
  { label: "2010s", minYear: 2010, maxYear: 2019, color: "#16a34a" },
  { label: "2020s", minYear: 2020, maxYear: 2029, color: "#e11d48" },
];

export function Timeline({ entries }: TimelineProps) {
  const activeDecades = useMemo(() => {
    return DECADES.filter((d) =>
      entries.some((e) => e.releaseYear >= d.minYear && e.releaseYear <= d.maxYear)
    );
  }, [entries]);

  const scrollToDecade = useCallback((label: string) => {
    const el = document.getElementById(`decade-${label}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  // Build items list with decade anchors inserted
  const items = useMemo(() => {
    const result: (
      | { type: "anchor"; label: string; color: string }
      | { type: "entry"; data: TimelineEntry }
    )[] = [];
    let currentDecade = "";

    for (const entry of entries) {
      const decade = DECADES.find(
        (d) => entry.releaseYear >= d.minYear && entry.releaseYear <= d.maxYear
      );
      const decadeLabel = decade?.label ?? "Other";

      if (decadeLabel !== currentDecade) {
        currentDecade = decadeLabel;
        result.push({
          type: "anchor",
          label: decadeLabel,
          color: decade?.color ?? "#64748b",
        });
      }
      result.push({ type: "entry", data: entry });
    }

    return result;
  }, [entries]);

  return (
    <div>
      {/* Decade Quick-Nav */}
      <div className="flex flex-wrap gap-2 mb-10">
        {activeDecades.map((d) => (
          <button
            key={d.label}
            onClick={() => scrollToDecade(d.label)}
            className="px-4 py-1.5 rounded-full text-sm font-medium transition-all hover:scale-105"
            style={{
              backgroundColor: `${d.color}18`,
              color: d.color,
              border: `1px solid ${d.color}33`,
            }}
          >
            {d.label}
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Glowing vertical line */}
        <div
          className="absolute left-[7px] md:left-[7px] top-0 bottom-0 w-[3px] rounded-full"
          style={{
            background: `linear-gradient(to bottom, ${activeDecades.map((d) => d.color).join(", ")})`,
          }}
        />
        {/* Diffuse glow behind the line */}
        <div
          className="absolute left-[3px] md:left-[3px] top-0 bottom-0 w-[11px] rounded-full"
          style={{
            background: `linear-gradient(to bottom, ${activeDecades.map((d) => `${d.color}22`).join(", ")})`,
            filter: "blur(4px)",
          }}
        />

        {/* Entries */}
        {items.map((item) => {
          if (item.type === "anchor") {
            return (
              <div
                key={`anchor-${item.label}`}
                id={`decade-${item.label}`}
                className="scroll-mt-24 pl-12 md:pl-16 pt-8 pb-4 first:pt-0"
              >
                <h2
                  className="font-heading text-2xl md:text-3xl font-black tracking-tight"
                  style={{
                    color: item.color,
                    textShadow: `0 0 20px ${item.color}44`,
                  }}
                >
                  {item.label}
                </h2>
              </div>
            );
          }
          return <ConsoleCard key={item.data.platformId} {...item.data} />;
        })}
      </div>
    </div>
  );
}
