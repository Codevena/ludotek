import path from "node:path";
import type { Device, PrismaClient } from "@prisma/client";
import { scanDevice, type ScannedFile } from "@/lib/scanner";
import type { DeviceJobs } from "@/lib/device-jobs";
import { resolveLocalPath } from "@/lib/local-paths";

export type DoctorFindingKind = "missing" | "extra" | "changed" | "legacy" | "stale" | "unsafe" | "unknown";
export interface DoctorFinding {
  kind: DoctorFindingKind;
  path?: string;
  gameId?: number;
  title?: string;
  legacyFile?: string | null;
  detail: string;
  repair: "rescan" | "review" | null;
  expected?: { size: string; modifiedAt: string | null; kind: string };
  actual?: { size: string; modifiedAt: string | null; kind: string };
}
export interface DoctorSummary {
  observed: number;
  manifest: number;
  links: number;
  unchanged: number;
  counts: Record<DoctorFindingKind, number>;
  truncated: boolean;
}
export interface DoctorSnapshot { complete: boolean; findings: DoctorFinding[]; summary: DoctorSummary }
export interface DoctorPage extends DoctorSnapshot { reportId: string; total: number; nextOffset: number | null; createdAt: string }
type Manifest = { id: number; deviceId: number; gameId: number | null; path: string; scanRoot: string; size: bigint; modifiedAt: string | null; kind: string; generation: string };
type CatalogLink = { gameId: number; originalFile: string | null; title: string };
const LIMIT = 100000;
const MAX_SNAPSHOT_BYTES = 16 * 1024 * 1024;

function withinRoots(filename: string, roots: string[]): boolean {
  return filename.startsWith("/") && filename.length <= 8192 && path.posix.normalize(filename) === filename && !/[\\\x00-\x1f\x7f]/.test(filename) && roots.some((root) => filename !== root && filename.startsWith(root === "/" ? "/" : `${root}/`));
}

/** Metadata comparison only. A matching size/mtime is not a content hash. */
export function buildDoctorSnapshot(input: {
  observed: ScannedFile[];
  reliable: boolean;
  manifest: Manifest[];
  inventory: { generation: string; complete: boolean } | null;
  links: CatalogLink[];
  roots: string[];
}): DoctorSnapshot {
  const findings: DoctorFinding[] = [];
  let findingBytes = 0;
  const counts: DoctorSummary["counts"] = { missing: 0, extra: 0, changed: 0, legacy: 0, stale: 0, unsafe: 0, unknown: 0 };
  let truncated = [input.observed.length, input.manifest.length, input.links.length].some((length) => length > LIMIT);
  let complete = input.reliable && !truncated;
  let unchanged = 0;
  const observed = new Map<string, ScannedFile>();
  const manifest = new Map(input.manifest.slice(0, LIMIT).map((entry) => [entry.path, entry]));
  const titles = new Map(input.links.slice(0, LIMIT).map((link) => [link.gameId, link.title]));
  const add = (finding: DoctorFinding) => {
    counts[finding.kind]++;
    const bytes = Buffer.byteLength(JSON.stringify(finding)) + 1;
    if (findings.length < LIMIT && findingBytes + bytes <= MAX_SNAPSHOT_BYTES) { findings.push(finding); findingBytes += bytes; }
    else { truncated = true; complete = false; }
  };
  for (const entry of input.observed.slice(0, LIMIT)) {
    if (observed.has(entry.path) || !withinRoots(entry.path, input.roots) || !Number.isSafeInteger(entry.size) || entry.size < 0 || !["file", "directory", "symlink"].includes(entry.type)) {
      complete = false;
      add({ kind: "unsafe", path: entry.path, detail: "Der Inventareintrag liegt außerhalb der bestätigten Wurzeln oder ist nicht eindeutig.", repair: null });
      continue;
    }
    observed.set(entry.path, entry);
  }
  // Final completeness is known before deciding whether an unseen item is missing.
  if (input.manifest.some((entry) => !withinRoots(entry.path, input.roots))) complete = false;
  for (const entry of input.manifest.slice(0, LIMIT)) {
    const association = entry.gameId === null ? {} : { gameId: entry.gameId, ...(titles.has(entry.gameId) ? { title: titles.get(entry.gameId) } : {}) };
    const expected = { size: entry.size.toString(), modifiedAt: entry.modifiedAt, kind: entry.kind };
    if (!withinRoots(entry.path, input.roots)) {
      add({ kind: "unsafe", path: entry.path, ...association, expected, detail: "Der gespeicherte Pfad gehört nicht zu den aktuellen Scanwurzeln.", repair: null });
      continue;
    }
    const actual = observed.get(entry.path);
    if (!actual) {
      add({ kind: complete ? "missing" : "unknown", path: entry.path, ...association, expected, detail: complete ? "Die bestätigte Datei fehlt im vollständigen Inventar." : "Dieser gespeicherte Pfad wurde im unvollständigen Inventar nicht bestätigt.", repair: "rescan" });
      continue;
    }
    const actualMetadata = { size: String(actual.size), modifiedAt: actual.modifiedAt ?? null, kind: actual.type };
    if (actual.type === "symlink" || !["file", "directory"].includes(entry.kind)) {
      add({ kind: "unsafe", path: entry.path, ...association, expected, actual: actualMetadata, detail: "Symlinks und unbekannte Dateitypen werden nicht automatisch bearbeitet.", repair: null });
      continue;
    }
    if (!input.inventory?.complete || input.inventory.generation !== entry.generation) {
      add({ kind: "stale", path: entry.path, ...association, expected, actual: actualMetadata, detail: "Der gespeicherte Eintrag stammt nicht aus der letzten vollständigen Manifestgeneration.", repair: "rescan" });
    }
    if (entry.size !== BigInt(actual.size) || entry.modifiedAt !== (actual.modifiedAt ?? null) || entry.kind !== actual.type) {
      add({ kind: "changed", path: entry.path, ...association, expected, actual: actualMetadata, detail: "Größe, Änderungszeit oder Dateityp haben sich gegenüber dem Manifest geändert.", repair: "rescan" });
    } else if (entry.gameId === null && actual.type === "file") {
      add({ kind: "unknown", path: entry.path, expected, actual: actualMetadata, detail: "Die physische Datei hat keine bestätigte Spielzuordnung; sie kann ein Track, Descriptor oder sonstige Datei sein.", repair: "rescan" });
    } else unchanged++;
  }
  for (const entry of observed.values()) {
    if (manifest.has(entry.path)) continue;
    if (entry.type === "symlink") {
      add({ kind: "unsafe", path: entry.path, detail: "Dieser zusätzliche Eintrag ist ein Symlink und wird nicht automatisch bearbeitet.", repair: null });
    } else {
      add({ kind: "extra", path: entry.path, actual: { size: String(entry.size), modifiedAt: entry.modifiedAt ?? null, kind: entry.type },
        detail: "Dieser tatsächliche Pfad fehlt im gespeicherten Manifest.", repair: complete && entry.type === "file" ? "review" : "rescan" });
    }
  }
  const confirmedGames = new Set(input.manifest.slice(0, LIMIT).flatMap((entry) => entry.gameId === null ? [] : [entry.gameId]));
  for (const link of input.links.slice(0, LIMIT)) {
    if (!confirmedGames.has(link.gameId)) add({ kind: "legacy", gameId: link.gameId, title: link.title, legacyFile: link.originalFile,
      detail: "Dieser Kataloglink besitzt keinen bestätigten physischen Manifestpfad. Ein vollständiger Scan muss die Zuordnung prüfen.", repair: "rescan" });
  }
  // Findings limits may make the snapshot incomplete after an earlier classification.
  if (!complete) {
    counts.unknown += counts.missing;
    counts.missing = 0;
    for (const finding of findings) {
      if (finding.kind === "missing") { finding.kind = "unknown"; finding.detail = "Dieser Pfad bleibt ohne vollständiges Inventar unbestätigt."; }
      if (finding.repair === "review") finding.repair = "rescan";
    }
  }
  findings.sort((left, right) => (left.path ?? `~${left.gameId}`).localeCompare(right.path ?? `~${right.gameId}`) || left.kind.localeCompare(right.kind));
  return { complete, findings, summary: { observed: observed.size, manifest: Math.min(input.manifest.length, LIMIT), links: Math.min(input.links.length, LIMIT), unchanged, counts, truncated } };
}

export async function runSyncDoctor(db: PrismaClient, device: Device, jobs: DeviceJobs, scanner: typeof scanDevice = scanDevice): Promise<DoctorPage> {
  const scanPaths: unknown = JSON.parse(device.scanPaths ?? "[]");
  const blacklist: unknown = JSON.parse(device.blacklist ?? "[]");
  if (!["ssh", "ftp", "local"].includes(device.protocol) || !Array.isArray(scanPaths) || scanPaths.length < 1 || scanPaths.length > 32 ||
    !scanPaths.every((item) => item && typeof item.path === "string" && item.path.length <= 8192 && item.path.startsWith("/") && path.posix.normalize(item.path) === item.path && !/[\\\x00-\x1f\x7f]/.test(item.path) && ["rom", "steam"].includes(item.type)) ||
    !Array.isArray(blacklist) || !blacklist.every((item) => typeof item === "string")) throw new Error("Invalid Doctor device configuration");
  await jobs.assertActive();
  const roots: string[] = [];
  for (const scanPath of scanPaths) {
    roots.push(device.protocol === "local" ? await resolveLocalPath(scanPath.path) : scanPath.path);
    await jobs.assertActive();
  }
  const [manifest, inventory, links] = await Promise.all([
    db.deviceFile.findMany({ where: { deviceId: device.id }, orderBy: { path: "asc" }, take: LIMIT + 1 }),
    db.deviceInventory.findUnique({ where: { deviceId: device.id } }),
    db.gameDevice.findMany({ where: { deviceId: device.id }, include: { game: { select: { title: true } } }, orderBy: { id: "asc" }, take: LIMIT + 1 }),
  ]);
  await jobs.assertActive();
  const result = await scanner({ ...device, protocol: device.protocol as "ssh" | "ftp" | "local", scanPaths, blacklist }, undefined,
    { signal: jobs.signal, assertActive: () => jobs.assertActive() });
  await jobs.assertActive();
  const snapshot = buildDoctorSnapshot({ observed: result.files, reliable: result.reliable, manifest, inventory,
    links: links.map((link) => ({ gameId: link.gameId, originalFile: link.originalFile, title: link.game.title })), roots });
  await jobs.assertActive();
  const stored = await db.doctorReport.create({ data: { deviceId: device.id, complete: snapshot.complete, findings: JSON.stringify(snapshot.findings), summary: JSON.stringify(snapshot.summary) } });
  return { ...snapshot, reportId: stored.id, createdAt: stored.createdAt.toISOString(), findings: snapshot.findings.slice(0, 200), total: snapshot.findings.length, nextOffset: snapshot.findings.length > 200 ? 200 : null };
}
