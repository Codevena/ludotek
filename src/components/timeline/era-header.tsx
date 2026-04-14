"use client";

import { type EraBucket } from "@/lib/eras";

interface EraHeaderProps {
  era: EraBucket;
  gameCount: number;
  platforms: string[];
}

export function EraHeader({ era, gameCount, platforms }: EraHeaderProps) {
  return (
    <div className="mb-6 mt-4">
      <div className="flex items-baseline gap-3 mb-1">
        <h2
          className="font-heading text-xl font-bold"
          style={{ color: era.color }}
        >
          {era.name}
        </h2>
        <span className="text-sm text-vault-muted">{era.range}</span>
      </div>
      <p className="text-sm text-vault-muted mb-3">
        {gameCount} Spiele
      </p>
      {platforms.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {platforms.map((p) => (
            <span
              key={p}
              className="text-xs rounded-full px-2.5 py-0.5"
              style={{
                background: `${era.color}1a`,
                color: era.color,
              }}
            >
              {p}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
