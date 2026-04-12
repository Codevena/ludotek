"use client";

import Link from "next/link";
import { SearchBar } from "@/components/search-bar";

export function Header() {
  return (
    <header className="sticky top-0 z-10 bg-vault-bg/80 backdrop-blur-md border-b border-vault-border px-6 py-4 flex items-center gap-4">
      <SearchBar />
      <Link
        href="/admin"
        className="px-4 py-2 text-sm text-vault-muted hover:text-vault-text transition-colors"
      >
        Admin
      </Link>
    </header>
  );
}
