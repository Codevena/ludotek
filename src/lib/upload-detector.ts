export interface UploadedFile {
  name: string;
  size: number;
  path: string;
}

export interface DetectedGame {
  id: string;
  title: string;
  type: "single" | "multi-disc";
  discCount: number;
  files: { name: string; size: number; disc?: number; path: string }[];
  conversion: "none" | "chd" | "rvz";
  totalSize: number;
}

const METADATA_EXTENSIONS = new Set([
  ".txt", ".xml", ".json", ".png", ".jpg", ".log", ".sub", ".idx", ".sbi",
]);

const CHD_PLATFORMS = new Set(["psx", "ps2", "dreamcast", "saturn", "segacd"]);

const DISC_PATTERN = /\((Disc|Disk|CD)\s+(\d+)\)/i;

const KNOWN_EXTENSIONS = /\.(chd|rvz|7z|zip|iso|bin|cue|gba|gb|gbc|nes|sfc|smc|sms|n64|z64|v64|nds|3ds|cia|xci|nsp|gcm|gg|md|smd|gen|32x|cdi|gdi|pbp|cso|xex|god|wad|dsi|app|pce|sgx|lnx|ngp|ngc|ws|wsc|col|a26|a78|j64|jag|vb|vec|sg|sc|mx1|mx2|dsk|tap|tzx|t64|d64|crt|prg|adf|hdf|ipf|ndd|fds|qd|bs|st|cas|rom)$/i;

function getExtension(filename: string): string {
  const dotIdx = filename.lastIndexOf(".");
  return dotIdx === -1 ? "" : filename.slice(dotIdx).toLowerCase();
}

function isMetadata(filename: string): boolean {
  return METADATA_EXTENSIONS.has(getExtension(filename));
}

function extractDiscNumber(filename: string): number | undefined {
  const match = filename.match(DISC_PATTERN);
  return match ? parseInt(match[2], 10) : undefined;
}

function cleanTitle(filename: string): string {
  // Remove extension
  let name = filename.replace(KNOWN_EXTENSIONS, "");

  // Strip disc markers
  name = name.replace(DISC_PATTERN, "");

  // Strip parenthetical tags: (USA), (Europe), etc.
  name = name.replace(/\s*\([^)]*\)/g, "");

  // Strip bracket tags: [!], [b], etc.
  name = name.replace(/\s*\[[^\]]*\]/g, "");

  // Handle tilde alternate names
  if (name.includes(" ~ ")) {
    name = name.split(" ~ ")[0];
  }

  return name.trim();
}

function determineConversion(platform: string): "none" | "chd" | "rvz" {
  const p = platform.toLowerCase();
  if (CHD_PLATFORMS.has(p)) return "chd";
  if (p === "gc") return "rvz";
  return "none";
}

function generateId(title: string, platform: string): string {
  // Deterministic ID based on title+platform so detect and process calls produce the same IDs
  let hash = 0;
  const str = `${platform}:${title}`;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return `game-${Math.abs(hash).toString(36)}`;
}

export function detectGames(files: UploadedFile[], platform: string): DetectedGame[] {
  // Filter out metadata files
  const validFiles = files.filter((f) => !isMetadata(f.name));
  if (validFiles.length === 0) return [];

  // Group files by cleaned title
  const groups = new Map<string, { name: string; size: number; disc?: number; path: string }[]>();

  for (const file of validFiles) {
    const title = cleanTitle(file.name);
    if (!title) continue;

    const disc = extractDiscNumber(file.name);
    const entry = { name: file.name, size: file.size, disc, path: file.path };

    const existing = groups.get(title);
    if (existing) {
      existing.push(entry);
    } else {
      groups.set(title, [entry]);
    }
  }

  const conversion = determineConversion(platform);
  const results: DetectedGame[] = [];

  for (const [title, gameFiles] of Array.from(groups.entries())) {
    const discNumbers = gameFiles
      .map((f) => f.disc)
      .filter((d): d is number => d !== undefined);

    const uniqueDiscs = new Set(discNumbers);
    const isMultiDisc = uniqueDiscs.size > 1;
    const discCount = isMultiDisc ? uniqueDiscs.size : 1;

    const totalSize = gameFiles.reduce((sum, f) => sum + f.size, 0);

    // Strip undefined disc from single-disc files for cleaner output
    const cleanedFiles = gameFiles.map((f) => {
      if (f.disc === undefined) {
        return { name: f.name, size: f.size, path: f.path };
      }
      return f;
    });

    results.push({
      id: generateId(title, platform),
      title,
      type: isMultiDisc ? "multi-disc" : "single",
      discCount,
      files: cleanedFiles,
      conversion,
      totalSize,
    });
  }

  return results;
}
