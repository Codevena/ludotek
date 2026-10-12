import path from "node:path";
import { createHash } from "node:crypto";
import type { Device, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { acquireDeviceFiles, assertDeviceJobsOwned } from "@/lib/device-jobs";
import { AdmissionError, AdmissionStore, EnrichmentJob, admissionResponse, type acquireScopedJob } from "@/lib/job-admission";
import { RequestBodyError } from "@/lib/request-body";
import { resolveLocalPath } from "@/lib/local-paths";
import { PLATFORM_CONFIG } from "@/lib/platforms";

export class DeviceProfileError extends Error {
  constructor(message: string, readonly status: 400 | 404 | 409 | 422 | 503 = 400) { super(message); this.name = "DeviceProfileError"; }
}
export interface ProfileRoot { path: string; platform?: string }
export interface DeviceProfileData { template: "steamdeck" | "retroid" | "miyoo" | "custom"; romRoots: ProfileRoot[]; saveRoots: ProfileRoot[]; formats: string[]; reserveBytes: string }
export const PROFILE_TEMPLATES = [
  { id: "steamdeck", label: "Steam Deck / EmuDeck", romHint: "Emulation/roms unter deinem gewählten EmuDeck-Speicher", saveHint: "Emulation/saves: Emulatorpfade prüfen", formats: [".zip", ".7z", ".sfc", ".smc", ".nes", ".gb", ".gbc", ".gba", ".chd", ".cue", ".bin", ".gdi", ".m3u", ".iso"], source: "https://manual.emudeck.com/using-app/3_import-games/" },
  { id: "retroid", label: "Retroid / Android", romHint: "Den im Emulator gewählten ROM-Ordner eintragen", saveHint: "Der Save-Pfad hängt vom Android-Emulator und dessen Speicherrechten ab", formats: [".zip", ".7z", ".sfc", ".smc", ".nes", ".gb", ".gbc", ".gba", ".chd", ".cue", ".bin", ".gdi", ".m3u", ".iso"], source: null },
  { id: "miyoo", label: "Miyoo / Onion", romHint: "Roms auf der SD-Karte; Plattformordner beachten Groß-/Kleinschreibung", saveHint: "/mnt/SDCARD/Saves/CurrentProfile/saves: Gerät und Emulator prüfen", formats: [".zip", ".7z", ".sfc", ".smc", ".nes", ".gb", ".gbc", ".gba", ".chd", ".cue", ".bin", ".m3u"], source: "https://onionui.github.io/docs/faq" },
  { id: "custom", label: "Eigene Vorlage", romHint: "Bereits konfigurierte Scanwurzel oder deren Unterordner", saveHint: "Den tatsächlichen Emulator-Save-Pfad eintragen", formats: [], source: null },
] as const;
export type ProfileOptions = { db?: PrismaClient; acquire?: typeof acquireScopedJob };
/** A supplied database must own its own admission rows; no global-store fallback. */
export function deviceProfileAcquire(options: ProfileOptions): typeof acquireScopedJob | undefined {
  if (options.acquire) return options.acquire;
  if (!options.db) return undefined;
  const store = new AdmissionStore(options.db);
  return async (resource, request) => new EnrichmentJob(await store.acquire(resource), request.signal);
}
export function deviceProfileFailure(error: unknown): Response {
  if (error instanceof AdmissionError) return admissionResponse(error);
  if (error instanceof DeviceProfileError || error instanceof RequestBodyError) return Response.json({ error: error.message }, { status: error.status, headers: { "Cache-Control": "no-store" } });
  const journalError = error as { name?: string; status?: number; message?: string } | null;
  if (journalError?.name === "FilePlanError" && [400, 404, 409, 413, 422, 503].includes(journalError.status!)) return Response.json({ error: journalError.message }, { status: journalError.status, headers: { "Cache-Control": "no-store" } });
  return Response.json({ error: "Geräteprofil oder Synchronisierung konnten nicht sicher verarbeitet werden." }, { status: 503, headers: { "Cache-Control": "no-store" } });
}
export function validDeviceNumber(value: unknown): value is number { return Number.isSafeInteger(value) && Number(value) >= 1 && Number(value) <= 2147483647; }
export function profileFingerprint(profile: DeviceProfileData): string { return createHash("sha256").update(JSON.stringify(profile)).digest("hex"); }
export function profileContains(root: string, filename: string): boolean { return filename === root || filename.startsWith(root === "/" ? "/" : `${root}/`); }
function validPath(value: unknown): value is string {
  return typeof value === "string" && value.length <= 8192 && value.startsWith("/") && value !== "/" && path.posix.normalize(value) === value && !/[\\\x00-\x1f\x7f-\x9f]/.test(value);
}
export function configuredRomRoots(device: Pick<Device, "scanPaths">): string[] {
  try {
    const paths: unknown = JSON.parse(device.scanPaths);
    if (!Array.isArray(paths) || paths.length > 32) throw new Error();
    return paths.filter((item) => item?.type === "rom" && validPath(item.path)).map((item) => item.path);
  } catch { throw new DeviceProfileError("Die ROM-Scanwurzeln des Geräts sind nicht gültig konfiguriert.", 422); }
}
function parseProfileShape(input: unknown): DeviceProfileData {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new DeviceProfileError("Ungültiges Geräteprofil.");
  const data = input as Record<string, unknown>;
  if (Object.keys(data).some((key) => !["template", "romRoots", "saveRoots", "formats", "reserveBytes"].includes(key)) || !PROFILE_TEMPLATES.some((template) => template.id === data.template)) throw new DeviceProfileError("Ungültige Profilvorlage.");
  const parseRoots = (value: unknown, rom: boolean): ProfileRoot[] => {
    if (!Array.isArray(value) || value.length > 32 || (rom && value.length < 1)) throw new DeviceProfileError("1–32 ROM-Wurzeln und höchstens32 Save-Wurzeln angeben.");
    const seen = new Set<string>();
    return value.map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item) || Object.keys(item).some((key) => !["path", "platform"].includes(key)) || !validPath(item.path) ||
        (item.platform !== undefined && (typeof item.platform !== "string" || !PLATFORM_CONFIG.some((platform) => platform.id === item.platform)))) throw new DeviceProfileError("Ungültige Profilwurzel.");
      const key = `${item.platform ?? "*"}:${item.path}`;
      if (seen.has(key)) throw new DeviceProfileError("Doppelte Profilwurzel.");
      seen.add(key);
      return { path: item.path as string, ...(item.platform !== undefined ? { platform: item.platform as string } : {}) };
    });
  };
  if (!Array.isArray(data.formats) || data.formats.length > 128 || data.formats.some((format) => typeof format !== "string" || !/^\.[a-z0-9]{1,12}$/.test(format)) || new Set(data.formats).size !== data.formats.length) throw new DeviceProfileError("Formate als eindeutige Kleinbuchstaben-Endungen angeben, zum Beispiel .chd.");
  if (typeof data.reserveBytes !== "string" || !/^\d{1,16}$/.test(data.reserveBytes) || BigInt(data.reserveBytes) > BigInt(Number.MAX_SAFE_INTEGER)) throw new DeviceProfileError("Ungültige Speicherreserve.");
  return { template: data.template as DeviceProfileData["template"], romRoots: parseRoots(data.romRoots, true), saveRoots: parseRoots(data.saveRoots, false), formats: data.formats as string[], reserveBytes: BigInt(data.reserveBytes).toString() };
}
export function parseDeviceProfile(input: unknown, device: Pick<Device, "scanPaths">): DeviceProfileData {
  const profile = parseProfileShape(input);
  const roots = configuredRomRoots(device);
  if (profile.romRoots.some((item) => !roots.some((root) => profileContains(root, item.path)))) throw new DeviceProfileError("ROM-Profilwurzeln müssen innerhalb der konfigurierten ROM-Scanwurzeln liegen.", 422);
  return profile;
}
async function resolvedRomRoots(device: Pick<Device, "scanPaths" | "protocol">): Promise<string[]> {
  const roots = configuredRomRoots(device);
  if (device.protocol !== "local") return roots;
  return [...new Set(await Promise.all(roots.map((root) => resolveLocalPath(root, { allowMissing: true }))))];
}
/** Validate every bounded field before resolving aliases. Containment remains
 * against this device's guarded canonical scan roots, never just the allowlist. */
async function resolvedProfile(input: unknown, device: Pick<Device, "scanPaths" | "protocol">) {
  const profile = parseProfileShape(input);
  const roots = await resolvedRomRoots(device);
  if (device.protocol === "local") {
    for (const root of [...profile.romRoots, ...profile.saveRoots]) root.path = await resolveLocalPath(root.path, { allowMissing: true });
  }
  return { profile: parseDeviceProfile(profile, { scanPaths: JSON.stringify(roots.map((root) => ({ path: root, type: "rom" }))) }), roots };
}
export async function getDeviceProfile(deviceId: number, options: ProfileOptions = {}) {
  if (!validDeviceNumber(deviceId)) throw new DeviceProfileError("Ungültige Geräte-ID.");
  const db = options.db ?? prisma;
  const device = await db.device.findUnique({ where: { id: deviceId } });
  if (!device) throw new DeviceProfileError("Gerät nicht gefunden.", 404);
  const stored = await db.deviceProfile.findUnique({ where: { deviceId } });
  const normalized = stored ? await resolvedProfile({ template: stored.template, romRoots: JSON.parse(stored.romRoots), saveRoots: JSON.parse(stored.saveRoots), formats: JSON.parse(stored.formats), reserveBytes: stored.reserveBytes.toString() }, device) : { roots: await resolvedRomRoots(device) };
  const profile: DeviceProfileData = "profile" in normalized ? normalized.profile : { template: "custom", romRoots: normalized.roots.map((root) => ({ path: root })), saveRoots: [], formats: [], reserveBytes: "0" };
  return { deviceId, profile, configuredRomRoots: normalized.roots, saved: Boolean(stored), updatedAt: stored?.updatedAt.toISOString() ?? null };
}
export async function saveDeviceProfile(deviceId: number, input: unknown, request: Request, options: ProfileOptions = {}) {
  if (!validDeviceNumber(deviceId)) throw new DeviceProfileError("Ungültige Geräte-ID.");
  const jobs = await acquireDeviceFiles([deviceId], request, deviceProfileAcquire(options));
  try {
    await jobs.assertActive();
    const db = options.db ?? prisma;
    const device = await db.device.findUnique({ where: { id: deviceId } });
    if (!device) throw new DeviceProfileError("Gerät nicht gefunden.", 404);
    const { profile } = await resolvedProfile(input, device);
    await jobs.assertActive();
    const stored = await db.$transaction(async (tx) => {
      await assertDeviceJobsOwned(jobs, tx); jobs.signal.throwIfAborted();
      return tx.deviceProfile.upsert({ where: { deviceId }, create: { deviceId, template: profile.template, romRoots: JSON.stringify(profile.romRoots), saveRoots: JSON.stringify(profile.saveRoots), formats: JSON.stringify(profile.formats), reserveBytes: BigInt(profile.reserveBytes) }, update: { template: profile.template, romRoots: JSON.stringify(profile.romRoots), saveRoots: JSON.stringify(profile.saveRoots), formats: JSON.stringify(profile.formats), reserveBytes: BigInt(profile.reserveBytes) } });
    });
    return { deviceId, profile, saved: true, updatedAt: stored.updatedAt.toISOString() };
  } finally { await jobs.close(); }
}
