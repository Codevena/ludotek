"use client";

import { type EraSlug } from "@/lib/eras";

interface EraInfo {
  slug: EraSlug;
  shortName: string;
  count: number;
  color: string;
}

interface EraBarProps {
  eras: EraInfo[];
  activeEra: EraSlug;
  onEraChange: (slug: EraSlug) => void;
}

export function EraBar({ eras, activeEra, onEraChange }: EraBarProps) {
  return (
    <div className="sticky top-0 z-10 bg-vault-bg/80 backdrop-blur-sm border-b border-vault-border py-3 px-1 -mx-1">
      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {eras.map((era) => {
          const isActive = era.slug === activeEra;
          return (
            <button
              key={era.slug}
              onClick={() => onEraChange(era.slug)}
              className="flex-shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-all duration-200"
              style={{
                background: `${era.color}${isActive ? "40" : "1a"}`,
                color: era.color,
                border: `${isActive ? "2px" : "1px"} solid ${era.color}${isActive ? "" : "4d"}`,
                fontWeight: isActive ? 600 : 400,
              }}
            >
              {era.shortName} · {era.count}
            </button>
          );
        })}
      </div>
    </div>
  );
}
