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
  const isFavoritesActive = searchParams.get("favorites") === "true";
  const isWishlistActive = pathname === "/wishlist";

  useEffect(() => {
    // Fetch active device to filter platform counts
    fetch("/api/settings")
      .then((r) => r.json())
      .then((settings) => {
        const deviceId = settings.activeDeviceId;
        const url = deviceId ? `/api/platforms?deviceId=${deviceId}` : "/api/platforms";
        return fetch(url);
      })
      .then((r) => r.json())
      .then((data: PlatformItem[]) => {
        setPlatforms(data);
        setTotalGames(data.reduce((sum, p) => sum + p.gameCount, 0));
      })
      .catch((err) => console.error("Failed to load platforms:", err));
  }, []);

  return (
    <aside className="w-64 h-screen sticky top-0 bg-vault-surface border-r border-vault-border overflow-y-auto flex-shrink-0">
      <div className="p-6">
        <Link href="/" className="flex items-center gap-3 mb-8">
          <img src="/logo.png" alt="Ludotek" className="w-9 h-9" />
          <div>
            <h1 className="font-heading text-2xl font-bold text-vault-amber">
              Ludotek
            </h1>
            <p className="text-vault-muted text-sm">
              {totalGames.toLocaleString()} Games
            </p>
          </div>
        </Link>

        <nav className="space-y-1">
          <Link
            href="/"
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              pathname === "/" && !activePlatform && !isFavoritesActive
                ? "bg-vault-amber/10 text-vault-amber"
                : "text-vault-muted hover:text-vault-text hover:bg-vault-bg"
            }`}
          >
            <span>🏠</span>
            <span>All Games</span>
          </Link>

          <Link
            href="/?favorites=true"
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              isFavoritesActive
                ? "bg-pink-500/10 text-pink-400"
                : "text-vault-muted hover:text-pink-400 hover:bg-vault-bg"
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-4 h-4 text-pink-500"
            >
              <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
            </svg>
            <span>Favorites</span>
          </Link>

          <Link
            href="/wishlist"
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              isWishlistActive
                ? "bg-amber-500/10 text-vault-amber"
                : "text-vault-muted hover:text-vault-amber hover:bg-vault-bg"
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-4 h-4 text-vault-amber"
            >
              <path
                fillRule="evenodd"
                d="M6.32 2.577a49.255 49.255 0 0111.36 0c1.497.174 2.57 1.46 2.57 2.93V21a.75.75 0 01-1.085.67L12 18.089l-7.165 3.583A.75.75 0 013.75 21V5.507c0-1.47 1.073-2.756 2.57-2.93z"
                clipRule="evenodd"
              />
            </svg>
            <span>Wishlist</span>
          </Link>

          <Link
            href="/insights"
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              pathname === "/insights"
                ? "bg-vault-amber/10 text-vault-amber"
                : "text-vault-muted hover:text-vault-text hover:bg-vault-bg"
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4"
            >
              <path d="M3 3v18h18" />
              <path d="M18 17V9" />
              <path d="M13 17V5" />
              <path d="M8 17v-3" />
            </svg>
            <span>Insights</span>
          </Link>

          <Link
            href="/timeline"
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              pathname === "/timeline"
                ? "bg-vault-amber/10 text-vault-amber"
                : "text-vault-muted hover:text-vault-text hover:bg-vault-bg"
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span>Timeline</span>
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
                  if (!img.dataset.triedSvg) {
                    img.dataset.triedSvg = "1";
                    img.src = `/platforms/${p.id}.svg`;
                  } else {
                    img.style.display = "none";
                    img.nextElementSibling?.classList.remove("hidden");
                  }
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
