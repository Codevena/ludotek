import { Client } from "ssh2";
import { cleanFilename } from "./filename-cleaner";
import { getPlatformByDir, PLATFORM_CONFIG } from "./platforms";
import { createConnection } from "./connection";

const SKIP_FILES = new Set(["metadata.txt", "systeminfo.txt", "media", ".sbi"]);
const SKIP_EXTENSIONS = new Set([".m3u", ".cue", ".sbi"]);

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
  scanPaths: ScanPath[];
  blacklist: string[];
}

export async function scanDevice(
  device: DeviceConfig,
  onPathStart?: (pathLabel: string) => void,
): Promise<ScannedGame[]> {
  const conn = await createConnection({
    protocol: device.protocol,
    host: device.host,
    port: device.port,
    user: device.user,
    password: device.password,
  });
  try {
    const allGames: ScannedGame[] = [];
    for (const scanPath of device.scanPaths) {
      try {
        onPathStart?.(scanPath.path);
        if (scanPath.type === "rom") {
          const dirs = await conn.listDir(scanPath.path);
          for (const dir of dirs) {
            if (dir.type !== "dir" && dir.type !== "symlink") continue;
            const subEntries = await conn.listDir(`${scanPath.path}/${dir.name}`);
            // Only pass actual files to the parser — skip subdirs and symlinks
            const listing = subEntries
              .filter((e) => e.type === "file")
              .map((e) => e.name)
              .join("\n");
            if (listing) {
              const games = parseRomListing(listing, dir.name);
              allGames.push(...games);
            }
          }
        } else {
          const entries = await conn.listDir(scanPath.path);
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
      }
    }
    return deduplicateGames(allGames);
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
      if (!f || f.startsWith(".") || SKIP_FILES.has(f)) return false;
      const dotIdx = f.lastIndexOf(".");
      if (dotIdx < 0) return false; // No extension = not a ROM file
      const ext = f.slice(dotIdx).toLowerCase();
      if (SKIP_EXTENSIONS.has(ext)) return false;
      // If platform defines valid extensions, enforce them
      if (validExtensions.size > 0 && !validExtensions.has(ext)) return false;
      return true;
    })
    .map((f) => {
      const title = cleanFilename(f);
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
  const canonicalIds = new Set(PLATFORM_CONFIG.map((p) => p.id));

  for (const game of games) {
    // Deduplicate by cleaned title + platform ID (not filename)
    // This collapses multi-disc games (Disc 1, Disc 2) into one entry
    const key = `${game.title}|${game.platform}`;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, game);
    } else if (
      canonicalIds.has(game.platform) &&
      !canonicalIds.has(existing.platform)
    ) {
      seen.set(key, game);
    }
  }

  return Array.from(seen.values());
}

function sanitizeShellArg(str: string): string {
  return str.replace(/[`$\\;"'|&<>(){}!\n\r]/g, "");
}

function sshExec(conn: Client, command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) return reject(err);
      let data = "";
      stream.on("data", (chunk: Buffer) => {
        data += chunk.toString();
      });
      stream.stderr.on("data", (chunk: Buffer) => {
        console.warn("SSH stderr:", chunk.toString());
      });
      stream.on("close", () => resolve(data.trim()));
    });
  });
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
          `ls -1 "${ROM_BASE}" 2>/dev/null || echo ""`
        );
        const romDirs = dirs.split("\n").filter((d) => d.trim());

        for (const dir of romDirs) {
          const safeDirName = sanitizeShellArg(dir);
          const listing = await sshExec(
            conn,
            `ls -1 "${ROM_BASE}/${safeDirName}" 2>/dev/null || echo ""`
          );
          if (listing) {
            const games = parseRomListing(listing, dir);
            allGames.push(...games);
          }
        }

        for (const steamPath of STEAM_PATHS) {
          const listing = await sshExec(
            conn,
            `ls -1 "${steamPath}" 2>/dev/null || echo ""`
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
