export interface PlatformDef {
  id: string;
  label: string;
  /** URL-safe slug for ROM search sites (defaults to slugified label if omitted) */
  slug?: string;
  icon: string;
  color: string;
  sortOrder: number;
  dirs: string[];
  /** If ROMs live in a subdirectory within the platform dir (e.g. "roms" for xbox/roms/) */
  subdir?: string;
  extensions: string[];
}

export const PLATFORM_CONFIG: PlatformDef[] = [
  // ── Nintendo Handhelds ──
  { id: "gb", label: "Game Boy", icon: "🎲", color: "#6d28d9", sortOrder: 1, dirs: ["gb", "gameboy", "game-boy"], extensions: [".gb"] },
  { id: "gbc", label: "Game Boy Color", icon: "🟣", color: "#a855f7", sortOrder: 2, dirs: ["gbc", "gameboy-color", "game-boy-color", "gameboycolor"], extensions: [".gbc"] },
  { id: "gba", label: "Game Boy Advance", icon: "📱", color: "#8b5cf6", sortOrder: 3, dirs: ["gba", "gameboy-advance", "game-boy-advance", "gameboyadvance"], extensions: [".gba"] },
  { id: "nds", label: "Nintendo DS", icon: "📱", color: "#64748b", sortOrder: 4, dirs: ["nds", "ds", "nintendo-ds", "nintendods"], extensions: [".nds", ".app"] },
  { id: "n3ds", label: "Nintendo 3DS", icon: "📱", color: "#ec4899", sortOrder: 5, dirs: ["n3ds", "3ds", "nintendo-3ds"], extensions: [".3ds", ".3dsx", ".cci", ".cxi", ".cia", ".app", ".axf", ".elf"] },
  { id: "virtualboy", label: "Virtual Boy", icon: "🔴", color: "#b91c1c", sortOrder: 6, dirs: ["virtualboy", "virtual-boy", "vb"], extensions: [".vb"] },
  { id: "pokemini", label: "Pokemon Mini", icon: "⚡", color: "#eab308", sortOrder: 7, dirs: ["pokemini", "pokemon-mini"], extensions: [".min"] },

  // ── Nintendo Home Consoles ──
  { id: "nes", label: "Nintendo Entertainment System", icon: "🎮", color: "#dc2626", sortOrder: 10, dirs: ["nes", "famicom"], extensions: [".nes", ".unf", ".unif", ".fds"] },
  { id: "snes", label: "Super Nintendo", icon: "🎮", color: "#7c3aed", sortOrder: 11, dirs: ["snes", "sfc", "super-nintendo", "super-famicom", "supernintendo", "superfamicom", "snesna", "sneshd"], extensions: [".sfc", ".smc", ".swc", ".fig", ".bs"] },
  { id: "n64", label: "Nintendo 64", icon: "🎯", color: "#16a34a", sortOrder: 12, dirs: ["n64", "nintendo64", "nintendo-64", "n64dd"], extensions: [".n64", ".z64", ".v64", ".ndd"] },
  { id: "gc", label: "GameCube", icon: "🟪", color: "#7c3aed", sortOrder: 13, dirs: ["gc", "gamecube", "gc-multidisc", "nintendo-gamecube"], extensions: [".iso", ".gcm", ".rvz", ".ciso", ".gcz", ".wbfs"] },
  { id: "wii", label: "Nintendo Wii", icon: "🕹️", color: "#60a5fa", sortOrder: 14, dirs: ["wii", "nintendo-wii"], extensions: [".wbfs", ".iso", ".rvz", ".ciso", ".gcz", ".wad", ".dol", ".elf"] },
  { id: "wiiu", label: "Nintendo Wii U", icon: "🎮", color: "#0ea5e9", sortOrder: 15, dirs: ["wiiu", "wii-u", "nintendo-wiiu"], subdir: "roms", extensions: [".wud", ".wux", ".wua", ".rpx", ".wuhb", ".elf", ".tmd"] },
  { id: "switch", label: "Nintendo Switch", icon: "🔴", color: "#e11d48", sortOrder: 16, dirs: ["switch", "nintendo-switch"], extensions: [".nsp", ".xci", ".nca", ".nro", ".nso"] },

  // ── Sega ──
  { id: "sg1000", label: "SG-1000", icon: "🔵", color: "#1e3a5f", sortOrder: 20, dirs: ["sg1000", "sg-1000"], extensions: [".sg", ".sc"] },
  { id: "mastersystem", label: "Master System", icon: "🔴", color: "#ef4444", sortOrder: 21, dirs: ["mastersystem", "master-system", "sms"], extensions: [".sms", ".bin", ".gg"] },
  { id: "megadrive", label: "Mega Drive / Genesis", slug: "sega-genesis", icon: "🕹️", color: "#1d4ed8", sortOrder: 22, dirs: ["megadrive", "genesis", "mega-drive", "sega-genesis", "segagenesis", "megadrivejp", "genesiswide"], extensions: [".md", ".smd", ".gen", ".bin", ".68k", ".sgd"] },
  { id: "segacd", label: "Sega CD", icon: "💿", color: "#0891b2", sortOrder: 23, dirs: ["segacd", "sega-cd", "mega-cd", "megacd", "megacdjp"], extensions: [".chd", ".iso", ".bin", ".cue"] },
  { id: "sega32x", label: "Sega 32X", icon: "🔶", color: "#d97706", sortOrder: 24, dirs: ["sega32x", "32x", "sega-32x", "sega32xjp", "sega32xna"], extensions: [".32x", ".bin", ".smd", ".md"] },
  { id: "saturn", label: "Sega Saturn", icon: "🪐", color: "#6366f1", sortOrder: 25, dirs: ["saturn", "saturn-multidisc", "sega-saturn", "saturnjp"], extensions: [".chd", ".iso", ".bin", ".cue", ".ccd", ".mds"] },
  { id: "dreamcast", label: "Dreamcast", icon: "🌀", color: "#f97316", sortOrder: 26, dirs: ["dreamcast", "dreamcast-multidisc"], extensions: [".chd", ".gdi", ".cdi", ".bin", ".cue", ".elf"] },
  { id: "gamegear", label: "Game Gear", icon: "🔵", color: "#2563eb", sortOrder: 27, dirs: ["gamegear", "game-gear"], extensions: [".gg", ".bin"] },
  { id: "model2", label: "Sega Model 2", icon: "🕹️", color: "#0369a1", sortOrder: 28, dirs: ["model2"], subdir: "roms", extensions: [".zip"] },

  // ── Sony ──
  { id: "psx", label: "PlayStation", icon: "🎮", color: "#3b82f6", sortOrder: 30, dirs: ["psx", "psx-multidisc", "ps1", "playstation", "playstation1"], extensions: [".chd", ".iso", ".bin", ".cue", ".pbp", ".ecm", ".mds"] },
  { id: "ps2", label: "PlayStation 2", icon: "🎮", color: "#1e40af", sortOrder: 31, dirs: ["ps2", "playstation2", "playstation-2", "ps2-multidisc"], extensions: [".chd", ".iso", ".bin", ".cso", ".cue", ".gz"] },
  { id: "ps3", label: "PlayStation 3", icon: "🎮", color: "#1e3a5f", sortOrder: 32, dirs: ["ps3", "playstation3", "playstation-3"], extensions: [".iso", ".bin"] },
  { id: "psp", label: "PlayStation Portable", icon: "📱", color: "#475569", sortOrder: 33, dirs: ["psp", "playstation-portable"], extensions: [".iso", ".cso", ".pbp", ".chd"] },
  { id: "psvita", label: "PlayStation Vita", icon: "📱", color: "#1e40af", sortOrder: 34, dirs: ["psvita", "vita", "ps-vita"], extensions: [".vpk"] },

  // ── Microsoft ──
  { id: "xbox", label: "Xbox", icon: "🟢", color: "#16a34a", sortOrder: 40, dirs: ["xbox", "xbox-og", "originalxbox"], subdir: "roms", extensions: [".iso"] },
  { id: "xbox360", label: "Xbox 360", icon: "🟢", color: "#22c55e", sortOrder: 41, dirs: ["xbox360", "xbox-360"], subdir: "roms", extensions: [".iso", ".xex", ".zar"] },

  // ── Atari ──
  { id: "atari2600", label: "Atari 2600", icon: "🕹️", color: "#92400e", sortOrder: 50, dirs: ["atari2600", "atari-2600", "2600"], extensions: [".a26", ".bin"] },
  { id: "atari5200", label: "Atari 5200", icon: "🕹️", color: "#a16207", sortOrder: 51, dirs: ["atari5200", "atari-5200", "5200"], extensions: [".a52", ".bin", ".rom"] },
  { id: "atari7800", label: "Atari 7800", icon: "🕹️", color: "#b45309", sortOrder: 52, dirs: ["atari7800", "atari-7800", "7800"], extensions: [".a78", ".bin"] },
  { id: "atari800", label: "Atari 800", icon: "🕹️", color: "#854d0e", sortOrder: 53, dirs: ["atari800", "atari-800", "atarixe"], extensions: [".atr", ".atx", ".bas", ".bin", ".car", ".cas", ".com", ".rom", ".xex", ".xfd"] },
  { id: "lynx", label: "Atari Lynx", icon: "🔶", color: "#ea580c", sortOrder: 54, dirs: ["lynx", "atari-lynx", "atarilynx"], extensions: [".lnx", ".o"] },
  { id: "jaguar", label: "Atari Jaguar", icon: "🐆", color: "#991b1b", sortOrder: 55, dirs: ["jaguar", "atari-jaguar", "atarijaguar"], extensions: [".j64", ".jag", ".abs", ".bin", ".cof", ".cue", ".prg", ".rom"] },
  { id: "jaguarcd", label: "Atari Jaguar CD", icon: "🐆", color: "#7f1d1d", sortOrder: 56, dirs: ["atarijaguarcd", "jaguar-cd", "jaguarcd"], extensions: [".abs", ".bin", ".cdi", ".cof", ".cue", ".j64", ".jag", ".prg", ".rom"] },
  { id: "atarist", label: "Atari ST", icon: "💾", color: "#78350f", sortOrder: 57, dirs: ["atarist", "atari-st"], extensions: [".st", ".stx", ".msa", ".dim", ".ipf", ".rom"] },

  // ── NEC ──
  { id: "pcengine", label: "TurboGrafx-16 / PC Engine", slug: "turbografx-16", icon: "🔴", color: "#e11d48", sortOrder: 60, dirs: ["pcengine", "pc-engine", "tg16", "turbografx", "turbografx16", "tg-16", "pcenginecd", "pce", "tg-cd", "supergrafx", "sgb"], extensions: [".pce", ".chd", ".cue", ".iso", ".sgx"] },
  { id: "pcfx", label: "PC-FX", icon: "💿", color: "#be123c", sortOrder: 61, dirs: ["pcfx", "pc-fx"], extensions: [".chd", ".iso", ".cue"] },

  // ── SNK ──
  { id: "neogeo", label: "Neo Geo", icon: "🕹️", color: "#b91c1c", sortOrder: 65, dirs: ["neogeo", "neo-geo", "neogeoaes", "neogeo-aes"], extensions: [".zip"] },
  { id: "neogeocd", label: "Neo Geo CD", icon: "💿", color: "#991b1b", sortOrder: 66, dirs: ["neogeocd", "neo-geo-cd", "neocd", "neogeocdjp"], extensions: [".chd", ".iso", ".cue"] },
  { id: "ngp", label: "Neo Geo Pocket", icon: "📱", color: "#9f1239", sortOrder: 67, dirs: ["ngp", "neo-geo-pocket", "neogeopocket"], extensions: [".ngp", ".ngc"] },
  { id: "ngpc", label: "Neo Geo Pocket Color", icon: "📱", color: "#be185d", sortOrder: 68, dirs: ["ngpc", "neo-geo-pocket-color", "neogeopocketcolor"], extensions: [".ngc", ".ngp"] },

  // ── Bandai ──
  { id: "wonderswan", label: "WonderSwan", icon: "📱", color: "#4338ca", sortOrder: 70, dirs: ["wonderswan", "wonder-swan", "ws"], extensions: [".ws"] },
  { id: "wsc", label: "WonderSwan Color", icon: "📱", color: "#6366f1", sortOrder: 71, dirs: ["wonderswancolor", "wonderswan-color", "wsc", "wscolor"], extensions: [".wsc"] },

  // ── 3DO / Other Consoles ──
  { id: "3do", label: "3DO", icon: "💿", color: "#b45309", sortOrder: 75, dirs: ["3do", "panasonic-3do"], extensions: [".chd", ".iso", ".cue", ".bin"] },
  { id: "coleco", label: "ColecoVision", icon: "🕹️", color: "#1e3a5f", sortOrder: 76, dirs: ["coleco", "colecovision"], extensions: [".col", ".bin", ".rom"] },
  { id: "vectrex", label: "Vectrex", icon: "🕹️", color: "#334155", sortOrder: 77, dirs: ["vectrex"], extensions: [".vec", ".bin", ".gam"] },
  { id: "intellivision", label: "Intellivision", icon: "🕹️", color: "#1e3a5f", sortOrder: 78, dirs: ["intellivision"], extensions: [".int", ".bin", ".rom"] },
  { id: "odyssey2", label: "Odyssey 2", icon: "🕹️", color: "#4a044e", sortOrder: 79, dirs: ["odyssey2", "videopac"], extensions: [".bin"] },
  { id: "channelf", label: "Channel F", icon: "🕹️", color: "#713f12", sortOrder: 80, dirs: ["channelf"], extensions: [".bin", ".chf", ".rom"] },

  // ── Computers ──
  { id: "dos", label: "DOS", icon: "💾", color: "#1e293b", sortOrder: 81, dirs: ["dos", "dosbox", "pc-dos", "pc"], extensions: [".exe", ".com", ".bat", ".conf", ".dosz"] },
  { id: "c64", label: "Commodore 64", icon: "💾", color: "#713f12", sortOrder: 82, dirs: ["c64", "commodore64", "commodore-64", "c16", "vic20"], extensions: [".d64", ".t64", ".prg", ".crt", ".tap", ".g64", ".p00", ".vsf"] },
  { id: "amiga", label: "Amiga", icon: "💾", color: "#b91c1c", sortOrder: 83, dirs: ["amiga", "commodore-amiga", "amiga600", "amiga1200", "amigacd32", "cdtv"], extensions: [".adf", ".lha", ".hdf", ".ipf", ".dms", ".adz", ".rp9", ".chd", ".iso", ".cue"] },
  { id: "msx", label: "MSX", icon: "💾", color: "#1e40af", sortOrder: 84, dirs: ["msx", "msx1", "msx2", "msxturbor"], extensions: [".rom", ".mx1", ".mx2", ".dsk", ".cas", ".col"] },
  { id: "zxspectrum", label: "ZX Spectrum", icon: "💾", color: "#dc2626", sortOrder: 85, dirs: ["zxspectrum", "zx-spectrum", "spectrum", "zx81"], extensions: [".z80", ".tap", ".tzx", ".sna", ".szx", ".rzx", ".dsk", ".scl", ".trd"] },
  { id: "amstrad", label: "Amstrad CPC", icon: "💾", color: "#1d4ed8", sortOrder: 86, dirs: ["amstradcpc", "amstrad", "amstrad-cpc", "cpc", "gx4000"], extensions: [".dsk", ".sna", ".cdt", ".cpr", ".kcr"] },
  { id: "bbcmicro", label: "BBC Micro", icon: "💾", color: "#4d7c0f", sortOrder: 87, dirs: ["bbcmicro", "bbc-micro"], extensions: [".ssd", ".dsd", ".uef", ".csw"] },
  { id: "x68000", label: "Sharp X68000", icon: "💾", color: "#0f172a", sortOrder: 88, dirs: ["x68000", "x68k"], extensions: [".dim", ".m3u", ".img", ".d88", ".88d", ".hdm", ".dup", ".2hd", ".xdf", ".hdf", ".cmd"] },

  // ── Arcade ──
  { id: "arcade", label: "Arcade", icon: "🕹️", color: "#f59e0b", sortOrder: 90, dirs: ["arcade", "mame", "mame-advmame", "mame-mame4all", "fbneo", "fbalpha", "fba", "cps", "cps1", "cps2", "cps3", "daphne"], extensions: [".zip"] },
  { id: "naomi", label: "Naomi", icon: "🕹️", color: "#d97706", sortOrder: 91, dirs: ["naomi", "sega-naomi", "naomi2", "naomigd"], extensions: [".chd", ".zip", ".dat", ".bin", ".lst"] },
  { id: "atomiswave", label: "Atomiswave", icon: "🕹️", color: "#ca8a04", sortOrder: 92, dirs: ["atomiswave"], extensions: [".zip", ".bin"] },

  // ── Other ──
  { id: "scummvm", label: "ScummVM", icon: "🎭", color: "#065f46", sortOrder: 95, dirs: ["scummvm"], extensions: [] },
  { id: "pico8", label: "PICO-8", icon: "🕹️", color: "#db2777", sortOrder: 96, dirs: ["pico8", "pico-8"], extensions: [".p8", ".png"] },
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
