// src/app/insights/page.tsx
"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

/* ── Types ─────────────────────────────────────────── */

interface GenreEntry { name: string; count: number }
interface EraEntry { name: string; range: string | null; count: number }
interface RankedEntry { name: string; count: number }
interface CrossPlatformEntry { title: string; platforms: string[]; count: number }

interface InsightsData {
  genres: GenreEntry[];
  eras: EraEntry[];
  franchises: RankedEntry[];
  developers: RankedEntry[];
  publishers: RankedEntry[];
  crossPlatform: CrossPlatformEntry[];
  totalGames: number;
  enrichedGames: number;
}

/* ── Colors ────────────────────────────────────────── */

const GENRE_COLORS = [
  "#f59e0b", "#8b5cf6", "#ef4444", "#22c55e", "#3b82f6",
  "#ec4899", "#14b8a6", "#f97316", "#06b6d4", "#a855f7",
  "#71717a", // "Other"
];

const ERA_COLORS: Record<string, string> = {
  "Dawn of Gaming": "#92400e",
  "8-Bit Era": "#dc2626",
  "16-Bit Golden Age": "#7c3aed",
  "The 3D Revolution": "#6b7280",
  "The Golden Era": "#ea580c",
  "HD Generation": "#16a34a",
  "Modern Era": "#e11d48",
  "Unknown": "#3f3f46",
};

/* ── Tooltip ───────────────────────────────────────── */

function InsightTooltip({
  active,
  payload,
  label,
  total,
}: {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any[];
  label?: string;
  total?: number;
}) {
  if (!active || !payload?.length) return null;
  const count = payload[0].value as number;
  const pct = total && total > 0 ? ((count / total) * 100).toFixed(1) : null;
  return (
    <div className="bg-vault-bg border border-vault-border rounded-lg px-3 py-2 shadow-xl">
      <p className="text-vault-text text-sm font-medium">{label ?? payload[0].name}</p>
      <p className="text-vault-muted text-xs">
        {count} games{pct ? ` (${pct}%)` : ""}
      </p>
    </div>
  );
}

/* ── Ranked List Card ──────────────────────────────── */

function RankedCard({ title, items }: { title: string; items: RankedEntry[] }) {
  if (items.length === 0) return null;
  return (
    <div className="bg-vault-surface border border-vault-border rounded-xl p-4">
      <h3 className="font-heading text-sm font-bold text-vault-text mb-3">{title}</h3>
      <ol className="space-y-2">
        {items.map((item, i) => (
          <li key={item.name} className="flex items-center gap-3 text-sm">
            <span className="text-vault-muted w-5 text-right font-mono text-xs">{i + 1}.</span>
            <span className="text-vault-text flex-1 truncate">{item.name}</span>
            <span className="text-vault-muted text-xs">{item.count}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ── Main Page ─────────────────────────────────────── */

export default function InsightsPage() {
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/insights")
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((json) => setData(json))
      .catch((err) => { console.error("Failed to load insights:", err); setError(true); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-vault-surface animate-pulse rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-80 bg-vault-surface animate-pulse rounded-xl" />
          <div className="h-80 bg-vault-surface animate-pulse rounded-xl" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-64 bg-vault-surface animate-pulse rounded-xl" />
          <div className="h-64 bg-vault-surface animate-pulse rounded-xl" />
          <div className="h-64 bg-vault-surface animate-pulse rounded-xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-red-400 text-lg">Failed to load insights. Please refresh.</p>
      </div>
    );
  }

  if (!data || data.totalGames === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-vault-muted text-lg">No games yet — scan a device to get started.</p>
      </div>
    );
  }

  if (data.enrichedGames === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-vault-muted text-lg">
          Enrich your games with IGDB metadata to see insights.
        </p>
        <p className="text-vault-muted text-sm mt-2">
          {data.totalGames} games found, but none have metadata yet.
        </p>
      </div>
    );
  }

  const genreTotal = data.genres.reduce((s, g) => s + g.count, 0);

  return (
    <div className="space-y-6">
      {/* ── Header ────────────────────────────── */}
      <div>
        <h1 className="font-heading text-2xl font-bold text-vault-text">Collection Insights</h1>
        <p className="text-vault-muted text-sm mt-1">
          Based on {data.enrichedGames.toLocaleString()} enriched games out of{" "}
          {data.totalGames.toLocaleString()} total
        </p>
      </div>

      {/* ── Charts Row (2-col) ────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Genre Donut */}
        <div className="bg-vault-surface border border-vault-border rounded-xl p-4">
          <h3 className="font-heading text-sm font-bold text-vault-text mb-3">
            Genre Distribution
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={data.genres}
                dataKey="count"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                stroke="none"
              >
                {data.genres.map((_, i) => (
                  <Cell key={i} fill={GENRE_COLORS[i % GENRE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<InsightTooltip total={genreTotal} />} />
            </PieChart>
          </ResponsiveContainer>
          {/* Legend */}
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2">
            {data.genres.map((g, i) => (
              <div key={g.name} className="flex items-center gap-1.5">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: GENRE_COLORS[i % GENRE_COLORS.length] }}
                />
                <span className="text-vault-muted text-xs">{g.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Era Bar Chart (horizontal) */}
        <div className="bg-vault-surface border border-vault-border rounded-xl p-4">
          <h3 className="font-heading text-sm font-bold text-vault-text mb-3">
            Era Distribution
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.eras} layout="vertical">
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                width={130}
                tick={{ fill: "rgb(var(--vault-muted))", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<InsightTooltip />} cursor={{ fill: "rgb(var(--vault-border) / 0.3)" }} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {data.eras.map((era) => (
                  <Cell key={era.name} fill={ERA_COLORS[era.name] ?? "#71717a"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Cards Row (3-col) ─────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <RankedCard title="Top Franchises" items={data.franchises} />
        <RankedCard title="Top Developers" items={data.developers} />
        <RankedCard title="Top Publishers" items={data.publishers} />
      </div>

      {/* ── Cross-Platform (if any) ───────────── */}
      {data.crossPlatform.length > 0 && (
        <div className="bg-vault-surface border border-vault-border rounded-xl p-4">
          <h3 className="font-heading text-sm font-bold text-vault-text mb-3">
            Cross-Platform Games
          </h3>
          <p className="text-vault-muted text-xs mb-3">
            Games in your collection that appear on multiple platforms
          </p>
          <div className="space-y-2">
            {data.crossPlatform.map((cp) => (
              <div key={cp.title} className="flex items-center gap-3 text-sm">
                <span className="text-vault-text flex-1 truncate">{cp.title}</span>
                <span className="text-vault-muted text-xs">
                  {cp.platforms.join(", ")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
