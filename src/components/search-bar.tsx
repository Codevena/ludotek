"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";

interface SearchResult {
  id: number;
  title: string;
  coverUrl: string | null;
  platformLabel: string;
  platform: string;
}

export function SearchBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("search") || "");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const suggestRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    setQuery(searchParams.get("search") || "");
  }, [searchParams]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setIsOpen(false);
      setHasSearched(false);
      return;
    }

    setIsLoading(true);
    const thisRequest = ++requestIdRef.current;
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (thisRequest !== requestIdRef.current) return;
      const data = await res.json();
      setResults(data.results || []);
      setHasSearched(true);
      setIsOpen(true);
    } catch {
      if (thisRequest !== requestIdRef.current) return;
      console.warn("Failed to fetch search suggestions");
      setResults([]);
    } finally {
      if (thisRequest === requestIdRef.current) setIsLoading(false);
    }
  }, []);

  function handleChange(value: string) {
    setQuery(value);

    // Debounced full-page search
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (value.trim()) {
        router.push(`/?search=${encodeURIComponent(value.trim())}`);
      } else {
        router.push("/");
      }
    }, 300);

    // Debounced suggestions fetch
    if (suggestRef.current) clearTimeout(suggestRef.current);
    suggestRef.current = setTimeout(() => {
      fetchSuggestions(value.trim());
    }, 200);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (suggestRef.current) clearTimeout(suggestRef.current);
    setIsOpen(false);
    if (query.trim()) {
      router.push(`/?search=${encodeURIComponent(query.trim())}`);
    } else {
      router.push("/");
    }
  }

  function handleResultClick(id: number) {
    setIsOpen(false);
    router.push(`/game/${id}`);
  }

  return (
    <div ref={containerRef} className="relative flex-1 max-w-md">
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => {
            if (results.length > 0 || hasSearched) setIsOpen(true);
          }}
          placeholder="Search games..."
          aria-label="Search games"
          className="w-full bg-vault-surface border border-vault-border rounded-lg px-4 py-2 text-sm text-vault-text placeholder-vault-muted focus:outline-none focus:border-vault-amber transition-colors"
        />
      </form>

      {isOpen && (
        <div className="absolute left-0 right-0 z-50 bg-vault-surface border border-vault-border rounded-lg shadow-xl mt-1 overflow-hidden">
          {isLoading && results.length === 0 && (
            <div className="px-3 py-3 text-sm text-vault-muted text-center">
              Searching...
            </div>
          )}

          {!isLoading && hasSearched && results.length === 0 && (
            <div className="px-3 py-3 text-sm text-vault-muted text-center">
              No results
            </div>
          )}

          {results.map((game) => (
            <button
              key={game.id}
              type="button"
              onClick={() => handleResultClick(game.id)}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-vault-bg cursor-pointer transition-colors text-left"
            >
              {game.coverUrl ? (
                <img
                  src={game.coverUrl}
                  alt=""
                  className="w-8 h-10 rounded bg-vault-bg object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-8 h-10 rounded bg-vault-bg flex-shrink-0 flex items-center justify-center text-vault-muted text-[8px]">
                  N/A
                </div>
              )}
              <span className="text-sm text-vault-text truncate flex-1 min-w-0">
                {game.title}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-vault-amber/20 text-vault-amber font-medium flex-shrink-0">
                {game.platformLabel}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
