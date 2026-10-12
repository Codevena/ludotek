"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import UploadDropzone from "@/components/upload-dropzone";
import UploadPreview from "@/components/upload-preview";
import UploadGroupPreview from "@/components/upload-group-preview";
import UploadProgress, { type GameProgress } from "@/components/upload-progress";
import type { DetectedGame } from "@/lib/upload-detector";
import { PLATFORM_CONFIG } from "@/lib/platforms";
import {
  groupFilesByPlatform,
  type PlatformGroup,
} from "@/lib/platform-detector";

type Phase = "upload" | "grouped-preview" | "preview" | "processing" | "done";

interface FileWithPath {
  file: File;
  relativePath: string;
}

export default function UploadPage() {
  const [phase, setPhase] = useState<Phase>("upload");
  const [platform, setPlatform] = useState("");
  const [manualMode, setManualMode] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [detectedGames, setDetectedGames] = useState<DetectedGame[]>([]);
  const [gameProgress, setGameProgress] = useState<GameProgress[]>([]);
  const [totalGames, setTotalGames] = useState(0);
  const [succeeded, setSucceeded] = useState(0);
  const [failed, setFailed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [devices, setDevices] = useState<{ id: number; name: string; protocol: string }[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const transferStarts = useRef<Record<string, number>>({});

  // Auto-detect state
  const [platformGroups, setPlatformGroups] = useState<PlatformGroup[]>([]);
  const [unknownFiles, setUnknownFiles] = useState<FileWithPath[]>([]);
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
  const [totalGroups, setTotalGroups] = useState(0);
  const [currentGroupLabel, setCurrentGroupLabel] = useState("");

  // Auth state
  const [authenticated, setAuthenticated] = useState(false);
  const [authRequired, setAuthRequired] = useState<boolean | null>(null);
  const [authConfigured, setAuthConfigured] = useState(true);
  const [tokenInput, setTokenInput] = useState("");
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/auth", { cache: "no-store", signal: controller.signal })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok || !data.configured) throw new Error(data.error || "Server access is not configured");
        return data;
      })
      .then((data) => {
        setAuthRequired(data.authRequired);
        setAuthenticated(data.authenticated === true);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setAuthRequired(true);
        setAuthConfigured(false);
        setAuthError(err instanceof Error ? err.message : "Unable to connect to server");
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (authRequired === null || (authRequired && !authenticated) || !authConfigured) return;
    const controller = new AbortController();
    void fetch("/api/devices", { signal: controller.signal, cache: "no-store" }).then(async (response) => {
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.devices)) throw new Error(data.error || "Upload-Zielgeräte konnten nicht geladen werden.");
      if (!controller.signal.aborted) setDevices(data.devices);
    }).catch((failure) => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Upload-Zielgeräte konnten nicht geladen werden."); });
    return () => controller.abort();
  }, [authRequired, authenticated, authConfigured]);

  async function handleLogin() {
    setAuthError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenInput }),
      });
      if (res.ok) {
        setTokenInput("");
        setAuthenticated(true);
      } else {
        const data = await res.json().catch(() => ({}));
        setAuthError(data.error || "Login failed");
      }
    } catch {
      setAuthError("Connection failed");
    }
  }

  // --- Manual mode: old flow (select platform first, then upload) ---

  async function handleManualFilesSelected(files: FileWithPath[]) {
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      for (const { file } of files) formData.append("files", file);

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
      console.error("Manual upload failed:", err);
      setError(err instanceof Error ? err.message : String(err));
    }

    setUploading(false);
  }

  async function handleManualConfirm(gameIds: string[]) {
    if (!deviceId) { setError("Vor Verarbeitung ein Upload-Zielgerät auswählen."); return; }
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
        body: JSON.stringify({ sessionId, platform, gameIds, deviceId: Number(deviceId) }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Processing failed");
      }

      await processSSEStream(res, (s, f) => {
        setSucceeded(s);
        setFailed(f);
        setPhase("done");
      });
    } catch (err) {
      console.error("Manual processing failed:", err);
      setError(err instanceof Error ? err.message : String(err));
      setPhase("done");
    }
  }

  // --- Auto mode: drop files, auto-detect platforms ---

  function handleAutoFilesSelected(files: FileWithPath[]) {
    setError(null);
    const { groups, unknown } = groupFilesByPlatform(files);

    if (groups.length === 0) {
      // All files are unknown — fall back to manual mode
      setManualMode(true);
      setError(
        "Could not auto-detect platforms for these files. Please select a platform manually.",
      );
      return;
    }

    setPlatformGroups(groups);
    setUnknownFiles(unknown);
    setPhase("grouped-preview");
  }

  async function handleGroupConfirm(finalGroups: PlatformGroup[]) {
    if (!deviceId) { setError("Vor Verarbeitung ein Upload-Zielgerät auswählen."); return; }
    setPhase("processing");
    setError(null);
    setTotalGroups(finalGroups.length);

    let accumulatedSucceeded = 0;
    let accumulatedFailed = 0;
    let accumulatedGameCount = 0;

    for (let i = 0; i < finalGroups.length; i++) {
      const group = finalGroups[i];
      setCurrentGroupIndex(i + 1);
      setCurrentGroupLabel(group.platform.label);

      try {
        // 1. Upload files for this group
        const formData = new FormData();
        for (const { file } of group.files) formData.append("files", file);

        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!uploadRes.ok) {
          const data = await uploadRes.json();
          throw new Error(data.error || `Upload failed for ${group.platform.label}`);
        }

        const uploadData = await uploadRes.json();
        const groupSessionId = uploadData.sessionId;

        // 2. Detect games
        const detectRes = await fetch("/api/upload/detect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: groupSessionId,
            platform: group.platformId,
          }),
        });

        if (!detectRes.ok) {
          const data = await detectRes.json();
          throw new Error(
            data.error || `Detection failed for ${group.platform.label}`,
          );
        }

        const detectData = await detectRes.json();
        const games: DetectedGame[] = detectData.games;
        const gameIds = games.map((g) => g.id);

        if (gameIds.length === 0) {
          continue;
        }

        // Set up progress for this group's games
        const groupGameProgress: GameProgress[] = games.map((g) => ({
          gameId: g.id,
          title: g.title,
          status: "queued" as const,
        }));

        setGameProgress((prev) => [...prev, ...groupGameProgress]);
        setTotalGames((prev) => prev + gameIds.length);
        accumulatedGameCount += gameIds.length;

        // Reset transfer speed tracking for new group
        transferStarts.current = {};

        // 3. Process games via SSE
        const processRes = await fetch("/api/upload/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: groupSessionId,
            platform: group.platformId,
            gameIds,
            deviceId: Number(deviceId),
          }),
        });

        if (!processRes.ok) {
          const data = await processRes.json();
          throw new Error(
            data.error || `Processing failed for ${group.platform.label}`,
          );
        }

        let groupSucceeded = 0;
        let groupFailed = 0;

        await processSSEStream(processRes, (s, f) => {
          groupSucceeded = s;
          groupFailed = f;
        });

        // Accumulate results
        accumulatedSucceeded += groupSucceeded;
        accumulatedFailed += groupFailed;
      } catch (err) {
        console.error(`Group processing failed for ${group.platform.label}:`, err);
        setError(err instanceof Error ? err.message : String(err));
        break;
      }
    }

    setSucceeded(accumulatedSucceeded);
    setFailed(accumulatedFailed);
    setTotalGames(accumulatedGameCount);
    setPhase("done");
  }

  // --- Shared SSE stream processor ---

  async function processSSEStream(
    res: Response,
    onDone: (succeeded: number, failed: number) => void,
  ) {
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
            let transferSpeed: string | undefined;
            if (data.bytes && data.total) {
              const startKey = `_ts_${data.gameId}`;
              if (!transferStarts.current[startKey]) {
                transferStarts.current[startKey] = Date.now();
              }
              const elapsed =
                (Date.now() - transferStarts.current[startKey]) / 1000;
              if (elapsed > 0.5) {
                const speed = data.bytes / elapsed;
                if (speed >= 1e6)
                  transferSpeed = `${(speed / 1e6).toFixed(1)} MB/s`;
                else if (speed >= 1e3)
                  transferSpeed = `${(speed / 1e3).toFixed(0)} KB/s`;
                else transferSpeed = `${Math.round(speed)} B/s`;
              }
            }
            setGameProgress((prev) =>
              prev.map((g) =>
                g.gameId === data.gameId
                  ? { ...g, transferPercent: data.percent, transferSpeed }
                  : g,
              ),
            );
          } else if (data.type === "game-plan") {
            if (typeof data.planId === "string" && /^[0-9a-f-]{36}$/i.test(data.planId)) {
              setGameProgress((prev) => prev.map((g) => g.gameId === data.gameId ? { ...g, planId: data.planId } : g));
            }
          } else if (data.type === "enrich-skipped" || data.type === "enrich-error") {
            setGameProgress((prev) => prev.map((g) => g.gameId === data.gameId ? {
              ...g,
              enrichmentStatus: data.type === "enrich-skipped" ? "skipped" : "error",
              enrichmentWarning: data.reason || data.error || "Metadata unavailable",
            } : g));
          } else if (data.type === "game-done") {
            setGameProgress((prev) =>
              prev.map((g) =>
                g.gameId === data.gameId
                  ? {
                      ...g,
                      status: "done",
                      dbId: data.dbId,
                      planId: data.planId ?? g.planId,
                      coverUrl: data.coverUrl,
                    }
                  : g,
              ),
            );
          } else if (data.type === "game-error") {
            setGameProgress((prev) =>
              prev.map((g) =>
                g.gameId === data.gameId
                  ? { ...g, status: "failed", error: data.error, planId: data.planId ?? g.planId }
                  : g,
              ),
            );
          } else if (data.type === "done") {
            onDone(data.succeeded, data.failed);
          }
        } catch {
          // skip malformed events
        }
      }
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
  if (!authConfigured) {
    return <div className="max-w-sm mx-auto py-20"><div className="card"><h1 className="font-heading text-xl mb-3">Server access unavailable</h1><p className="text-vault-muted text-sm">{authError}</p></div></div>;
  }
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
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Admin", href: "/admin" },
          { label: "Upload ROMs" },
        ]}
      />

      <h1 className="font-heading text-2xl font-bold mb-8">Upload ROMs</h1>
      <div className="card mb-6 space-y-2">
        <label htmlFor="upload-device" className="block text-sm text-vault-muted">Upload-Zielgerät</label>
        <select id="upload-device" value={deviceId} disabled={uploading || phase === "processing"} onChange={(event) => setDeviceId(event.target.value)} className={inputClass}>
          <option value="">Vorhandenes Gerät ausdrücklich auswählen</option>
          {devices.map((device) => <option key={device.id} value={device.id}>{device.name} · {device.protocol}</option>)}
        </select>
        <p className="text-xs text-vault-muted">Das gespeicherte Geräteprofil bestimmt ROM-Wurzeln, Formate und Speicherreserve. Nicht belegte Schreibfähigkeiten werden vor Geräteänderungen abgelehnt.</p>
        {devices.length === 0 && <Link href="/admin" className="text-sm text-vault-amber">Zuerst ein Zielgerät hinzufügen</Link>}
      </div>

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

      {/* Phase: upload */}
      {phase === "upload" && (
        <div>
          {manualMode && !platform && (
            <>
              {/* Manual mode: platform selection grid */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-heading text-lg text-vault-text">
                  Select Platform
                </h2>
                <button
                  onClick={() => {
                    setManualMode(false);
                    setError(null);
                  }}
                  className="text-vault-muted hover:text-vault-text text-sm transition-colors"
                >
                  ← Back to Smart Upload
                </button>
              </div>
              <div className="flex flex-wrap gap-3">
                {PLATFORM_CONFIG.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setPlatform(p.id);
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all bg-vault-surface text-vault-text hover:bg-vault-border"
                  >
                    <span>{p.icon}</span>
                    <span>{p.label}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {manualMode && platform && (
            <>
              {/* Manual mode: platform selected, show dropzone */}
              <div className="flex items-center gap-3 mb-6">
                <button
                  onClick={() => {
                    setPlatform("");
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
                onFilesSelected={handleManualFilesSelected}
                disabled={uploading || !deviceId}
              />
            </>
          )}

          {!manualMode && (
            <>
              {/* Auto mode: show dropzone immediately */}
              <UploadDropzone
                onFilesSelected={handleAutoFilesSelected}
                disabled={uploading || !deviceId}
              />
              <div className="mt-3 text-center">
                <button
                  onClick={() => setManualMode(true)}
                  className="text-vault-muted hover:text-vault-text text-xs transition-colors underline underline-offset-2"
                >
                  Manual mode — select platform first
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Phase: grouped-preview (auto mode) */}
      {phase === "grouped-preview" && (
        <div>
          <button
            onClick={() => {
              setPlatformGroups([]);
              setUnknownFiles([]);
              setPhase("upload");
            }}
            className="text-vault-muted hover:text-vault-text text-sm mb-6 inline-block transition-colors"
          >
            ← Upload Different Files
          </button>
          <UploadGroupPreview
            groups={platformGroups}
            unknownFiles={unknownFiles}
            onConfirm={handleGroupConfirm}
            disabled={uploading || !deviceId}
          />
        </div>
      )}

      {/* Phase: preview (manual mode) */}
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
            onConfirm={handleManualConfirm}
            disabled={!deviceId}
          />
        </div>
      )}

      {/* Phase: processing */}
      {phase === "processing" && (
        <div>
          {totalGroups > 1 && (
            <div className="card mb-4 border-vault-amber/30">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full bg-vault-amber animate-pulse" />
                <span className="text-sm text-vault-text">
                  Processing group {currentGroupIndex} of {totalGroups}:{" "}
                  <span className="font-medium text-vault-amber">
                    {currentGroupLabel}
                  </span>
                </span>
              </div>
            </div>
          )}
          <UploadProgress
            games={gameProgress}
            totalGames={totalGames}
            isComplete={false}
            succeeded={0}
            failed={0}
          />
        </div>
      )}

      {/* Phase: done */}
      {phase === "done" && (
        <UploadProgress
          games={gameProgress}
          totalGames={totalGames}
          isComplete={true}
          succeeded={succeeded}
          failed={failed}
        />
      )}
    </div>
  );
}
