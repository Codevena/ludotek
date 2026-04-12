export interface PlatformDef {
  id: string;
  label: string;
  icon: string;
  color: string;
  sortOrder: number;
  dirs: string[];
}

export const PLATFORM_CONFIG: PlatformDef[] = [
  { id: "snes", label: "Super Nintendo", icon: "🎮", color: "#7c3aed", sortOrder: 1, dirs: ["snes"] },
  { id: "gba", label: "Game Boy Advance", icon: "📱", color: "#8b5cf6", sortOrder: 2, dirs: ["gba"] },
  { id: "gb", label: "Game Boy", icon: "🎲", color: "#6d28d9", sortOrder: 3, dirs: ["gb"] },
  { id: "megadrive", label: "Mega Drive / Genesis", icon: "🕹️", color: "#1d4ed8", sortOrder: 4, dirs: ["megadrive"] },
  { id: "nes", label: "Nintendo Entertainment System", icon: "🎮", color: "#dc2626", sortOrder: 5, dirs: ["nes"] },
  { id: "gbc", label: "Game Boy Color", icon: "🟣", color: "#a855f7", sortOrder: 6, dirs: ["gbc"] },
  { id: "gamegear", label: "Game Gear", icon: "🔵", color: "#2563eb", sortOrder: 7, dirs: ["gamegear"] },
  { id: "mastersystem", label: "Master System", icon: "🔴", color: "#ef4444", sortOrder: 8, dirs: ["mastersystem"] },
  { id: "n64", label: "Nintendo 64", icon: "🎯", color: "#16a34a", sortOrder: 9, dirs: ["n64"] },
  { id: "psx", label: "PlayStation", icon: "🎮", color: "#3b82f6", sortOrder: 10, dirs: ["psx", "psx-multidisc"] },
  { id: "ps2", label: "PlayStation 2", icon: "🎮", color: "#1e40af", sortOrder: 11, dirs: ["ps2"] },
  { id: "dreamcast", label: "Dreamcast", icon: "🌀", color: "#f97316", sortOrder: 12, dirs: ["dreamcast", "dreamcast-multidisc"] },
  { id: "saturn", label: "Sega Saturn", icon: "🪐", color: "#6366f1", sortOrder: 13, dirs: ["saturn", "saturn-multidisc"] },
  { id: "gc", label: "GameCube", icon: "🟪", color: "#7c3aed", sortOrder: 14, dirs: ["gc", "gamecube", "gc-multidisc"] },
  { id: "switch", label: "Nintendo Switch", icon: "🔴", color: "#e11d48", sortOrder: 15, dirs: ["switch"] },
  { id: "segacd", label: "Sega CD", icon: "💿", color: "#0891b2", sortOrder: 16, dirs: ["segacd"] },
  { id: "n3ds", label: "Nintendo 3DS", icon: "📱", color: "#ec4899", sortOrder: 17, dirs: ["n3ds", "3ds"] },
  { id: "xbox360", label: "Xbox 360", icon: "🟢", color: "#22c55e", sortOrder: 18, dirs: ["xbox360"] },
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

export function getAllPlatforms(): PlatformDef[] {
  return PLATFORM_CONFIG;
}
