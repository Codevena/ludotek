"use client";

import Link from "next/link";
import { SearchBar } from "@/components/search-bar";

export function Header() {
  return (
    <header className="sticky top-0 z-10 bg-vault-bg/80 backdrop-blur-md border-b border-vault-border px-6 py-4 flex items-center gap-4">
      <SearchBar />
      <Link
        href="/"
        className="px-4 py-2 text-sm font-medium text-vault-muted hover:text-vault-text transition-colors"
      >
        Home
      </Link>
      <Link
        href="/discover"
        className="px-4 py-2 text-sm font-medium text-vault-amber hover:text-vault-amber-hover transition-colors"
      >
        Discover
      </Link>
      <Link
        href="/devices"
        className="px-4 py-2 text-sm font-medium text-vault-muted hover:text-vault-text transition-colors"
      >
        Devices
      </Link>
      <Link
        href="/admin/upload"
        className="px-4 py-2 text-sm text-vault-muted hover:text-vault-text transition-colors"
      >
        Upload
      </Link>
      <Link
        href="/admin"
        className="px-4 py-2 text-sm text-vault-muted hover:text-vault-text transition-colors"
      >
        Admin
      </Link>
    </header>
  );
}
