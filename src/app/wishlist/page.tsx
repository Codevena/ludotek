"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { buildRomSearchUrl } from "@/lib/rom-search";

interface WishlistItem {
  id: number;
  title: string;
  platform: string;
  platformLabel: string;
  coverUrl: string | null;
  igdbScore: number | null;
  summary: string | null;
  genres: string | null;
  developer: string | null;
  year: number | null;
  createdAt: string;
}

export default function WishlistPage() {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [romSearchUrl, setRomSearchUrl] = useState("");

  useEffect(() => {
    fetch("/api/wishlist")
      .then((r) => r.json())
      .then((data) => {
        setItems(data.items ?? []);
      })
      .catch((err) => {
        console.error("Failed to load wishlist:", err);
      })
      .finally(() => setLoading(false));

    fetch("/api/settings/rom-search")
      .then((r) => r.json())
      .then((data) => setRomSearchUrl(data.romSearchUrl || ""))
      .catch(() => {});
  }, []);

  function handleRemove(id: number) {
    const previous = items;
    setItems((prev) => prev.filter((item) => item.id !== id));

    fetch(`/api/wishlist/${id}`, { method: "DELETE" }).catch((err) => {
      console.error("Failed to remove wishlist item:", err);
      setItems(previous);
    });
  }

  return (
    <div>
      {/* Breadcrumbs */}
      <nav className="text-sm text-vault-muted mb-6">
        <Link href="/" className="hover:text-vault-text transition-colors">
          Home
        </Link>
        <span className="mx-2">/</span>
        <span className="text-vault-text">Wishlist</span>
      </nav>

      {/* Header */}
      <h1 className="font-heading text-2xl font-bold mb-6">
        Wishlist
        <span className="text-vault-muted text-sm font-normal ml-2">
          ({items.length})
        </span>
      </h1>

      {/* Loading state */}
      {loading && (
        <p className="text-vault-muted">Loading wishlist...</p>
      )}

      {/* Empty state */}
      {!loading && items.length === 0 && (
        <div className="text-center py-16">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-12 h-12 text-vault-muted mx-auto mb-4"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"
            />
          </svg>
          <p className="text-vault-muted text-lg">Your wishlist is empty.</p>
          <p className="text-vault-muted text-sm mt-1">
            Browse platform pages to discover games you&apos;re missing.
          </p>
        </div>
      )}

      {/* Grid */}
      {!loading && items.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-vault-surface border border-vault-border rounded-xl overflow-hidden flex flex-col"
            >
              {/* Cover */}
              <div className="aspect-[3/4] bg-vault-bg relative">
                {item.coverUrl ? (
                  <img
                    src={item.coverUrl}
                    alt={item.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const img = e.target as HTMLImageElement;
                      img.style.display = "none";
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-vault-muted text-xs">
                    No Cover
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-3 flex flex-col flex-1">
                <h3 className="font-bold text-sm leading-tight line-clamp-2 mb-1">
                  {item.title}
                </h3>

                <span className="inline-block self-start text-[10px] font-medium px-2 py-0.5 rounded-full bg-vault-amber/15 text-vault-amber mb-1">
                  {item.platformLabel}
                </span>

                {item.igdbScore != null && (
                  <p className="text-xs text-vault-muted mb-1">
                    Score:{" "}
                    <span className="text-vault-text font-medium">
                      {Math.round(item.igdbScore)}
                    </span>
                  </p>
                )}

                {item.summary && (
                  <p className="text-xs text-vault-muted line-clamp-2 mb-2">
                    {item.summary}
                  </p>
                )}

                <div className="mt-auto flex items-center gap-3">
                  {romSearchUrl && (
                    <a
                      href={buildRomSearchUrl(romSearchUrl, item.title, item.platform, item.platformLabel)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-vault-amber hover:text-vault-amber-hover text-xs transition-colors flex items-center gap-1"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                      </svg>
                      Search ROM
                    </a>
                  )}
                  <button
                    onClick={() => handleRemove(item.id)}
                    className="text-red-400 hover:text-red-300 text-xs transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
