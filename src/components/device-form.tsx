"use client";

import { useState, useEffect } from "react";

export interface DeviceFormData {
  name: string;
  type: string;
  protocol: string;
  host: string;
  port: number;
  user: string;
  password: string;
}

interface DeviceFormProps {
  initial?: Partial<DeviceFormData>;
  onSubmit: (data: DeviceFormData) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
}

const TYPE_DEFAULTS: Record<string, { protocol: string; port: number; user: string }> = {
  steamdeck: { protocol: "ssh", port: 22, user: "deck" },
  android: { protocol: "ftp", port: 21, user: "" },
  custom: { protocol: "ssh", port: 22, user: "" },
};

const PROTOCOL_PORT: Record<string, number> = {
  ssh: 22,
  ftp: 21,
};

const inputClass =
  "w-full bg-vault-bg border border-vault-border rounded-lg px-3 py-2 text-sm text-vault-text placeholder-vault-muted focus:outline-none focus:border-vault-amber/50";

const activeToggle = "border-vault-amber bg-vault-amber/10 text-vault-amber";
const inactiveToggle = "border-vault-border text-vault-muted hover:border-vault-muted";

function toggleBtnClass(active: boolean) {
  return `px-4 py-2 text-sm rounded-lg border transition-colors ${active ? activeToggle : inactiveToggle}`;
}

export function DeviceForm({ initial, onSubmit, onCancel, submitLabel = "Save" }: DeviceFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState(initial?.type ?? "steamdeck");
  const [protocol, setProtocol] = useState(initial?.protocol ?? "ssh");
  const [host, setHost] = useState(initial?.host ?? "");
  const [port, setPort] = useState(initial?.port ?? 22);
  const [user, setUser] = useState(initial?.user ?? "deck");
  const [password, setPassword] = useState(initial?.password ?? "");

  const [submitting, setSubmitting] = useState(false);
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testMessage, setTestMessage] = useState("");

  // When type changes, apply defaults
  function handleTypeChange(newType: string) {
    setType(newType);
    const defaults = TYPE_DEFAULTS[newType];
    if (defaults) {
      setProtocol(defaults.protocol);
      setPort(defaults.port);
      setUser(defaults.user);
    }
    setTestStatus("idle");
  }

  // When protocol changes, update port
  function handleProtocolChange(newProtocol: string) {
    setProtocol(newProtocol);
    setPort(PROTOCOL_PORT[newProtocol] ?? 22);
    setTestStatus("idle");
  }

  async function handleTestConnection() {
    setTestStatus("testing");
    setTestMessage("");
    try {
      const res = await fetch("/api/devices/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ protocol, host, port, user, password }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestStatus("success");
        setTestMessage("Connected!");
      } else {
        setTestStatus("error");
        setTestMessage(data.error ?? "Connection failed");
      }
    } catch {
      setTestStatus("error");
      setTestMessage("Connection failed");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({ name, type, protocol, host, port, user, password });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Name */}
      <div>
        <label className="block text-sm text-vault-muted mb-1">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Steam Deck"
          className={inputClass}
          required
        />
      </div>

      {/* Type */}
      <div>
        <label className="block text-sm text-vault-muted mb-1">Type</label>
        <div className="flex gap-2">
          {[
            { value: "steamdeck", label: "Steam Deck" },
            { value: "android", label: "Android" },
            { value: "custom", label: "Custom" },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={toggleBtnClass(type === opt.value)}
              onClick={() => handleTypeChange(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Protocol */}
      <div>
        <label className="block text-sm text-vault-muted mb-1">Protocol</label>
        <div className="flex gap-2">
          {[
            { value: "ssh", label: "SSH" },
            { value: "ftp", label: "FTP" },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={toggleBtnClass(protocol === opt.value)}
              onClick={() => handleProtocolChange(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Host + Port */}
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <label className="block text-sm text-vault-muted mb-1">Host</label>
          <input
            type="text"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="192.168.1.100"
            className={inputClass}
            required
          />
        </div>
        <div>
          <label className="block text-sm text-vault-muted mb-1">Port</label>
          <input
            type="number"
            value={port}
            onChange={(e) => setPort(Number(e.target.value))}
            className={inputClass}
            required
            min={1}
            max={65535}
          />
        </div>
      </div>

      {/* User + Password */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm text-vault-muted mb-1">User</label>
          <input
            type="text"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            placeholder="username"
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm text-vault-muted mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className={inputClass}
          />
        </div>
      </div>

      {/* Test Connection */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleTestConnection}
          disabled={testStatus === "testing" || !host}
          className="px-4 py-2 text-sm rounded-lg border border-vault-border text-vault-muted hover:border-vault-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {testStatus === "testing" ? "Testing..." : "Test Connection"}
        </button>
        {testStatus === "success" && (
          <span className="text-sm text-green-400">{testMessage}</span>
        )}
        {testStatus === "error" && (
          <span className="text-sm text-red-400">{testMessage}</span>
        )}
      </div>

      {/* Submit + Cancel */}
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="bg-vault-amber text-black hover:bg-vault-amber-hover px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          {submitting ? "Saving..." : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm rounded-lg border border-vault-border text-vault-muted hover:border-vault-muted transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
