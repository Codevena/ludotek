"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import UploadDropzone from "@/components/upload-dropzone";
import UploadPreview from "@/components/upload-preview";
import UploadProgress, { type GameProgress } from "@/components/upload-progress";
import type { DetectedGame } from "@/lib/upload-detector";
import { PLATFORM_CONFIG } from "@/lib/platforms";

type Phase = "select" | "upload" | "preview" | "processing" | "done";

export default function UploadPage() {
  const [phase, setPhase] = useState<Phase>("select");
  const [platform, setPlatform] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [detectedGames, setDetectedGames] = useState<DetectedGame[]>([]);
  const [gameProgress, setGameProgress] = useState<GameProgress[]>([]);
  const [totalGames, setTotalGames] = useState(0);
  const [succeeded, setSucceeded] = useState(0);
  const [failed, setFailed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Auth state
  const [authenticated, setAuthenticated] = useState(false);
  const [authRequired, setAuthRequired] = useState<boolean | null>(null);
  const [tokenInput, setTokenInput] = useState("");
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((data) => {
        setAuthRequired(data.authRequired);
        if (!data.authRequired) {
          setAuthenticated(true);
        } else {
          fetch("/api/settings")
            .then((r) => {
              if (r.ok) {
                setAuthenticated(true);
              }
            })
            .catch(() => {});
        }
      });
  }, []);

  async function handleLogin() {
    setAuthError("");
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: tokenInput }),
    });
    if (res.ok) {
      setAuthenticated(true);
    } else {
      setAuthError("Invalid token");
    }
  }

  async function handleFilesSelected(files: File[]) {
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      for (const file of files) formData.append("files", file);

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        const data = await uploadRes.json();
        throw new Error(data.error || "Upload failed");
      }

      const uploadData = await uploadRes.json();
      const newSessionId = uploadData.sessionId;
      setSessionId(newSessionId);

      const detectRes = await fetch("/api/upload/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: newSessionId, platform }),
      });

      if (!detectRes.ok) {
        const data = await detectRes.json();
        throw new Error(data.error || "Detection failed");
      }

      const detectData = await detectRes.json();
      setDetectedGames(detectData.games);
      setPhase("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }

    setUploading(false);
  }

  async function handleConfirm(gameIds: string[]) {
    setPhase("processing");
    setError(null);
    setGameProgress(
      detectedGames
        .filter((g) => gameIds.includes(g.id))
        .map((g) => ({
          gameId: g.id,
          title: g.title,
          status: "queued" as const,
        })),
    );

    try {
      const res = await fetch("/api/upload/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, platform, gameIds }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Processing failed");
      }

      const reader = res.body?.getReader();
      if (!reader) {
        throw new Error("No response body");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));

            if (data.type === "start") {
              setTotalGames(data.totalGames);
            } else if (data.type === "game-start") {
              setGameProgress((prev) =>
                prev.map((g) =>
                  g.gameId === data.gameId
                    ? { ...g, status: "processing", step: data.step }
                    : g,
                ),
              );
            } else if (data.type === "convert-progress") {
              setGameProgress((prev) =>
                prev.map((g) =>
                  g.gameId === data.gameId
                    ? { ...g, convertPercent: data.percent }
                    : g,
                ),
              );
            } else if (data.type === "game-step") {
              setGameProgress((prev) =>
                prev.map((g) =>
                  g.gameId === data.gameId
                    ? {
                        ...g,
                        step: data.step,
                        convertPercent: undefined,
                        transferPercent: undefined,
                      }
                    : g,
                ),
              );
            } else if (data.type === "transfer-progress") {
              setGameProgress((prev) =>
                prev.map((g) =>
                  g.gameId === data.gameId
                    ? { ...g, transferPercent: data.percent }
                    : g,
                ),
              );
            } else if (data.type === "game-done") {
              setGameProgress((prev) =>
                prev.map((g) =>
                  g.gameId === data.gameId
                    ? {
                        ...g,
                        status: "done",
                        dbId: data.dbId,
                        coverUrl: data.coverUrl,
                      }
                    : g,
                ),
              );
            } else if (data.type === "game-error") {
              setGameProgress((prev) =>
                prev.map((g) =>
                  g.gameId === data.gameId
                    ? { ...g, status: "failed", error: data.error }
                    : g,
                ),
              );
            } else if (data.type === "done") {
              setSucceeded(data.succeeded);
              setFailed(data.failed);
              setPhase("done");
            }
          } catch {
            // skip malformed events
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase("done");
    }
  }

  const inputClass =
    "w-full bg-vault-bg border border-vault-border rounded-lg px-4 py-2 text-sm text-vault-text focus:outline-none focus:border-vault-amber transition-colors";

  // Loading state
  if (authRequired === null) {
    return (
      <div className="max-w-3xl mx-auto flex items-center justify-center py-20">
        <div className="w-6 h-6 rounded-full bg-vault-amber animate-pulse" />
      </div>
    );
  }

  // Login gate
  if (authRequired && !authenticated) {
    return (
      <div className="max-w-sm mx-auto py-20">
        <h1 className="font-heading text-2xl font-bold mb-6 text-center">
          Admin Login
        </h1>
        <div className="card space-y-4">
          <div>
            <label className="text-vault-muted text-xs mb-1 block">
              Admin Token
            </label>
            <input
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              placeholder="Enter admin token..."
              className={inputClass}
            />
          </div>
          {authError && <p className="text-red-400 text-sm">{authError}</p>}
          <button
            onClick={handleLogin}
            className="w-full px-6 py-3 rounded-lg font-medium text-sm bg-vault-amber text-black hover:bg-vault-amber-hover transition-all"
          >
            Login
          </button>
        </div>
        <Link
          href="/admin"
          className="text-vault-muted hover:text-vault-text text-sm mt-4 block text-center"
        >
          ← Back to Admin
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <Breadcrumbs items={[
        { label: "Home", href: "/" },
        { label: "Admin", href: "/admin" },
        { label: "Upload ROMs" },
      ]} />

      <h1 className="font-heading text-2xl font-bold mb-8">Upload ROMs</h1>

      {/* Error display */}
      {error && (
        <div className="card mb-6 border-red-500/50">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Uploading indicator */}
      {uploading && (
        <div className="card mb-6 border-vault-amber/50">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-full bg-vault-amber animate-pulse" />
            <span className="text-sm text-vault-muted">
              Uploading and analyzing files...
            </span>
          </div>
        </div>
      )}

      {/* Phase: select */}
      {phase === "select" && (
        <div className="flex flex-wrap gap-3">
          {PLATFORM_CONFIG.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setPlatform(p.id);
                setPhase("upload");
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all bg-vault-surface text-vault-text hover:bg-vault-border"
            >
              <span>{p.icon}</span>
              <span>{p.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Phase: upload */}
      {phase === "upload" && (
        <div>
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => {
                setPlatform("");
                setPhase("select");
              }}
              className="text-vault-muted hover:text-vault-text text-sm transition-colors"
            >
              ← Change Platform
            </button>
            <span className="text-sm font-medium text-vault-amber">
              {PLATFORM_CONFIG.find((p) => p.id === platform)?.icon}{" "}
              {PLATFORM_CONFIG.find((p) => p.id === platform)?.label}
            </span>
          </div>
          <UploadDropzone
            onFilesSelected={handleFilesSelected}
            disabled={uploading}
          />
        </div>
      )}

      {/* Phase: preview */}
      {phase === "preview" && (
        <div>
          <button
            onClick={() => {
              setDetectedGames([]);
              setSessionId(null);
              setPhase("upload");
            }}
            className="text-vault-muted hover:text-vault-text text-sm mb-6 inline-block transition-colors"
          >
            ← Upload Different Files
          </button>
          <UploadPreview
            games={detectedGames}
            onConfirm={handleConfirm}
            disabled={false}
          />
        </div>
      )}

      {/* Phase: processing / done */}
      {(phase === "processing" || phase === "done") && (
        <UploadProgress
          games={gameProgress}
          totalGames={totalGames}
          isComplete={phase === "done"}
          succeeded={succeeded}
          failed={failed}
        />
      )}
    </div>
  );
}
