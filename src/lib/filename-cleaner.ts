const SKIP_EXTENSIONS = new Set([".sbi", ".txt", ".xml", ".json", ".png", ".jpg", ".cue", ".log", ".sub", ".idx"]);

const KNOWN_EXTENSIONS = /\.(chd|rvz|7z|zip|iso|bin|cue|gba|gb|gbc|nes|sfc|smc|sms|n64|z64|v64|nds|3ds|cia|xci|nsp|gcm|gg|md|smd|gen|32x|cdi|gdi|pbp|cso|xex|god|wad|dsi|app|pce|sgx|lnx|ngp|ngc|ws|wsc|col|a26|a78|j64|jag|vb|vec|sg|sc|mx1|mx2|dsk|tap|tzx|t64|d64|crt|prg|adf|hdf|ipf|ndd|fds|qd|bs|st|cas|rom|m3u|vpk|wbfs|rpx|wux|wud)$/i;

export function cleanFilename(filename: string): string {
  const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();
  if (SKIP_EXTENSIONS.has(ext)) return "";

  let name = filename.replace(KNOWN_EXTENSIONS, "");

  // Strip parenthetical tags: (USA), (Europe), (v2.00), (Disc 1), (Rev 1), etc.
  name = name.replace(/\s*\([^)]*\)/g, "");

  // Strip bracket tags: [!], [b], etc.
  name = name.replace(/\s*\[[^\]]*\]/g, "");

  // If title has ~ separator (alternate names), take the first part
  // e.g., "Bare Knuckle II ~ Streets of Rage 2" → "Bare Knuckle II"
  if (name.includes(" ~ ")) {
    name = name.split(" ~ ")[0];
  }

  // Strip subtitle after " - " only for very long titles (>60 chars)
  // Helps IGDB matching: "F355 Challenge - Passione Rossa" stays, but very long compound names get trimmed
  if (name.length > 60 && name.includes(" - ")) {
    name = name.split(" - ")[0];
  }

  return name.trim();
}
