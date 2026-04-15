// src/app/(main)/history/page.tsx
import { prisma } from "@/lib/prisma";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Timeline } from "@/components/history/timeline";
import { getConsoleHistory } from "@/lib/console-history";
import { PLATFORM_CONFIG } from "@/lib/platforms";

export default async function HistoryPage() {
  // Fetch all platforms that have games
  const platforms = await prisma.platform.findMany({
    where: { gameCount: { gt: 0 } },
    orderBy: { sortOrder: "asc" },
  });

  // Join with static history data, sort by release year
  const entries = platforms
    .map((p) => {
      const history = getConsoleHistory(p.id);
      if (!history) return null;

      return {
        platformId: p.id,
        name: p.label,
        alternateNames: history.alternateNames,
        manufacturer: history.manufacturer,
        releaseYear: history.releaseYear,
        color: p.color,
        romCount: p.gameCount,
        history: history.history,
        facts: history.facts,
        milestones: history.milestones,
      };
    })
    .filter((e): e is NonNullable<typeof e> => e !== null)
    .sort((a, b) => {
      if (a.releaseYear !== b.releaseYear) return a.releaseYear - b.releaseYear;
      const aSort = PLATFORM_CONFIG.find((p) => p.id === a.platformId)?.sortOrder ?? 99;
      const bSort = PLATFORM_CONFIG.find((p) => p.id === b.platformId)?.sortOrder ?? 99;
      return aSort - bSort;
    });

  const decadeCount = new Set(
    entries.map((e) => `${Math.floor(e.releaseYear / 10) * 10}s`)
  ).size;

  return (
    <div className="max-w-4xl mx-auto">
      <Breadcrumbs
        items={[{ label: "Home", href: "/" }, { label: "Console History" }]}
      />

      {/* Page Header */}
      <div className="mb-10">
        <h1 className="font-heading text-3xl md:text-4xl font-bold text-vault-text mb-2">
          Console History
        </h1>
        <p className="text-vault-muted text-sm md:text-base leading-relaxed max-w-2xl">
          {entries.length} Konsolen aus {decadeCount} Dekaden Gaming-Geschichte
          — jede einzelne Teil deiner Sammlung.
        </p>
      </div>

      <Timeline entries={entries} />
    </div>
  );
}
