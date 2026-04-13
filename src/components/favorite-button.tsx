"use client";

import { useState, useCallback } from "react";

export function FavoriteButton({
  gameId,
  initialFavorite,
}: {
  gameId: number;
  initialFavorite: boolean;
}) {
  const [isFavorite, setIsFavorite] = useState(initialFavorite);
  const [isAnimating, setIsAnimating] = useState(false);

  const toggle = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const next = !isFavorite;
      setIsFavorite(next);
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 200);

      try {
        const res = await fetch(`/api/games/${gameId}/favorite`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isFavorite: next }),
        });
        if (!res.ok) throw new Error("Failed to update favorite");
      } catch {
        setIsFavorite(!next);
      }
    },
    [gameId, isFavorite],
  );

  return (
    <button
      type="button"
      onClick={toggle}
      className={`absolute top-2 right-2 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-sm hover:bg-black/60 transition-all ${
        isAnimating ? "scale-125" : "scale-100"
      }`}
      aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
    >
      {isFavorite ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-4 h-4 text-red-500 transition-colors"
        >
          <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
        </svg>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-4 h-4 text-white/60 hover:text-white transition-colors"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21.75 8.25c0-3.09-2.545-5.25-5.438-5.25a5.5 5.5 0 00-4.312 2.052A5.5 5.5 0 007.688 3C4.795 3 2.25 5.16 2.25 8.25c0 7.22 9.75 12.75 9.75 12.75s9.75-5.53 9.75-12.75z"
          />
        </svg>
      )}
    </button>
  );
}
