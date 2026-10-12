"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { SearchBar } from "@/components/search-bar";
import { SyncPanel } from "@/components/sync-panel";
import { ThemeToggle } from "@/components/theme-toggle";

interface DeviceOption {
  id: number;
  name: string;
}

export function Header() {
  const [devices, setDevices] = useState<DeviceOption[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<number | null>(null);

  const loadActiveDevice = useCallback(async () => {
    try {
      const [devicesRes, settingsRes] = await Promise.all([
        fetch("/api/devices"),
        fetch("/api/settings"),
      ]);
      if (devicesRes.ok) {
        const devData = await devicesRes.json();
        setDevices((devData.devices || []).map((d: { id: number; name: string }) => ({ id: d.id, name: d.name })));
      }
      if (settingsRes.ok) {
        const setData = await settingsRes.json();
        setActiveDeviceId(setData.activeDeviceId ?? null);
      }
    } catch (err) {
      console.error("Failed to load devices for header:", err);
    }
  }, []);

  useEffect(() => {
    loadActiveDevice();
  }, [loadActiveDevice]);

  async function handleDeviceChange(newId: string) {
    const value = newId === "" ? null : Number(newId);
    setActiveDeviceId(value);
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activeDeviceId: value }),
      });
      window.location.reload();
    } catch (err) {
      console.error("Failed to update active device:", err);
    }
  }

  return (
    <header className="sticky top-0 z-10 bg-vault-bg/80 backdrop-blur-md border-b border-vault-border px-4 sm:px-6 py-4 flex flex-wrap items-center gap-2 sm:gap-4">
      <div className="basis-full lg:basis-auto lg:flex-1 min-w-0"><SearchBar /></div>
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
        href="/files"
        className="px-4 py-2 text-sm font-medium text-vault-muted hover:text-vault-text transition-colors"
      >
        Files
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

      {/* Sync Panel, Active Device Selector & Theme Toggle */}
      <div className="w-full xl:w-auto xl:ml-auto min-w-0 flex flex-wrap items-center gap-3">
        <SyncPanel />
        {devices.length > 0 && (
          <div className="min-w-0 flex items-center gap-2">
            <span className="text-vault-muted text-xs">Device:</span>
            <select
              value={activeDeviceId ?? ""}
              onChange={(e) => handleDeviceChange(e.target.value)}
              className="min-w-0 max-w-48 bg-vault-surface border border-vault-border rounded-lg px-2 py-1.5 text-xs text-vault-text focus:outline-none focus:border-vault-amber/50"
            >
              <option value="">All Devices</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="w-px h-5 bg-vault-border" />
        <ThemeToggle />
      </div>
      <nav aria-label="Weitere Bibliotheksseiten" className="w-full md:hidden flex flex-wrap gap-x-4 gap-y-2 text-xs text-vault-muted">
        <Link href="/saves" className="hover:text-vault-amber">Save-Versionen</Link>
        <Link href="/?favorites=true" className="hover:text-vault-amber">Favorites</Link>
        <Link href="/wishlist" className="hover:text-vault-amber">Wishlist</Link>
        <Link href="/insights" className="hover:text-vault-amber">Insights</Link>
        <Link href="/timeline" className="hover:text-vault-amber">Timeline</Link>
      </nav>
    </header>
  );
}
