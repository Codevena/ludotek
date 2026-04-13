import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { detectGames } from "@/lib/upload-detector";
import { convert } from "@/lib/converter";
import {
  transferFiles,
  generateM3u,
  getTransferPath,
  transferM3u,
} from "@/lib/uploader";
import { searchIgdb } from "@/lib/igdb";
import { searchSteamGridDb } from "@/lib/steamgriddb";
import { PLATFORM_CONFIG } from "@/lib/platforms";
import { readdir, stat, rm } from "fs/promises";
import path from "path";

const UPLOAD_BASE = "/tmp/game-vault-uploads";

export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  let body: { sessionId?: string; platform?: string; gameIds?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { sessionId, platform, gameIds } = body;

  if (!sessionId || !platform || !gameIds || gameIds.length === 0) {
    return NextResponse.json(
      { error: "sessionId, platform, and gameIds are required" },
      { status: 400 }
    );
  }

  // Path traversal check (match detect route's approach)
  const sessionDir = path.resolve(UPLOAD_BASE, sessionId);
  if (!sessionDir.startsWith(UPLOAD_BASE)) {
    return NextResponse.json({ error: "Invalid sessionId" }, { status: 400 });
  }

  // Load settings for SSH and IGDB credentials
  const settings = await prisma.settings.findFirst({ where: { id: 1 } });
  if (!settings?.deckHost || !settings?.deckUser || !settings?.deckPassword) {
    return NextResponse.json(
      { error: "Steam Deck SSH credentials not configured" },
      { status: 400 }
    );
  }

  // Re-read files from session dir and rebuild game list
  let sessionFiles: { name: string; size: number; path: string }[];
  try {
    const entries = await readdir(sessionDir);
    sessionFiles = await Promise.all(
      entries.map(async (name) => {
        const filePath = path.join(sessionDir, name);
        const s = await stat(filePath);
        return { name, size: s.size, path: filePath };
      })
    );
  } catch {
    return NextResponse.json(
      { error: "Session directory not found" },
      { status: 404 }
    );
  }

  const allGames = detectGames(sessionFiles, platform);
  const selectedGames = allGames.filter((g) => gameIds.includes(g.id));

  if (selectedGames.length === 0) {
    return NextResponse.json(
      { error: "No matching games found for provided gameIds" },
      { status: 400 }
    );
  }

  const platDef = PLATFORM_CONFIG.find((p) => p.id === platform);
  const platformLabel = platDef?.label || platform;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        try {
          controller.enqueue(
            new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          /* Stream closed */
        }
      };

      send({ type: "start", totalGames: selectedGames.length });

      let succeeded = 0;
      let failed = 0;

      for (const game of selectedGames) {
        try {
          send({ type: "game-start", gameId: game.id, title: game.title, step: "convert" });

          // ── STEP 1: CONVERT ──
          let filesToTransfer: { name: string; localPath: string }[] = [];

          if (game.conversion !== "none") {
            // Files that trigger conversion (chdman reads .cue which references .bin)
            const convertibleExts =
              game.conversion === "chd"
                ? new Set([".cue", ".gdi", ".iso"])
                : new Set([".iso"]); // rvz

            const outputExt = game.conversion === "chd" ? ".chd" : ".rvz";
            // Files that are already in target format — pass through
            const alreadyConvertedExts = new Set([".chd", ".rvz"]);
            // Files implicitly consumed by conversion (.bin referenced by .cue)
            const implicitExts = new Set([".bin"]);

            for (const file of game.files) {
              const ext = path.extname(file.name).toLowerCase();

              if (convertibleExts.has(ext)) {
                // Convert this file
                const inputPath = file.path;
                const baseName = path.basename(file.name, ext);
                const outputPath = path.join(sessionDir, baseName + outputExt);

                send({ type: "convert-progress", gameId: game.id, file: file.name, percent: 0 });

                await convert({
                  inputPath,
                  outputPath,
                  format: game.conversion,
                  onProgress: (percent) => {
                    send({ type: "convert-progress", gameId: game.id, file: file.name, percent: Math.round(percent) });
                  },
                });

                send({ type: "convert-done", gameId: game.id, file: file.name });
                filesToTransfer.push({ name: baseName + outputExt, localPath: outputPath });
              } else if (alreadyConvertedExts.has(ext)) {
                // Already converted — transfer as-is
                filesToTransfer.push({ name: file.name, localPath: file.path });
              } else if (implicitExts.has(ext)) {
                // .bin files are consumed by .cue conversion — skip
              } else {
                // Unknown extension — transfer as-is
                filesToTransfer.push({ name: file.name, localPath: file.path });
              }
            }
          } else {
            // No conversion — transfer original files
            filesToTransfer = game.files.map((f) => ({
              name: f.name,
              localPath: f.path,
            }));
          }

          // ── STEP 2: TRANSFER ──
          send({ type: "game-step", gameId: game.id, step: "transfer" });

          const isMultiDisc = game.type === "multi-disc";
          const remoteDirPath = getTransferPath(platform, isMultiDisc);

          const transferJobs = filesToTransfer.map((f) => ({
            localPath: f.localPath,
            remotePath: remoteDirPath + f.name,
            onProgress: (_bytes: number, total: number) => {
              if (total > 0) {
                send({
                  type: "transfer-progress",
                  gameId: game.id,
                  percent: Math.round((_bytes / total) * 100),
                });
              }
            },
          }));

          await transferFiles(
            settings.deckHost,
            settings.deckUser,
            settings.deckPassword,
            transferJobs
          );

          // Multi-disc: generate and transfer M3U
          if (isMultiDisc) {
            const discFilenames = filesToTransfer.map((f) => f.name);
            const m3uContent = generateM3u(game.title, platform, discFilenames);
            const m3uFilename = `${game.title}.m3u`;
            await transferM3u(
              settings.deckHost,
              settings.deckUser,
              settings.deckPassword,
              m3uFilename,
              m3uContent,
              platform
            );
          }

          // ── STEP 3: SCAN (DB upsert) ──
          send({ type: "game-step", gameId: game.id, step: "scan" });

          // For DB tracking, use the first transferred file name (or M3U for multi-disc)
          const transferredFileName = isMultiDisc
            ? `${game.title}.m3u`
            : filesToTransfer[0]?.name || game.files[0].name;

          const dbGame = await prisma.game.upsert({
            where: {
              originalFile_platform: {
                originalFile: transferredFileName,
                platform,
              },
            },
            update: { title: game.title },
            create: {
              title: game.title,
              originalFile: transferredFileName,
              platform,
              platformLabel,
              source: "rom",
            },
          });

          // Update platform counts
          const count = await prisma.game.count({ where: { platform } });
          await prisma.platform.upsert({
            where: { id: platform },
            update: { gameCount: count },
            create: {
              id: platform,
              label: platformLabel,
              icon: platDef?.icon || "🎮",
              color: platDef?.color || "#6366f1",
              gameCount: count,
              sortOrder: platDef?.sortOrder || 99,
            },
          });

          // ── STEP 4: ENRICH (non-fatal) ──
          let coverUrl: string | null = null;

          if (settings.igdbClientId && settings.igdbClientSecret) {
            send({ type: "game-step", gameId: game.id, step: "enrich" });

            try {
              const igdbData = await searchIgdb(
                game.title,
                platform,
                settings.igdbClientId,
                settings.igdbClientSecret
              );

              if (igdbData) {
                coverUrl = igdbData.coverUrl;
                if (!coverUrl && settings.steamgriddbKey) {
                  coverUrl = await searchSteamGridDb(game.title, settings.steamgriddbKey);
                }

                await prisma.game.update({
                  where: { id: dbGame.id },
                  data: {
                    igdbId: igdbData.igdbId,
                    coverUrl,
                    igdbScore: igdbData.igdbScore,
                    metacriticScore: igdbData.metacriticScore,
                    genres: JSON.stringify(igdbData.genres),
                    developer: igdbData.developer,
                    publisher: igdbData.publisher,
                    releaseDate: igdbData.releaseDate,
                    summary: igdbData.summary,
                    screenshotUrls: JSON.stringify(igdbData.screenshotUrls),
                    videoIds: JSON.stringify(igdbData.videoIds),
                    artworkUrls: JSON.stringify(igdbData.artworkUrls),
                    franchise: igdbData.franchise,
                    themes: JSON.stringify(igdbData.themes),
                  },
                });
              }
            } catch (enrichErr) {
              console.warn(
                `Enrichment failed for "${game.title}":`,
                enrichErr instanceof Error ? enrichErr.message : enrichErr
              );
            }
          }

          send({
            type: "game-done",
            gameId: game.id,
            dbId: dbGame.id,
            title: game.title,
            coverUrl: coverUrl || null,
          });
          succeeded++;
        } catch (err) {
          console.error(
            `Pipeline failed for "${game.title}":`,
            err instanceof Error ? err.message : err
          );
          send({
            type: "game-error",
            gameId: game.id,
            title: game.title,
            error: err instanceof Error ? err.message : "Unknown error",
          });
          failed++;
        }
      }

      // Cleanup session directory
      try {
        await rm(sessionDir, { recursive: true, force: true });
      } catch (cleanupErr) {
        console.warn("Failed to clean up session dir:", cleanupErr);
      }

      send({
        type: "done",
        processed: selectedGames.length,
        succeeded,
        failed,
      });

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
