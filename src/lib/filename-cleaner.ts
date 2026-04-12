const SKIP_EXTENSIONS = new Set([".sbi", ".txt", ".xml", ".json", ".png", ".jpg"]);

const KNOWN_EXTENSIONS = /\.(chd|rvz|7z|zip|iso|bin|cue|gba|gb|gbc|nes|sfc|smc|n64|z64|v64|nds|3ds|cia|xci|nsp|gcm|gg|md|smd|gen|32x|cdi|gdi|pbp|cso|xex|god)$/i;

export function cleanFilename(filename: string): string {
  const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();
  if (SKIP_EXTENSIONS.has(ext)) return "";

  let name = filename.replace(KNOWN_EXTENSIONS, "");

  // Strip parenthetical tags: (USA), (Europe), (v2.00), (Disc 1), (Rev 1), etc.
  name = name.replace(/\s*\([^)]*\)/g, "");

  // Strip bracket tags: [!], [b], etc.
  name = name.replace(/\s*\[[^\]]*\]/g, "");

  return name.trim();
}
