"use client";

import { useEffect, useState } from "react";
import { SetupWizard } from "@/components/setup-wizard";

export default function SetupPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/auth", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const status = await response.json();
        if (!response.ok || !status.configured) throw new Error(status.error || "Server access is not configured");
        setAuthenticated(status.authenticated === true);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setConfigured(false);
        setError(err instanceof Error ? err.message : "Unable to connect to server");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  async function login(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoggingIn(true);
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Login failed");
      setToken("");
      setAuthenticated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setLoggingIn(false);
    }
  }

  if (loading) return <p className="text-vault-muted text-center py-20">Checking access…</p>;
  if (authenticated) return <SetupWizard />;
  return (
    <div className="max-w-sm mx-auto py-20">
      <h1 className="font-heading text-2xl mb-6">{configured ? "Sign in to set up Ludotek" : "Server access unavailable"}</h1>
      {configured && <form onSubmit={login} className="card space-y-4">
        <label htmlFor="setup-token" className="text-sm block">Admin token</label>
        <input id="setup-token" type="password" autoComplete="current-password" value={token} onChange={(event) => setToken(event.target.value)} className="w-full bg-vault-bg border border-vault-border rounded-lg px-4 py-2" required />
        <button disabled={loggingIn} className="w-full bg-vault-amber text-black rounded-lg py-3 disabled:opacity-50">{loggingIn ? "Signing in…" : "Sign in"}</button>
      </form>}
      {error && <p role="alert" className="text-red-400 text-sm mt-4">{error}</p>}
    </div>
  );
}
