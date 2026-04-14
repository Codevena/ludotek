export interface PlatformDef {
  id: string;
  label: string;
  /** URL-safe slug for ROM search sites (defaults to slugified label if omitted) */
  slug?: string;
  icon: string;
  color: string;
  sortOrder: number;
  dirs: string[];
  extensions: string[];
}

export const PLATFORM_CONFIG: PlatformDef[] = [
  { id: "snes", label: "Super Nintendo", icon: "🎮", color: "#7c3aed", sortOrder: 1, dirs: ["snes", "super-nintendo", "super-famicom", "supernintendo", "superfamicom"], extensions: [".sfc", ".smc"] },
  { id: "gba", label: "Game Boy Advance", icon: "📱", color: "#8b5cf6", sortOrder: 2, dirs: ["gba", "gameboy-advance", "game-boy-advance", "gameboyadvance"], extensions: [".gba"] },
  { id: "gb", label: "Game Boy", icon: "🎲", color: "#6d28d9", sortOrder: 3, dirs: ["gb", "gameboy", "game-boy"], extensions: [".gb"] },
  { id: "megadrive", label: "Mega Drive / Genesis", slug: "sega-genesis", icon: "🕹️", color: "#1d4ed8", sortOrder: 4, dirs: ["megadrive", "genesis", "mega-drive", "sega-genesis", "segagenesis"], extensions: [".md", ".smd", ".gen"] },
  { id: "nes", label: "Nintendo Entertainment System", icon: "🎮", color: "#dc2626", sortOrder: 5, dirs: ["nes"], extensions: [".nes"] },
  { id: "gbc", label: "Game Boy Color", icon: "🟣", color: "#a855f7", sortOrder: 6, dirs: ["gbc", "gameboy-color", "game-boy-color", "gameboycolor"], extensions: [".gbc"] },
  { id: "gamegear", label: "Game Gear", icon: "🔵", color: "#2563eb", sortOrder: 7, dirs: ["gamegear", "game-gear"], extensions: [".gg"] },
  { id: "mastersystem", label: "Master System", icon: "🔴", color: "#ef4444", sortOrder: 8, dirs: ["mastersystem", "master-system", "sms"], extensions: [".sms"] },
  { id: "n64", label: "Nintendo 64", icon: "🎯", color: "#16a34a", sortOrder: 9, dirs: ["n64", "nintendo64", "nintendo-64"], extensions: [".n64", ".z64", ".v64"] },
  { id: "psx", label: "PlayStation", icon: "🎮", color: "#3b82f6", sortOrder: 10, dirs: ["psx", "psx-multidisc", "ps1", "playstation", "playstation1"], extensions: [] },
  { id: "ps2", label: "PlayStation 2", icon: "🎮", color: "#1e40af", sortOrder: 11, dirs: ["ps2", "playstation2", "playstation-2"], extensions: [] },
  { id: "dreamcast", label: "Dreamcast", icon: "🌀", color: "#f97316", sortOrder: 12, dirs: ["dreamcast", "dreamcast-multidisc"], extensions: [] },
  { id: "saturn", label: "Sega Saturn", icon: "🪐", color: "#6366f1", sortOrder: 13, dirs: ["saturn", "saturn-multidisc"], extensions: [] },
  { id: "gc", label: "GameCube", icon: "🟪", color: "#7c3aed", sortOrder: 14, dirs: ["gc", "gamecube", "gc-multidisc", "nintendo-gamecube"], extensions: [] },
  { id: "switch", label: "Nintendo Switch", icon: "🔴", color: "#e11d48", sortOrder: 15, dirs: ["switch"], extensions: [] },
  { id: "segacd", label: "Sega CD", icon: "💿", color: "#0891b2", sortOrder: 16, dirs: ["segacd", "sega-cd", "mega-cd", "megacd"], extensions: [] },
  { id: "n3ds", label: "Nintendo 3DS", icon: "📱", color: "#ec4899", sortOrder: 17, dirs: ["n3ds", "3ds", "nintendo-3ds"], extensions: [] },
  { id: "xbox360", label: "Xbox 360", icon: "🟢", color: "#22c55e", sortOrder: 18, dirs: ["xbox360"], extensions: [] },
];

const dirToPlatform = new Map<string, PlatformDef>();
for (const p of PLATFORM_CONFIG) {
  for (const dir of p.dirs) {
    dirToPlatform.set(dir, p);
  }
}

export function getPlatformByDir(dir: string): PlatformDef | undefined {
  return dirToPlatform.get(dir.toLowerCase());
}

const extensionToPlatform = new Map<string, PlatformDef>();
for (const p of PLATFORM_CONFIG) {
  for (const ext of p.extensions) {
    extensionToPlatform.set(ext.toLowerCase(), p);
  }
}

export function getPlatformByExtension(ext: string): PlatformDef | undefined {
  return extensionToPlatform.get(ext.toLowerCase());
}

export function getAllPlatforms(): PlatformDef[] {
  return PLATFORM_CONFIG;
}
