"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { FileBrowser } from "@/components/file-browser";
import { useScan } from "@/context/scan-context";

interface Device {
  id: number;
  name: string;
  type: string;
  host: string;
  protocol: string;
  scanPaths: string | null;
  blacklist: string | null;
}

interface ScanPath {
  path: string;
  type: "rom" | "steam";
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<number | null>(null);
  const { scanning: globalScanning, startScan } = useScan();
  const [blacklistInput, setBlacklistInput] = useState("");
  const [loading, setLoading] = useState(true);
  const hasAutoSelected = useRef(false);

  const loadDevices = useCallback(async () => {
    try {
      const [devicesRes, settingsRes] = await Promise.all([
        fetch("/api/devices"),
        fetch("/api/settings"),
      ]);
      if (!devicesRes.ok) throw new Error("Failed to load devices");
      const devData = await devicesRes.json();
      const deviceList: Device[] = devData.devices || [];
      setDevices(deviceList);

      if (!hasAutoSelected.current && deviceList.length > 0) {
        hasAutoSelected.current = true;
        let initialId = deviceList[0].id;
        if (settingsRes.ok) {
          const setData = await settingsRes.json();
          if (setData.activeDeviceId && deviceList.some((d: Device) => d.id === setData.activeDeviceId)) {
            initialId = setData.activeDeviceId;
          }
        }
        setSelectedDeviceId(initialId);
      }
    } catch (err) {
      console.error("Failed to load devices:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  const selectedDevice = devices.find((d) => d.id === selectedDeviceId) ?? null;

  const scanPaths: ScanPath[] = selectedDevice?.scanPaths
    ? JSON.parse(selectedDevice.scanPaths)
    : [];

  const blacklist: string[] = selectedDevice?.blacklist
    ? JSON.parse(selectedDevice.blacklist)
    : [];

  const existingPaths = scanPaths.map((sp) => sp.path);

  async function updateDevice(id: number, update: Partial<Device>) {
    try {
      await fetch(`/api/devices/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update),
      });
      await loadDevices();
    } catch (err) {
      console.error("Failed to update device:", err);
    }
  }

  function handleAddPath(path: string, type: "rom" | "steam") {
    if (!selectedDevice) return;
    const updated = [...scanPaths, { path, type }];
    updateDevice(selectedDevice.id, { scanPaths: JSON.stringify(updated) } as Partial<Device>);
  }

  function handleRemovePath(index: number) {
    if (!selectedDevice) return;
    const updated = scanPaths.filter((_, i) => i !== index);
    updateDevice(selectedDevice.id, { scanPaths: JSON.stringify(updated) } as Partial<Device>);
  }

  function handleAddBlacklist() {
    if (!selectedDevice || !blacklistInput.trim()) return;
    const updated = [...blacklist, blacklistInput.trim()];
    updateDevice(selectedDevice.id, { blacklist: JSON.stringify(updated) } as Partial<Device>);
    setBlacklistInput("");
  }

  function handleRemoveBlacklist(index: number) {
    if (!selectedDevice) return;
    const updated = blacklist.filter((_, i) => i !== index);
    updateDevice(selectedDevice.id, { blacklist: JSON.stringify(updated) } as Partial<Device>);
  }

  async function handleScanDevice() {
    if (!selectedDevice) return;
    await startScan(selectedDevice.id);
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="h-8 bg-vault-surface rounded w-48 mb-6 animate-pulse" />
        <div className="h-64 bg-vault-surface rounded animate-pulse" />
      </div>
    );
  }

  if (devices.length === 0) {
    return (
      <div className="max-w-3xl mx-auto">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Devices" }]} />
        <h1 className="font-heading text-2xl font-bold mb-8">Devices</h1>
        <div className="card text-center py-12">
          <p className="text-vault-muted mb-4">No devices configured yet.</p>
          <Link
            href="/admin"
            className="text-vault-amber hover:text-vault-amber-hover transition-colors"
          >
            Add a device in Admin Settings
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Devices" }]} />
      <h1 className="font-heading text-2xl font-bold mb-8">Devices</h1>

      {/* Device selector */}
      <div className="mb-6">
        <select
          value={selectedDeviceId ?? ""}
          onChange={(e) => setSelectedDeviceId(Number(e.target.value))}
          className="bg-vault-bg border border-vault-border rounded-lg px-4 py-2 text-sm text-vault-text focus:outline-none focus:border-vault-amber transition-colors"
        >
          {devices.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} ({d.protocol === "local" ? "Local" : d.host})
            </option>
          ))}
        </select>
      </div>

      {selectedDevice && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column - File Browser */}
          <div>
            <h2 className="font-heading text-lg font-bold mb-4">File Browser</h2>
            <FileBrowser
              deviceId={selectedDevice.id}
              onAddPath={handleAddPath}
              existingPaths={existingPaths}
            />
          </div>

          {/* Right column - Configuration */}
          <div className="space-y-6">
            {/* Scan Paths */}
            <div>
              <h2 className="font-heading text-lg font-bold mb-4">Scan Paths</h2>
              {scanPaths.length === 0 ? (
                <p className="text-vault-muted text-sm">
                  No scan paths configured. Use the file browser to add paths.
                </p>
              ) : (
                <div className="space-y-2">
                  {scanPaths.map((sp, i) => (
                    <div
                      key={`${sp.path}-${i}`}
                      className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-vault-border bg-vault-surface"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded ${
                            sp.type === "rom"
                              ? "bg-purple-600/20 text-purple-400"
                              : "bg-amber-600/20 text-amber-400"
                          }`}
                        >
                          {sp.type === "rom" ? "ROM" : "Steam"}
                        </span>
                        <span className="text-sm text-vault-text truncate">{sp.path}</span>
                      </div>
                      <button
                        onClick={() => handleRemovePath(i)}
                        className="text-red-400 hover:text-red-300 text-sm shrink-0 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Blacklist */}
            <div>
              <h2 className="font-heading text-lg font-bold mb-4">Blacklist</h2>
              {blacklist.length === 0 ? (
                <p className="text-vault-muted text-sm mb-3">No blacklist entries.</p>
              ) : (
                <div className="space-y-2 mb-3">
                  {blacklist.map((entry, i) => (
                    <div
                      key={`${entry}-${i}`}
                      className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-vault-border bg-vault-surface"
                    >
                      <span className="text-sm text-vault-text truncate">{entry}</span>
                      <button
                        onClick={() => handleRemoveBlacklist(i)}
                        className="text-red-400 hover:text-red-300 text-sm shrink-0 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={blacklistInput}
                  onChange={(e) => setBlacklistInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddBlacklist()}
                  placeholder="Add blacklist entry..."
                  className="flex-1 bg-vault-bg border border-vault-border rounded-lg px-3 py-2 text-sm text-vault-text focus:outline-none focus:border-vault-amber transition-colors"
                />
                <button
                  onClick={handleAddBlacklist}
                  disabled={!blacklistInput.trim()}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-vault-border text-vault-muted hover:border-vault-muted transition-colors disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Scan Device button */}
            <button
              onClick={handleScanDevice}
              disabled={globalScanning}
              className="w-full px-6 py-3 rounded-lg font-medium text-sm bg-vault-amber text-black hover:bg-vault-amber-hover transition-all duration-200 disabled:opacity-50"
            >
              {globalScanning ? "Scanning..." : "Scan Device"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
