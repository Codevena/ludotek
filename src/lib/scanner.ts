import { Client } from "ssh2";
import { posix as path } from "node:path";
import { Writable } from "node:stream";
import { cleanFilename } from "./filename-cleaner";
import { getPlatformByDir } from "./platforms";
import { resolveLocalPath } from "./local-paths";
import { createConnection, quoteShellArg, sshExec, type DeviceConnection } from "./connection";

const SKIP_FILES = new Set(["metadata.txt", "systeminfo.txt", "media", ".sbi"]);
const SKIP_EXTENSIONS = new Set([".cue", ".sbi", ".txt", ".log", ".sh", ".lua", ".toml", ".ini", ".bak", ".pat", ".ps"]);
// Archive formats accepted for all platforms (ROMs are often compressed)
const ARCHIVE_EXTENSIONS = new Set([".7z", ".zip"]);
// Playlist format — represents a multi-disc game (only valid for disc-based platforms)
const PLAYLIST_EXTENSION = ".m3u";
const DISC_PLATFORMS = new Set([
  "psx", "ps2", "ps3", "saturn", "segacd", "dreamcast", "gc", "wii",
  "3do", "pcengine", "pcfx", "neogeocd", "jaguarcd",
]);

export function matchesBlacklist(name: string, blacklist: string[]): boolean {
  const lower = name.toLowerCase();
  return blacklist.some((pattern) => {
    const p = pattern.toLowerCase();
    if (p.endsWith("*")) {
      return lower.startsWith(p.slice(0, -1));
    }
    return lower === p;
  });
}

interface ScanPath {
  path: string;
  type: "rom" | "steam";
}

interface DeviceConfig {
  id: number;
  protocol: "ssh" | "ftp" | "local";
  host: string;
  port: number;
  user: string;
  password: string;
  ftps?: boolean;
  scanPaths: ScanPath[];
  blacklist: string[];
}

/** A physical entry, recorded before the catalog collapses discs or revisions. */
export interface ScannedFile {
  path: string;
  scanRoot: string;
  platformAlias: string;
  relativePath: string;
  platform: string | null;
  source: "rom" | "steam";
  size: number;
  modifiedAt?: string;
  type: "file" | "directory" | "symlink";
  gameKey?: string;
}

const MAX_SCAN_ENTRIES = 100_000;
const MAX_SCAN_DEPTH = 16;
const MAX_DESCRIPTOR_BYTES = 1024 * 1024;
const MAX_TOTAL_DESCRIPTOR_BYTES = 16 * MAX_DESCRIPTOR_BYTES;
const MAX_DESCRIPTOR_REFERENCES = 1000;

function safeEntryName(name: string): boolean {
  return !!name && name !== "." && name !== ".." && !/[/\\\x00-\x1f\x7f]/.test(name);
}

function romContext(file: ScannedFile): boolean {
  if (file.source !== "rom" || file.type !== "file" || !file.platform ||
      file.relativePath.split("/").some((part) => part.startsWith("."))) return false;
  const definition = getPlatformByDir(file.platformAlias);
  return !!definition && (!definition.subdir || file.relativePath.startsWith(`${definition.subdir}/`));
}

function descriptorKind(file: ScannedFile): string | null {
  if (!romContext(file) || !DISC_PLATFORMS.has(file.platform!)) return null;
  const extension = path.extname(file.path).toLowerCase();
  if (extension === ".cue" || extension === ".m3u") return extension;
  if (extension === ".gdi" && getPlatformByDir(file.platformAlias)?.extensions.includes(extension)) return extension;
  return null;
}

function descriptorGame(file: ScannedFile): ScannedGame | null {
  // The catalog filename helper excludes CUEs because legacy listing scans
  // cannot prove their tracks. Here the descriptor has been resolved first.
  const title = cleanFilename(path.basename(file.path).replace(/\.cue$/i, ".chd"));
  const definition = getPlatformByDir(file.platformAlias);
  if (!title || !definition) return null;
  return { originalFile: file.relativePath, title, platform: definition.id, platformLabel: definition.label, source: "rom" };
}

/** Descriptors are small metadata; ROM bodies are never read by the scanner. */
export interface ScannedDescriptorReference {
  reference: string;
  /** UTF-16 offsets in the original contents, including a filename's quotes. */
  start: number;
  end: number;
  quote: '"' | "'" | null;
}

/** Strict bounded parsing and exact token spans shared with file-plan rewrites. */
export function parseScanDescriptor(contents: string, kind: string): ScannedDescriptorReference[] | null {
  if (![".cue", ".gdi", ".m3u"].includes(kind) || Buffer.byteLength(contents) > MAX_DESCRIPTOR_BYTES || contents.includes("\0")) return null;
  const lines: { text: string; offset: number }[] = [];
  let offset = contents.startsWith("\uFEFF") ? 1 : 0;
  for (const text of contents.slice(offset).split(/\r?\n/)) {
    lines.push({ text, offset });
    offset += text.length + (contents.slice(offset + text.length, offset + text.length + 2) === "\r\n" ? 2 : 1);
  }
  // Overlong CUE/GDI lines can be split into separate commands by emulator
  // parsers using fgets. Reject them rather than claim an incomplete graph.
  if (lines.some((line) => Buffer.byteLength(line.text) > (kind === ".m3u" ? 8192 : 510))) return null;
  if (kind === ".m3u") {
    const references = lines.flatMap((line) => {
      const reference = line.text.trim();
      if (!reference || reference.startsWith("#")) return [];
      const start = line.offset + line.text.indexOf(reference);
      return [{ reference, start, end: start + reference.length, quote: null }];
    });
    return references.length > 0 && references.length <= MAX_DESCRIPTOR_REFERENCES ? references : null;
  }
  // Both supported disc formats permit quoted filenames containing spaces.
  const tokens = (line: { text: string; offset: number }): (ScannedDescriptorReference & { value: string })[] | null => {
    const result: (ScannedDescriptorReference & { value: string })[] = [];
    const pattern = /\s*(?:"([^"]*)"|'([^']*)'|([^\s"']+))\s*/gy;
    let offset = 0;
    while (offset < line.text.length) {
      pattern.lastIndex = offset;
      const match = pattern.exec(line.text);
      if (!match) return line.text.slice(offset).trim() ? null : result;
      const value = match[1] ?? match[2] ?? match[3];
      const quote = match[1] !== undefined ? '"' as const : match[2] !== undefined ? "'" as const : null;
      const start = line.offset + match.index + match[0].length - match[0].trimStart().length;
      result.push({ value, reference: value, start, end: start + value.length + (quote ? 2 : 0), quote });
      offset = pattern.lastIndex;
    }
    return result;
  };
  const filenameToken = ({ reference, start, end, quote }: ScannedDescriptorReference): ScannedDescriptorReference => ({ reference, start, end, quote });
  if (kind === ".gdi") {
    const nonempty = lines.filter((line) => line.text.trim());
    const header = tokens(nonempty.shift() ?? { text: "", offset: 0 });
    const count = Number(header?.[0]?.value);
    if (header?.length !== 1 || !Number.isSafeInteger(count) || count <= 0 || count > MAX_DESCRIPTOR_REFERENCES || nonempty.length !== count) return null;
    const references: ScannedDescriptorReference[] = [];
    const tracks = new Set<number>();
    for (const line of nonempty) {
      const fields = tokens(line);
      if (!fields || fields.length !== 6 || [0, 1, 2, 3, 5].some((index) => !/^\d+$/.test(fields[index].value) || !Number.isSafeInteger(Number(fields[index].value))) ||
          Number(fields[0].value) <= 0 || Number(fields[0].value) > count || tracks.has(Number(fields[0].value)) ||
          !["0", "4"].includes(fields[2].value) || !["2048", "2352"].includes(fields[3].value) || (fields[2].value === "0" && fields[3].value !== "2352")) return null;
      tracks.add(Number(fields[0].value));
      references.push(filenameToken(fields[4]));
    }
    return references;
  }
  const references: ScannedDescriptorReference[] = [];
  let currentFile = false;
  let hasTrack = false;
  for (const line of lines) {
    const command = line.text.trim().split(/\s+/, 1)[0]?.toUpperCase();
    if (command !== "FILE" && command !== "TRACK") continue;
    const fields = tokens(line);
    if (!fields || fields.length !== 3) return null;
    if (command === "FILE") {
      if ((currentFile && !hasTrack) || !["BINARY", "MOTOROLA", "WAVE"].includes(fields[2].value.toUpperCase())) return null;
      references.push(filenameToken(fields[1]));
      if (references.length > MAX_DESCRIPTOR_REFERENCES) return null;
      currentFile = true;
      hasTrack = false;
    } else {
      if (!currentFile || !/^\d+$/.test(fields[1].value) || !Number.isSafeInteger(Number(fields[1].value)) || Number(fields[1].value) <= 0 ||
          !/^(AUDIO|CDG|MODE[12]\/\d+|CDI\/\d+)$/i.test(fields[2].value)) return null;
      hasTrack = true;
    }
  }
  return currentFile && hasTrack ? references : null;
}

export async function scanDevice(
  device: DeviceConfig,
  onPathStart?: (pathLabel: string) => void,
  options: { signal?: AbortSignal; assertActive?: () => Promise<void> } = {},
): Promise<{ games: ScannedGame[]; reliable: boolean; files: ScannedFile[] }> {
  let stopped: unknown;
  const assertActive = async () => {
    try {
      options.signal?.throwIfAborted();
      await options.assertActive?.();
      options.signal?.throwIfAborted();
    } catch (error) { stopped = error; throw error; }
  };
  const throwIfStopped = () => {
    if (stopped !== undefined) throw stopped;
    options.signal?.throwIfAborted();
  };
  const checked = async <T,>(operation: () => Promise<T>): Promise<T> => {
    await assertActive();
    let result: T;
    try { result = await operation(); }
    catch (error) { await assertActive(); throw error; }
    await assertActive();
    return result;
  };
  await assertActive();
  if (
    !Array.isArray(device.scanPaths) || device.scanPaths.length === 0 || device.scanPaths.length > 32 ||
    !device.scanPaths.every((scanPath) =>
      scanPath && typeof scanPath.path === "string" && scanPath.path.startsWith("/") && !/[\\\x00-\x1f\x7f]/.test(scanPath.path) &&
      (scanPath.type === "rom" || scanPath.type === "steam"),
    )
  ) {
    return { games: [], reliable: false, files: [] };
  }

  let conn: DeviceConnection;
  try {
    conn = await createConnection({
      protocol: device.protocol,
      host: device.host,
      port: device.port,
      user: device.user,
      password: device.password,
      ftps: device.ftps,
    });
  } catch (error) {
    throwIfStopped();
    console.warn("Scan connection failed:", error);
    return { games: [], reliable: false, files: [] };
  }
  try {
    await assertActive();
    const allGames: ScannedGame[] = [];
    const files = new Map<string, ScannedFile>();
    const visited = new Map<string, "rom" | "steam">();
    let entriesRead = 0;
    // `reliable` stays true only if every relevant directory was completely
    // read. The caller uses it to decide whether an empty result means
    // "device genuinely has no games" (safe to prune stale links) vs. "a path
    // was temporarily unreadable" (must NOT prune, or the whole library is lost).
    let reliable = true;
    // lstat is additive for older connection doubles. Without it, a listed
    // symlink remains unconfirmed and makes the inventory incomplete.
    const walk = async (directory: string, scanRoot: string, source: "rom" | "steam", depth: number,
      alias = "", platform: string | null = null, steamGameKey?: string): Promise<void> => {
      await assertActive();
      if (visited.has(directory)) {
        if (visited.get(directory) !== source) reliable = false;
        return;
      }
      if (depth > MAX_SCAN_DEPTH || entriesRead >= MAX_SCAN_ENTRIES) { reliable = false; return; }
      visited.set(directory, source);
      let entries;
      try { entries = await checked(() => conn.listDir(directory, { requireComplete: true })); }
      catch { throwIfStopped(); reliable = false; return; }
      for (const entry of entries) {
        await assertActive();
        if (entriesRead >= MAX_SCAN_ENTRIES) { reliable = false; break; }
        entriesRead++;
        if (!safeEntryName(entry.name) || !["file", "dir", "symlink"].includes(entry.type)) { reliable = false; continue; }
        const filename = path.join(directory, entry.name);
        const actualAlias = source === "rom" && depth === 0 && entry.type !== "file" ? entry.name : alias;
        const definition = source === "rom" && depth === 0 ? getPlatformByDir(actualAlias) : null;
        const actualPlatform = source === "steam" ? "steam" : depth === 0 ? definition?.id ?? null : platform;
        let type: ScannedFile["type"] = entry.type === "dir" ? "directory" : entry.type;
        let metadata;
        try {
          const ownMetadata = conn.lstat ? await checked(() => conn.lstat!(filename)) : undefined;
          if (ownMetadata?.type === "other") { reliable = false; continue; }
          if (ownMetadata?.type) {
            if (ownMetadata.type !== type) reliable = false;
            type = ownMetadata.type;
          }
          if (type === "symlink") {
            if (!ownMetadata) { reliable = false; continue; }
            metadata = ownMetadata;
          } else {
            metadata = await checked(() => conn.stat(filename));
            if (metadata.isDirectory !== (type === "directory")) { reliable = false; continue; }
          }
          if (!Number.isSafeInteger(metadata.size) || metadata.size < 0) { reliable = false; continue; }
        } catch { throwIfStopped(); reliable = false; continue; }
        const relativePath = path.relative(source === "rom" && actualAlias ? path.join(scanRoot, actualAlias) : scanRoot, filename);
        const record: ScannedFile = { path: filename, scanRoot, platformAlias: actualAlias, relativePath,
          platform: actualPlatform, source, size: metadata.size, modifiedAt: metadata.modifiedAt, type };
        let key = steamGameKey;
        if (source === "steam" && depth === 0 && type === "directory" && !matchesBlacklist(entry.name, device.blacklist)) {
          key = `${entry.name}|steam`;
          allGames.push({ originalFile: entry.name, title: entry.name, platform: "steam", platformLabel: "Steam", source: "steam" });
        }
        if (source === "steam" && type !== "symlink" && key) record.gameKey = key;
        if (!files.has(filename)) files.set(filename, record);
        if (type === "directory") await walk(filename, scanRoot, source, depth + 1, actualAlias, actualPlatform, key);
      }
    };
    for (const scanPath of device.scanPaths) {
      await assertActive();
      try {
        onPathStart?.(scanPath.path);
        // Actual adapters expose the guarded file-I/O boundary. Legacy test
        // doubles keep their explicit synthetic paths; production LOCAL roots
        // are canonical so later plans use the same identity and allowlist.
        const scanRoot = device.protocol === "local" && conn.fileIo
          ? await checked(() => resolveLocalPath(scanPath.path)) : path.normalize(scanPath.path);
        const root = await checked(() => conn.stat(scanRoot));
        if (!root.isDirectory) throw new Error("Scan root is not a directory");
        await walk(scanRoot, scanRoot, scanPath.type, 0);
      } catch (err) {
        throwIfStopped();
        console.warn(`Scan path ${scanPath.path} failed, skipping:`, err);
        // A configured root was unreachable — the result can't be trusted as a
        // complete view of the device, so block stale-link cleanup downstream.
        reliable = false;
      }
    }
    const candidates = new Map<string, ScannedGame>();
    const descriptors = new Map<string, { kind: string; references: string[] }>();
    let descriptorBytes = 0;
    const readDescriptor = async (file: ScannedFile): Promise<Buffer> => {
      if (!conn.fileIo) return checked(() => conn.readFile(file.path, MAX_DESCRIPTOR_BYTES + 1));
      const chunks: Buffer[] = [];
      const destination = new Writable({
        write(chunk: Buffer, _encoding, callback) { chunks.push(Buffer.from(chunk)); callback(); },
      });
      await checked(() => conn.fileIo!.readTo(file.path, destination, {
        maxBytes: MAX_DESCRIPTOR_BYTES + 1, expectedBytes: file.size, timeoutMs: 15_000, signal: options.signal,
      }));
      return Buffer.concat(chunks);
    };
    for (const file of files.values()) {
      await assertActive();
      if (file.source === "rom" && file.type === "directory") {
        const requiredSubdir = getPlatformByDir(file.platformAlias)?.subdir;
        if (requiredSubdir && file.path === path.join(file.scanRoot, file.platformAlias) &&
            files.get(path.join(file.path, requiredSubdir))?.type !== "directory") reliable = false;
      }
      if (!romContext(file)) continue;
      const kind = descriptorKind(file);
      if (!kind) {
        const game = parseRomListing(file.relativePath, file.platformAlias)[0];
        if (game) candidates.set(file.path, game);
        continue;
      }
      if (file.size > MAX_DESCRIPTOR_BYTES || descriptorBytes + file.size > MAX_TOTAL_DESCRIPTOR_BYTES) { reliable = false; continue; }
      descriptorBytes += file.size;
      try {
        const bytes = await readDescriptor(file);
        if (bytes.length > MAX_DESCRIPTOR_BYTES || bytes.length !== file.size) { reliable = false; continue; }
        const contents = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
        if (contents.split(/\r?\n/).some((line) => Buffer.byteLength(line) > (kind === ".m3u" ? 8192 : 510))) reliable = false;
        const references = parseScanDescriptor(contents, kind);
        if (references) descriptors.set(file.path, { kind, references: references.map((entry) => entry.reference) });
      } catch { throwIfStopped(); reliable = false; }
    }
    const resolved = new Map<string, Set<string> | null>();
    const resolving = new Set<string>();
    let graphMembers = 0;
    const resolveDescriptor = (filename: string, depth = 0): Set<string> | null => {
      if (resolved.has(filename)) return resolved.get(filename)!;
      const descriptor = descriptors.get(filename);
      const file = files.get(filename)!;
      if (!descriptor || resolving.has(filename)) return null;
      if (depth > MAX_SCAN_DEPTH || graphMembers >= MAX_SCAN_ENTRIES) { reliable = false; return null; }
      resolving.add(filename);
      const closure = new Set([filename]);
      let valid = true;
      for (const reference of descriptor.references) {
        if (!reference || /[\\\x00-\x1f\x7f]/.test(reference) || /^[a-z][a-z0-9+.-]*:/i.test(reference)) { valid = false; break; }
        const target = path.resolve(path.dirname(filename), reference);
        const input = files.get(target);
        if (!input || input.type !== "file" || input.source !== "rom" || input.platform !== file.platform) { valid = false; break; }
        if (descriptor.kind === ".m3u") {
          if (descriptorKind(input)) {
            const nested = resolveDescriptor(target, depth + 1);
            if (!nested) { valid = false; break; }
            for (const member of nested) closure.add(member);
          } else if (!candidates.has(target)) { valid = false; break; }
        } else if (descriptorKind(input)) { valid = false; break; }
        closure.add(target);
      }
      resolving.delete(filename);
      if (valid && graphMembers + closure.size > MAX_SCAN_ENTRIES) { reliable = false; valid = false; }
      if (valid) graphMembers += closure.size;
      resolved.set(filename, valid ? closure : null);
      return valid ? closure : null;
    };
    const referenced = new Set<string>();
    for (const filename of descriptors.keys()) {
      await assertActive();
      const closure = resolveDescriptor(filename);
      const game = descriptorGame(files.get(filename)!);
      if (!closure || !game) continue;
      candidates.set(filename, game);
      for (const member of closure) if (member !== filename) referenced.add(member);
    }
    const ownership = new Map<string, Set<string>>();
    for (const [filename, game] of candidates) {
      await assertActive();
      if (referenced.has(filename)) continue;
      allGames.push(game);
      for (const member of resolved.get(filename) ?? [filename]) {
        const keys = ownership.get(member) ?? new Set<string>();
        keys.add(`${game.title}|${game.platform}`);
        ownership.set(member, keys);
      }
    }
    for (const [filename, keys] of ownership) if (keys.size === 1) files.get(filename)!.gameKey = keys.values().next().value;
    await assertActive();
    return { games: deduplicateGames(allGames), reliable, files: [...files.values()] };
  } finally {
    conn.disconnect();
  }
}

export interface ScannedGame {
  originalFile: string;
  title: string;
  platform: string;
  platformLabel: string;
  source: "rom" | "steam";
}

export function parseRomListing(
  lsOutput: string,
  dirName: string
): ScannedGame[] {
  const platformDef = getPlatformByDir(dirName);
  if (!platformDef) return [];

  // Only accept files with valid extensions for this platform
  const validExtensions = new Set(platformDef.extensions.map((e) => e.toLowerCase()));

  const mapped: (ScannedGame | null)[] = lsOutput
    .split("\n")
    .map((f) => f.trim())
    .filter((f) => {
      // For files in subdirectories (e.g. "USA/.DS_Store"), check basename
      const baseName = f.includes("/") ? f.split("/").pop()! : f;
      if (!f || baseName.startsWith(".") || SKIP_FILES.has(baseName)) return false;
      const dotIdx = baseName.lastIndexOf(".");
      if (dotIdx < 0) return false; // No extension = not a ROM file
      const ext = baseName.slice(dotIdx).toLowerCase();
      if (SKIP_EXTENSIONS.has(ext)) return false;
      // .m3u playlists represent multi-disc games — only for disc-based platforms
      if (ext === PLAYLIST_EXTENSION && DISC_PLATFORMS.has(platformDef.id)) return true;
      // Archives (.7z, .zip) are always valid — ROMs are often compressed
      if (ARCHIVE_EXTENSIONS.has(ext)) return true;
      // If platform defines valid extensions, enforce them
      if (validExtensions.size > 0 && !validExtensions.has(ext)) return false;
      return true;
    })
    .map((f) => {
      // For files in subdirectories (e.g. "USA/Halo.iso"), use basename for title
      const basename = f.includes("/") ? f.split("/").pop()! : f;
      const title = cleanFilename(basename);
      if (!title) return null;
      return {
        originalFile: f,
        title,
        platform: platformDef.id,
        platformLabel: platformDef.label,
        source: "rom" as const,
      };
    });

  return mapped.filter((g): g is ScannedGame => g !== null);
}

export function deduplicateGames(games: ScannedGame[]): ScannedGame[] {
  const seen = new Map<string, ScannedGame>();

  for (const game of games) {
    // Deduplicate by cleaned title + platform ID (not filename)
    // This collapses multi-disc games (Disc 1, Disc 2) and regional variants
    // (USA/game vs Europe/game) into one entry — prefer .m3u (canonical multi-disc)
    const key = `${game.title}|${game.platform}`;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, game);
    } else {
      const isM3u = game.originalFile.toLowerCase().endsWith(".m3u");
      const existingIsM3u = existing.originalFile.toLowerCase().endsWith(".m3u");
      if (isM3u && !existingIsM3u) {
        seen.set(key, game);
      }
    }
  }

  return Array.from(seen.values());
}

/** @deprecated Use scanDevice() instead */
export async function scanSteamDeck(
  host: string,
  user: string,
  password: string
): Promise<ScannedGame[]> {
  const ROM_BASE = "/run/media/deck/SD/Emulation/roms";
  const STEAM_PATHS = [
    "/run/media/deck/SD/Games",
    "/home/deck/.local/share/Steam/steamapps/common",
  ];
  const conn = new Client();

  return new Promise((resolve, reject) => {
    conn.on("ready", async () => {
      try {
        const allGames: ScannedGame[] = [];

        const dirs = await sshExec(
          conn,
          `ls -1 -- ${quoteShellArg(ROM_BASE)}`
        );
        const romDirs = dirs.split("\n").filter((d) => d.trim());

        for (const dir of romDirs) {
          const listing = await sshExec(
            conn,
            `ls -1 -- ${quoteShellArg(`${ROM_BASE}/${dir}`)}`
          );
          if (listing) {
            const games = parseRomListing(listing, dir);
            allGames.push(...games);
          }
        }

        for (const steamPath of STEAM_PATHS) {
          const listing = await sshExec(
            conn,
            `ls -1 -- ${quoteShellArg(steamPath)}`
          );
          if (listing) {
            const steamGames = listing
              .split("\n")
              .filter((f) => f.trim())
              .map((f) => ({
                originalFile: f.trim(),
                title: f.trim(),
                platform: "steam",
                platformLabel: "Steam",
                source: "steam" as const,
              }));
            allGames.push(...steamGames);
          }
        }

        conn.end();
        resolve(deduplicateGames(allGames));
      } catch (err) {
        conn.end();
        reject(err);
      }
    });

    conn.on("error", reject);
    conn.connect({ host, port: 22, username: user, password });
  });
}
