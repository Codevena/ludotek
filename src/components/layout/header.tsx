"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { SearchBar } from "@/components/search-bar";

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

      {/* Active Device Selector */}
      {devices.length > 0 && (
        <div className="ml-auto flex items-center gap-2">
          <span className="text-vault-muted text-xs">Device:</span>
          <select
            value={activeDeviceId ?? ""}
            onChange={(e) => handleDeviceChange(e.target.value)}
            className="bg-vault-surface border border-vault-border rounded-lg px-2 py-1.5 text-xs text-vault-text focus:outline-none focus:border-vault-amber/50"
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
    </header>
  );
}
