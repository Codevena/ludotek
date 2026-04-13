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
  CartesianGrid,
} from "recharts";

/* ---------- Types ---------- */

interface StatsData {
  totalGames: number;
  totalPlatforms: number;
  avgScore: number | null;
  coverPercent: number;
  aiPercent: number;
  platformCounts: {
    platform: string;
    label: string;
    color: string;
    count: number;
  }[];
  scoreBuckets: { name: string; count: number; color: string }[];
}

/* ---------- Helpers ---------- */

/* ---------- Tooltip ---------- */

interface VaultTooltipProps {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any[];
  label?: string;
  valueSuffix?: string;
}

function VaultTooltip({
  active,
  payload,
  label,
  valueSuffix = "games",
}: VaultTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-vault-bg border border-vault-border rounded-lg px-3 py-2 shadow-xl">
      <p className="text-vault-text text-sm font-medium">{label}</p>
      <p className="text-vault-muted text-xs">
        {payload[0].value} {valueSuffix}
      </p>
    </div>
  );
}

/* ---------- Skeletons ---------- */

function SkeletonCards() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="bg-vault-surface animate-pulse rounded-xl h-20"
        />
      ))}
    </div>
  );
}

/* ---------- Main Component ---------- */

export function StatsDashboard() {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stats")
      .then((res) => res.json())
      .then((json) => setData(json))
      .catch((err) => console.error("Failed to load stats:", err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <SkeletonCards />;
  if (!data) return null;

  return (
    <div>
      {/* ---- Stats Row ---- */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <StatCard value={data.totalGames.toLocaleString()} label="Total Games" color="text-vault-amber" />
        <StatCard value={String(data.totalPlatforms)} label="Platforms" color="text-vault-amber" />
        <StatCard
          value={data.avgScore !== null ? String(data.avgScore) : "—"}
          label="Avg Score"
          color="text-vault-amber"
        />
        <StatCard value={`${data.coverPercent}%`} label="Cover Coverage" color="text-green-400" />
        <StatCard value={`${data.aiPercent}%`} label="AI Content" color="text-purple-400" />
      </div>

      {/* ---- Charts Row ---- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Bar Chart — Games per Platform */}
        <div className="md:col-span-2 bg-vault-surface border border-vault-border rounded-xl p-4">
          <h3 className="font-heading text-sm font-bold text-vault-text mb-3">
            Games per Platform
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.platformCounts}>
              <defs>
                {data.platformCounts.map((p, i) => (
                  <linearGradient
                    key={i}
                    id={`bar-grad-${i}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor={p.color} stopOpacity={1} />
                    <stop offset="100%" stopColor={p.color} stopOpacity={0.4} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid vertical={false} stroke="#27272a" />
              <XAxis
                dataKey="label"
                tick={{ fill: "#71717a", fontSize: 11 }}
                angle={-35}
                textAnchor="end"
                height={60}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide />
              <Tooltip
                content={<VaultTooltip />}
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {data.platformCounts.map((_, i) => (
                  <Cell key={i} fill={`url(#bar-grad-${i})`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Donut Chart — Score Distribution */}
        <div className="md:col-span-1 bg-vault-surface border border-vault-border rounded-xl p-4">
          <h3 className="font-heading text-sm font-bold text-vault-text mb-3">
            Score Distribution
          </h3>
          <div className="relative">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={data.scoreBuckets}
                  dataKey="count"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={2}
                  stroke="none"
                >
                  {data.scoreBuckets.map((b, i) => (
                    <Cell key={i} fill={b.color} />
                  ))}
                </Pie>
                <Tooltip
                  content={<VaultTooltip />}
                  cursor={false}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Center label */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ height: 180 }}>
              <div className="text-center">
                <p className="font-heading text-2xl font-bold text-vault-text">
                  {data.avgScore ?? "—"}
                </p>
                <p className="text-vault-muted text-xs">avg</p>
              </div>
            </div>
          </div>
          {/* Legend */}
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2">
            {data.scoreBuckets.map((b) => (
              <div key={b.name} className="flex items-center gap-1.5">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: b.color }}
                />
                <span className="text-vault-muted text-xs">{b.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}

/* ---------- Stat Card ---------- */

function StatCard({
  value,
  label,
  color,
}: {
  value: string;
  label: string;
  color: string;
}) {
  return (
    <div className="bg-vault-surface border border-vault-border rounded-xl p-4 text-center">
      <p className={`font-heading text-3xl font-bold ${color}`}>{value}</p>
      <p className="text-vault-muted text-sm">{label}</p>
    </div>
  );
}
