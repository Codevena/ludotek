import type { Prisma, PrismaClient } from "@prisma/client";
import type { ScannedFile } from "@/lib/scanner";
import { randomUUID } from "node:crypto";
import path from "node:path";

export async function persistDeviceManifest(
  db: PrismaClient | Prisma.TransactionClient,
  deviceId: number,
  files: ScannedFile[],
  complete: boolean,
  gameIds: ReadonlyMap<string, number>,
  options: { assertOwned?: (tx: Prisma.TransactionClient) => Promise<void>; signal?: AbortSignal } = {},
): Promise<void> {
  if (!Number.isSafeInteger(deviceId) || deviceId < 1 || files.length > 100000) throw new Error("Invalid device manifest");
  const paths = new Set<string>();
  for (const file of files) {
    const relative = path.posix.relative(file.scanRoot, file.path);
    if (!file.path.startsWith("/") || !file.scanRoot.startsWith("/") || !relative || relative.startsWith("../") || relative === ".." || path.posix.isAbsolute(relative) ||
        /[\x00-\x1f\x7f]/.test(file.path) || path.posix.normalize(file.path) !== file.path || paths.has(file.path) ||
        !Number.isSafeInteger(file.size) || file.size < 0 || !["file", "directory", "symlink"].includes(file.type)) {
      throw new Error("Invalid physical manifest entry");
    }
    paths.add(file.path);
  }
  const generation = randomUUID();
  const seenAt = new Date();
  const persist = async (tx: Prisma.TransactionClient) => {
    await options.assertOwned?.(tx);
    options.signal?.throwIfAborted();
    const previous = await tx.deviceFile.findMany({ where: { deviceId }, select: { path: true, size: true, modifiedAt: true, kind: true, sha256: true } });
    const existing = new Map(previous.map((file) => [file.path, file]));
    for (const file of files) {
      options.signal?.throwIfAborted();
      const old = existing.get(file.path);
      const modifiedAt = file.modifiedAt ?? null;
      const size = BigInt(file.size);
      // Metadata cannot prove content equality, but changed metadata proves a
      // previous integrity result stale. Plans always rehash before mutation.
      const unchanged = old && old.size === size && old.modifiedAt === modifiedAt && old.kind === file.type;
      const data = {
        gameId: file.type === "symlink" ? null : gameIds.get(file.gameKey ?? "") ?? null,
        scanRoot: file.scanRoot, platformAlias: file.platformAlias, relativePath: file.relativePath,
        platform: file.platform, source: file.source, kind: file.type, size, modifiedAt,
        sha256: unchanged ? old.sha256 : null, generation, seenAt,
      };
      await tx.deviceFile.upsert({ where: { deviceId_path: { deviceId, path: file.path } },
        update: data, create: { deviceId, path: file.path, ...data } });
    }
    // Save inventory has a separate declared-root contract and must not be
    // erased by a complete ROM/Steam scan.
    if (complete) await tx.deviceFile.deleteMany({ where: { deviceId, source: { in: ["rom", "steam"] }, generation: { not: generation } } });
    options.signal?.throwIfAborted();
    await tx.deviceInventory.upsert({ where: { deviceId },
      update: { generation, complete, scannedAt: seenAt }, create: { deviceId, generation, complete, scannedAt: seenAt } });
  };
  if ("$transaction" in db) await db.$transaction(persist, { maxWait: 5000, timeout: 60000 });
  else await persist(db);
}

/** Legacy GameDevice representatives never supply authoritative filesystem paths. */
export async function getConfirmedGameFiles(db: PrismaClient | Prisma.TransactionClient, gameId: number) {
  const files = await db.deviceFile.findMany({ where: { gameId, kind: "file" },
    include: { device: { select: { id: true, name: true } } }, orderBy: [{ deviceId: "asc" }, { path: "asc" }] });
  return files.map((file) => ({ fileId: file.id, deviceId: file.deviceId, deviceName: file.device.name,
    filePath: file.path, fileName: path.posix.basename(file.path) }));
}
