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
  // ── Nintendo Handhelds ──
  { id: "gb", label: "Game Boy", icon: "🎲", color: "#6d28d9", sortOrder: 1, dirs: ["gb", "gameboy", "game-boy"], extensions: [".gb"] },
  { id: "gbc", label: "Game Boy Color", icon: "🟣", color: "#a855f7", sortOrder: 2, dirs: ["gbc", "gameboy-color", "game-boy-color", "gameboycolor"], extensions: [".gbc"] },
  { id: "gba", label: "Game Boy Advance", icon: "📱", color: "#8b5cf6", sortOrder: 3, dirs: ["gba", "gameboy-advance", "game-boy-advance", "gameboyadvance"], extensions: [".gba"] },
  { id: "nds", label: "Nintendo DS", icon: "📱", color: "#64748b", sortOrder: 4, dirs: ["nds", "ds", "nintendo-ds", "nintendods"], extensions: [".nds"] },
  { id: "n3ds", label: "Nintendo 3DS", icon: "📱", color: "#ec4899", sortOrder: 5, dirs: ["n3ds", "3ds", "nintendo-3ds"], extensions: [".3ds", ".cia"] },
  { id: "virtualboy", label: "Virtual Boy", icon: "🔴", color: "#b91c1c", sortOrder: 6, dirs: ["virtualboy", "virtual-boy", "vb"], extensions: [".vb"] },
  { id: "pokemini", label: "Pokemon Mini", icon: "⚡", color: "#eab308", sortOrder: 7, dirs: ["pokemini", "pokemon-mini"], extensions: [".min"] },

  // ── Nintendo Home Consoles ──
  { id: "nes", label: "Nintendo Entertainment System", icon: "🎮", color: "#dc2626", sortOrder: 10, dirs: ["nes", "famicom"], extensions: [".nes"] },
  { id: "snes", label: "Super Nintendo", icon: "🎮", color: "#7c3aed", sortOrder: 11, dirs: ["snes", "super-nintendo", "super-famicom", "supernintendo", "superfamicom"], extensions: [".sfc", ".smc"] },
  { id: "n64", label: "Nintendo 64", icon: "🎯", color: "#16a34a", sortOrder: 12, dirs: ["n64", "nintendo64", "nintendo-64"], extensions: [".n64", ".z64", ".v64"] },
  { id: "gc", label: "GameCube", icon: "🟪", color: "#7c3aed", sortOrder: 13, dirs: ["gc", "gamecube", "gc-multidisc", "nintendo-gamecube"], extensions: [".iso", ".gcm", ".rvz"] },
  { id: "wii", label: "Nintendo Wii", icon: "🕹️", color: "#60a5fa", sortOrder: 14, dirs: ["wii", "nintendo-wii"], extensions: [".wbfs", ".iso", ".rvz"] },
  { id: "wiiu", label: "Nintendo Wii U", icon: "🎮", color: "#0ea5e9", sortOrder: 15, dirs: ["wiiu", "wii-u", "nintendo-wiiu"], extensions: [".wud", ".wux", ".rpx"] },
  { id: "switch", label: "Nintendo Switch", icon: "🔴", color: "#e11d48", sortOrder: 16, dirs: ["switch", "nintendo-switch"], extensions: [".nsp", ".xci"] },

  // ── Sega ──
  { id: "sg1000", label: "SG-1000", icon: "🔵", color: "#1e3a5f", sortOrder: 20, dirs: ["sg1000", "sg-1000"], extensions: [".sg"] },
  { id: "mastersystem", label: "Master System", icon: "🔴", color: "#ef4444", sortOrder: 21, dirs: ["mastersystem", "master-system", "sms"], extensions: [".sms"] },
  { id: "megadrive", label: "Mega Drive / Genesis", slug: "sega-genesis", icon: "🕹️", color: "#1d4ed8", sortOrder: 22, dirs: ["megadrive", "genesis", "mega-drive", "sega-genesis", "segagenesis"], extensions: [".md", ".smd", ".gen"] },
  { id: "segacd", label: "Sega CD", icon: "💿", color: "#0891b2", sortOrder: 23, dirs: ["segacd", "sega-cd", "mega-cd", "megacd"], extensions: [".chd", ".iso", ".bin"] },
  { id: "sega32x", label: "Sega 32X", icon: "🔶", color: "#d97706", sortOrder: 24, dirs: ["sega32x", "32x", "sega-32x"], extensions: [".32x"] },
  { id: "saturn", label: "Sega Saturn", icon: "🪐", color: "#6366f1", sortOrder: 25, dirs: ["saturn", "saturn-multidisc", "sega-saturn"], extensions: [".chd", ".iso", ".bin"] },
  { id: "dreamcast", label: "Dreamcast", icon: "🌀", color: "#f97316", sortOrder: 26, dirs: ["dreamcast", "dreamcast-multidisc"], extensions: [".chd", ".gdi", ".cdi"] },
  { id: "gamegear", label: "Game Gear", icon: "🔵", color: "#2563eb", sortOrder: 27, dirs: ["gamegear", "game-gear"], extensions: [".gg"] },

  // ── Sony ──
  { id: "psx", label: "PlayStation", icon: "🎮", color: "#3b82f6", sortOrder: 30, dirs: ["psx", "psx-multidisc", "ps1", "playstation", "playstation1"], extensions: [".chd", ".iso", ".bin", ".pbp"] },
  { id: "ps2", label: "PlayStation 2", icon: "🎮", color: "#1e40af", sortOrder: 31, dirs: ["ps2", "playstation2", "playstation-2", "ps2-multidisc"], extensions: [".chd", ".iso"] },
  { id: "ps3", label: "PlayStation 3", icon: "🎮", color: "#1e3a5f", sortOrder: 32, dirs: ["ps3", "playstation3", "playstation-3"], extensions: [".iso"] },
  { id: "psp", label: "PlayStation Portable", icon: "📱", color: "#475569", sortOrder: 33, dirs: ["psp", "playstation-portable"], extensions: [".iso", ".cso", ".pbp"] },
  { id: "psvita", label: "PlayStation Vita", icon: "📱", color: "#1e40af", sortOrder: 34, dirs: ["psvita", "vita", "ps-vita"], extensions: [".vpk"] },

  // ── Microsoft ──
  { id: "xbox", label: "Xbox", icon: "🟢", color: "#16a34a", sortOrder: 40, dirs: ["xbox", "xbox-og", "originalxbox"], extensions: [".iso"] },
  { id: "xbox360", label: "Xbox 360", icon: "🟢", color: "#22c55e", sortOrder: 41, dirs: ["xbox360", "xbox-360"], extensions: [".iso", ".xex"] },

  // ── Atari ──
  { id: "atari2600", label: "Atari 2600", icon: "🕹️", color: "#92400e", sortOrder: 50, dirs: ["atari2600", "atari-2600", "2600"], extensions: [".a26", ".bin"] },
  { id: "atari5200", label: "Atari 5200", icon: "🕹️", color: "#a16207", sortOrder: 51, dirs: ["atari5200", "atari-5200", "5200"], extensions: [".a52", ".bin"] },
  { id: "atari7800", label: "Atari 7800", icon: "🕹️", color: "#b45309", sortOrder: 52, dirs: ["atari7800", "atari-7800", "7800"], extensions: [".a78", ".bin"] },
  { id: "lynx", label: "Atari Lynx", icon: "🔶", color: "#ea580c", sortOrder: 53, dirs: ["lynx", "atari-lynx", "atarilynx"], extensions: [".lnx"] },
  { id: "jaguar", label: "Atari Jaguar", icon: "🐆", color: "#991b1b", sortOrder: 54, dirs: ["jaguar", "atari-jaguar", "atarijaguar"], extensions: [".j64", ".jag"] },

  // ── NEC ──
  { id: "pcengine", label: "TurboGrafx-16 / PC Engine", slug: "turbografx-16", icon: "🔴", color: "#e11d48", sortOrder: 60, dirs: ["pcengine", "pc-engine", "tg16", "turbografx", "turbografx16", "tg-16", "pcenginecd", "pce"], extensions: [".pce", ".chd"] },
  { id: "pcfx", label: "PC-FX", icon: "💿", color: "#be123c", sortOrder: 61, dirs: ["pcfx", "pc-fx"], extensions: [".chd", ".iso"] },

  // ── SNK ──
  { id: "neogeo", label: "Neo Geo", icon: "🕹️", color: "#b91c1c", sortOrder: 65, dirs: ["neogeo", "neo-geo", "neogeoaes", "neogeo-aes"], extensions: [".zip"] },
  { id: "neogeocd", label: "Neo Geo CD", icon: "💿", color: "#991b1b", sortOrder: 66, dirs: ["neogeocd", "neo-geo-cd", "neocd"], extensions: [".chd", ".iso"] },
  { id: "ngp", label: "Neo Geo Pocket", icon: "📱", color: "#9f1239", sortOrder: 67, dirs: ["ngp", "neo-geo-pocket", "neogeopocket"], extensions: [".ngp"] },
  { id: "ngpc", label: "Neo Geo Pocket Color", icon: "📱", color: "#be185d", sortOrder: 68, dirs: ["ngpc", "neo-geo-pocket-color", "neogeopocketcolor"], extensions: [".ngc"] },

  // ── Bandai ──
  { id: "wonderswan", label: "WonderSwan", icon: "📱", color: "#4338ca", sortOrder: 70, dirs: ["wonderswan", "wonder-swan", "ws"], extensions: [".ws"] },
  { id: "wsc", label: "WonderSwan Color", icon: "📱", color: "#6366f1", sortOrder: 71, dirs: ["wonderswancolor", "wonderswan-color", "wsc"], extensions: [".wsc"] },

  // ── 3DO / Other ──
  { id: "3do", label: "3DO", icon: "💿", color: "#b45309", sortOrder: 75, dirs: ["3do", "panasonic-3do"], extensions: [".chd", ".iso"] },
  { id: "coleco", label: "ColecoVision", icon: "🕹️", color: "#1e3a5f", sortOrder: 76, dirs: ["coleco", "colecovision"], extensions: [".col"] },
  { id: "vectrex", label: "Vectrex", icon: "🕹️", color: "#334155", sortOrder: 77, dirs: ["vectrex"], extensions: [".vec"] },
  { id: "intellivision", label: "Intellivision", icon: "🕹️", color: "#1e3a5f", sortOrder: 78, dirs: ["intellivision"], extensions: [".int"] },

  // ── Computers ──
  { id: "dos", label: "DOS", icon: "💾", color: "#1e293b", sortOrder: 80, dirs: ["dos", "dosbox", "pc-dos"], extensions: [".exe", ".com", ".bat"] },
  { id: "c64", label: "Commodore 64", icon: "💾", color: "#713f12", sortOrder: 81, dirs: ["c64", "commodore64", "commodore-64"], extensions: [".d64", ".t64", ".prg", ".crt"] },
  { id: "amiga", label: "Amiga", icon: "💾", color: "#b91c1c", sortOrder: 82, dirs: ["amiga", "commodore-amiga"], extensions: [".adf", ".lha", ".hdf"] },
  { id: "msx", label: "MSX", icon: "💾", color: "#1e40af", sortOrder: 83, dirs: ["msx", "msx2"], extensions: [".rom", ".mx1", ".mx2"] },
  { id: "zxspectrum", label: "ZX Spectrum", icon: "💾", color: "#dc2626", sortOrder: 84, dirs: ["zxspectrum", "zx-spectrum", "spectrum"], extensions: [".z80", ".tap", ".tzx", ".sna"] },
  { id: "amstrad", label: "Amstrad CPC", icon: "💾", color: "#1d4ed8", sortOrder: 85, dirs: ["amstradcpc", "amstrad", "amstrad-cpc", "cpc"], extensions: [".dsk", ".sna", ".cdt"] },

  // ── Arcade ──
  { id: "arcade", label: "Arcade", icon: "🕹️", color: "#f59e0b", sortOrder: 90, dirs: ["arcade", "mame", "fbneo", "fbalpha", "fbn"], extensions: [".zip", ".7z"] },
  { id: "naomi", label: "Naomi", icon: "🕹️", color: "#d97706", sortOrder: 91, dirs: ["naomi", "sega-naomi"], extensions: [".chd", ".zip"] },
  { id: "atomiswave", label: "Atomiswave", icon: "🕹️", color: "#ca8a04", sortOrder: 92, dirs: ["atomiswave"], extensions: [".zip", ".bin"] },

  // ── Other ──
  { id: "scummvm", label: "ScummVM", icon: "🎭", color: "#065f46", sortOrder: 95, dirs: ["scummvm"], extensions: [] },
  { id: "steam", label: "Steam", icon: "🎮", color: "#171a21", sortOrder: 99, dirs: [], extensions: [] },
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
