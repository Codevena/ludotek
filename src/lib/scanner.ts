import { Client } from "ssh2";
import { cleanFilename } from "./filename-cleaner";
import { getPlatformByDir } from "./platforms";
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

export async function scanDevice(
  device: DeviceConfig,
  onPathStart?: (pathLabel: string) => void,
): Promise<{ games: ScannedGame[]; reliable: boolean }> {
  if (
    !Array.isArray(device.scanPaths) || device.scanPaths.length === 0 ||
    !device.scanPaths.every((scanPath) =>
      scanPath && typeof scanPath.path === "string" && scanPath.path.startsWith("/") &&
      (scanPath.type === "rom" || scanPath.type === "steam"),
    )
  ) {
    return { games: [], reliable: false };
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
    console.warn("Scan connection failed:", error);
    return { games: [], reliable: false };
  }
  try {
    const allGames: ScannedGame[] = [];
    // `reliable` stays true only if every relevant directory was completely
    // read. The caller uses it to decide whether an empty result means
    // "device genuinely has no games" (safe to prune stale links) vs. "a path
    // was temporarily unreadable" (must NOT prune, or the whole library is lost).
    let reliable = true;
    for (const scanPath of device.scanPaths) {
      try {
        onPathStart?.(scanPath.path);
        const root = await conn.stat(scanPath.path);
        if (!root.isDirectory) throw new Error("Scan root is not a directory");
        if (scanPath.type === "rom") {
          const dirs = await conn.listDir(scanPath.path, { requireComplete: true });
          for (const dir of dirs) {
            if (dir.type !== "dir" && dir.type !== "symlink") continue;
            // Skip multidisc directories — their games are represented by .m3u in the main dir
            if (dir.name.endsWith("-multidisc")) continue;

            // Check if platform uses a subdir (e.g. xbox/roms/, wiiu/roms/)
            const platformDef = getPlatformByDir(dir.name);
            if (!platformDef) continue;
            const basePath = `${scanPath.path}/${dir.name}`;
            const romPath = platformDef?.subdir
              ? `${basePath}/${platformDef.subdir}`
              : basePath;

            // Collect ROM files — scan top-level + one level of subdirectories
            // Prefix with subdir so path reconstruction (scanPath/platformDir/originalFile) works
            const subdirPrefix = platformDef?.subdir ? `${platformDef.subdir}/` : "";
            const allFiles: string[] = [];
            try {
              const entries = await conn.listDir(romPath, { requireComplete: true });
              for (const entry of entries) {
                if (entry.type === "file" || entry.type === "symlink") {
                  allFiles.push(`${subdirPrefix}${entry.name}`);
                } else if (entry.type === "dir") {
                  // Skip hidden directories
                  if (entry.name.startsWith(".")) continue;
                  // Recurse one level into subdirectories (for region/genre folders)
                  try {
                    const subEntries = await conn.listDir(`${romPath}/${entry.name}`, { requireComplete: true });
                    for (const sub of subEntries) {
                      if (sub.type !== "dir") {
                        allFiles.push(`${subdirPrefix}${entry.name}/${sub.name}`);
                      }
                    }
                  } catch {
                    reliable = false;
                  }
                }
              }
            } catch {
              // A known platform cannot be treated as empty when unreadable.
              reliable = false;
              continue;
            }

            const listing = allFiles.join("\n");
            if (listing) {
              const games = parseRomListing(listing, dir.name);
              allGames.push(...games);
            }
          }
        } else {
          const entries = await conn.listDir(scanPath.path, { requireComplete: true });
          const steamGames = entries
            .filter((e) => e.type === "dir" || e.type === "symlink")
            .filter((e) => !matchesBlacklist(e.name, device.blacklist))
            .map((e) => ({
              originalFile: e.name,
              title: e.name,
              platform: "steam",
              platformLabel: "Steam",
              source: "steam" as const,
            }));
          allGames.push(...steamGames);
        }
      } catch (err) {
        console.warn(`Scan path ${scanPath.path} failed, skipping:`, err);
        // A configured root was unreachable — the result can't be trusted as a
        // complete view of the device, so block stale-link cleanup downstream.
        reliable = false;
      }
    }
    return { games: deduplicateGames(allGames), reliable };
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
