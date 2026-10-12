import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDecryptedDevice, getDecryptedSettings } from "@/lib/encryption";
import { assertUploadFilename, loadUploadSession, UploadInputError, validateUploadBody } from "@/lib/disc-inputs";
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
import { rm } from "fs/promises";
import path from "path";

export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  let body: ReturnType<typeof validateUploadBody>;
  try {
    body = validateUploadBody(await request.json(), true);
  } catch (error) {
    return NextResponse.json({ error: error instanceof UploadInputError ? error.message : "Invalid JSON body" }, { status: 400 });
  }

  const { sessionId, platform, gameIds } = body;

  // Load settings for IGDB credentials and determine target device
  const settings = await getDecryptedSettings();
  const rawDeviceId = body.deviceId ?? settings?.activeDeviceId;
  if (rawDeviceId === undefined || rawDeviceId === null) {
    return NextResponse.json(
      { error: "No target device specified. Select a device or set an active device." },
      { status: 400 }
    );
  }
  const targetDeviceId = rawDeviceId;
  if (typeof targetDeviceId !== "number" || !Number.isSafeInteger(targetDeviceId) || targetDeviceId <= 0) {
    return NextResponse.json(
      { error: "No target device specified. Select a device or set an active device." },
      { status: 400 }
    );
  }
  const targetDevice = await getDecryptedDevice(targetDeviceId);
  if (!targetDevice) {
    return NextResponse.json({ error: "Target device not found" }, { status: 404 });
  }
  if (targetDevice.protocol === "local") {
    return NextResponse.json({ error: "Upload to local devices is not supported yet" }, { status: 400 });
  }
  if (targetDevice.protocol === "ftp") {
    return NextResponse.json({ error: "Upload via FTP is not supported yet" }, { status: 400 });
  }

  let session: Awaited<ReturnType<typeof loadUploadSession>>;
  try {
    session = await loadUploadSession(sessionId, platform);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid upload session" },
      { status: error instanceof UploadInputError ? error.status : 400 }
    );
  }
  const { sessionDir, games: allGames, descriptorInputs } = session;
  const selectedGames = allGames.filter((g) => gameIds.includes(g.id));

  if (selectedGames.length === 0 || selectedGames.length !== new Set(gameIds).size) {
    return NextResponse.json(
      { error: "No matching games found for provided gameIds" },
      { status: 400 }
    );
  }

  const platDef = PLATFORM_CONFIG.find((p) => p.id === platform);
  const platformLabel = platDef?.label || platform;

  const discInputs = new Set(Array.from(descriptorInputs.values()).flat());
  const plans = new Map(selectedGames.map((game) => {
    const convertibleExts = game.conversion === "none" ? new Set<string>() :
      game.conversion === "chd" ? new Set([".cue", ".gdi", ".iso"]) : new Set([".iso"]);
    const conversions = game.files.filter((file) => !discInputs.has(file.path) && convertibleExts.has(path.extname(file.name).toLowerCase()));
    const outputExt = game.conversion === "chd" ? ".chd" : ".rvz";
    const plannedInputs = new Set(conversions.flatMap((file) => [file.path, ...(descriptorInputs.get(file.path) ?? [])]));
    const plannedNames = [
      ...conversions.map((file) => path.parse(file.name).name + outputExt),
      ...game.files.filter((file) => !plannedInputs.has(file.path)).map((file) => file.name),
    ];
    return [game.id, { conversions, outputExt, plannedNames }];
  }));
  // Include playlists: a raw M3U game can collide with another game's playlist.
  const remoteOwners = new Map<string, string>();
  const collidingGames = new Set<string>();
  for (const game of selectedGames) {
    const remoteDir = getTransferPath(platform, game.type === "multi-disc");
    const targets = plans.get(game.id)!.plannedNames.map((name) => remoteDir + name);
    if (game.type === "multi-disc") targets.push(getTransferPath(platform, false) + `${game.title}.m3u`);
    for (const target of targets) {
      const owner = remoteOwners.get(target);
      if (owner) { collidingGames.add(owner); collidingGames.add(game.id); }
      remoteOwners.set(target, game.id);
    }
  }

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
          const filesToTransfer: { name: string; localPath: string }[] = [];

          const { conversions, outputExt, plannedNames } = plans.get(game.id)!;
          if (plannedNames.length === 0) throw new Error("No files to transfer");
          for (const name of plannedNames) assertUploadFilename(name);
          if (collidingGames.has(game.id)) throw new Error("Colliding transfer filenames");
          if (game.type === "multi-disc") assertUploadFilename(`${game.title}.m3u`);

          // Convert first. Only successful conversions consume their actual inputs.
          const consumed = new Set<string>();
          for (const file of conversions) {
            const ext = path.extname(file.name).toLowerCase();
            const outputName = path.parse(file.name).name + outputExt;
            const outputPath = path.join(path.dirname(file.path), outputName);
            send({ type: "convert-progress", gameId: game.id, file: file.name, percent: 0 });
            await convert({
              inputPath: file.path,
              outputPath,
              format: game.conversion as "chd" | "rvz",
              chdType: platform === "ps2" && ext === ".iso" ? "dvd" : "cd",
              onProgress: (percent) => send({ type: "convert-progress", gameId: game.id, file: file.name, percent: Math.round(percent) }),
            });
            consumed.add(file.path);
            for (const input of descriptorInputs.get(file.path) ?? []) consumed.add(input);
            filesToTransfer.push({ name: outputName, localPath: outputPath });
            send({ type: "convert-done", gameId: game.id, file: file.name });
          }
          filesToTransfer.push(...game.files.filter((file) => !consumed.has(file.path)).map((file) => ({ name: file.name, localPath: file.path })));
          if (filesToTransfer.length === 0) throw new Error("No files to transfer");

          // ── STEP 2: TRANSFER ──
          send({ type: "game-step", gameId: game.id, step: "transfer" });

          const isMultiDisc = game.type === "multi-disc";
          const remoteDirPath = getTransferPath(platform, isMultiDisc);

          const transferJobs = filesToTransfer.map((f) => ({
            localPath: f.localPath,
            remotePath: remoteDirPath + f.name,
            onProgress: (bytes: number, total: number) => {
              if (total > 0) {
                send({
                  type: "transfer-progress",
                  gameId: game.id,
                  percent: Math.round((bytes / total) * 100),
                  bytes,
                  total,
                });
              }
            },
          }));

          await transferFiles(
            targetDevice.host,
            targetDevice.user,
            targetDevice.password,
            transferJobs,
            targetDevice.port
          );

          // Multi-disc: generate and transfer M3U
          if (isMultiDisc) {
            const discFilenames = filesToTransfer.map((f) => f.name);
            const m3uContent = generateM3u(game.title, platform, discFilenames);
            const m3uFilename = `${game.title}.m3u`;
            await transferM3u(
              targetDevice.host,
              targetDevice.user,
              targetDevice.password,
              m3uFilename,
              m3uContent,
              platform,
              targetDevice.port
            );
          }

          // ── STEP 3: SCAN (DB upsert) ──
          send({ type: "game-step", gameId: game.id, step: "scan" });

          // For DB tracking, use the first transferred file name (or M3U for multi-disc)
          const transferredFileName = isMultiDisc
            ? `${game.title}.m3u`
            : filesToTransfer[0].name;

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

          // Link game to target device, recording the transferred filename
          await prisma.gameDevice.upsert({
            where: { gameId_deviceId: { gameId: dbGame.id, deviceId: targetDevice.id } },
            update: { originalFile: transferredFileName },
            create: { gameId: dbGame.id, deviceId: targetDevice.id, originalFile: transferredFileName },
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

          if (settings?.igdbClientId && settings?.igdbClientSecret) {
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
