"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

interface PlatformItem {
  id: string;
  label: string;
  icon: string;
  color: string;
  gameCount: number;
}

export function Sidebar() {
  const [platforms, setPlatforms] = useState<PlatformItem[]>([]);
  const [totalGames, setTotalGames] = useState(0);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activePlatform = searchParams.get("platform") || (pathname.startsWith("/platform/") ? pathname.split("/")[2] : null);

  useEffect(() => {
    fetch("/api/platforms")
      .then((r) => r.json())
      .then((data: PlatformItem[]) => {
        setPlatforms(data);
        setTotalGames(data.reduce((sum, p) => sum + p.gameCount, 0));
      });
  }, []);

  return (
    <aside className="w-64 h-screen sticky top-0 bg-vault-surface border-r border-vault-border overflow-y-auto flex-shrink-0">
      <div className="p-6">
        <Link href="/" className="block mb-8">
          <h1 className="font-heading text-2xl font-bold text-vault-amber">
            Game Vault
          </h1>
          <p className="text-vault-muted text-sm mt-1">
            {totalGames.toLocaleString()} Games
          </p>
        </Link>

        <nav className="space-y-1">
          <Link
            href="/"
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              pathname === "/" && !activePlatform
                ? "bg-vault-amber/10 text-vault-amber"
                : "text-vault-muted hover:text-vault-text hover:bg-vault-bg"
            }`}
          >
            <span>🏠</span>
            <span>All Games</span>
          </Link>

          {platforms.map((p) => (
            <Link
              key={p.id}
              href={`/platform/${p.id}`}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                activePlatform === p.id
                  ? "bg-vault-amber/10 text-vault-amber"
                  : "text-vault-muted hover:text-vault-text hover:bg-vault-bg"
              }`}
            >
              <img
                src={`/platforms/${p.id}.png`}
                alt={p.label}
                className="w-6 h-6 object-contain flex-shrink-0"
                onError={(e) => {
                  const img = e.target as HTMLImageElement;
                  img.style.display = "none";
                  img.nextElementSibling?.classList.remove("hidden");
                }}
              />
              <span className="hidden text-base">{p.icon}</span>
              <span className="flex-1 truncate">{p.label}</span>
              <span className="text-xs opacity-60">{p.gameCount}</span>
            </Link>
          ))}
        </nav>
      </div>
    </aside>
  );
}
