# Scanner ES-DE Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the ROM scanner to ES-DE parity with recursive directory scanning, comprehensive platform support, and complete extension coverage.

**Architecture:** Expand `PLATFORM_CONFIG` in `platforms.ts` with all ES-DE systems found on the user's Steam Deck. Add a `subdir` field to `PlatformDef` for systems that store ROMs in a subdirectory (e.g. `xbox/roms/`, `wiiu/roms/`). Modify the scanner to recursively search within platform directories (max depth 2) to find ROMs in subdirectories. All changes are backwards-compatible — existing scans still work.

**Tech Stack:** TypeScript, Prisma 6.x (SQLite), SSH2 SFTP

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/lib/platforms.ts` | Add `subdir?` field to `PlatformDef`, expand from 51 to ~95 platforms with complete extensions |
| `src/lib/scanner.ts` | Recursive scan within platform dirs (depth 2), respect `subdir` field |
| `src/lib/igdb.ts` | Add IGDB platform ID mappings for new systems |

---

### Task 1: Add `subdir` Field and Expand Platform Config

**Files:**
- Modify: `src/lib/platforms.ts`

- [ ] **Step 1: Add `subdir` field to PlatformDef interface**

In `src/lib/platforms.ts`, add `subdir?` to the `PlatformDef` interface after `dirs`:

```typescript
export interface PlatformDef {
  id: string;
  label: string;
  slug?: string;
  icon: string;
  color: string;
  sortOrder: number;
  dirs: string[];
  /** If ROMs live in a subdirectory within the platform dir (e.g. "roms" for xbox/roms/) */
  subdir?: string;
  extensions: string[];
}
```

- [ ] **Step 2: Update existing platforms with complete extensions and subdir**

Update these existing platform entries to add missing extensions (sourced from ES-DE es_systems.xml defaults) and `subdir` where needed. All extensions are lowercase, `.7z` and `.zip` are handled globally by the scanner so they are NOT listed per-platform:

```typescript
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
{ id: "wsc", label: "WonderSwan Color", icon: "📱", color: "#6366f1", sortOrder: 71, dirs: ["wonderswancolor", "wonderswan-color", "wsc"], extensions: [".wsc"] },

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
```

Note the key changes:
- `xbox`, `xbox360`, `wiiu`, `model2` get `subdir: "roms"` 
- Many new dirs added to existing platforms (`sfc` for SNES, `megadrivejp`, `saturnjp`, `neogeocdjp`, `sega32xjp/na`, `n64dd`, `fds` for NES, `pcenginecd`, `tg-cd`, etc.)
- Extensions expanded from ES-DE defaults (e.g. NES gets `.fds`, `.unf`, `.unif`; SNES gets `.swc`, `.fig`, `.bs`; N3DS gets `.3dsx`, `.cci`, `.cxi`, `.app`, `.axf`, `.elf`)
- New platforms: `jaguarcd`, `atari800`/`atarist`, `model2`, `odyssey2`, `channelf`, `bbcmicro`, `x68000`, `pico8`

- [ ] **Step 3: Verify build**

Run:
```bash
pnpm build 2>&1 | tail -5
```
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/lib/platforms.ts
git commit -m "feat: expand platform config — subdir field, 95+ systems, complete extensions"
```

---

### Task 2: Recursive Scan Within Platform Directories

**Files:**
- Modify: `src/lib/scanner.ts`

- [ ] **Step 1: Modify scanDevice to handle subdirs and recursive scanning**

In `src/lib/scanner.ts`, update the ROM scanning block inside `scanDevice()`. Replace the current logic (lines ~60-76):

```typescript
if (scanPath.type === "rom") {
  const dirs = await conn.listDir(scanPath.path);
  for (const dir of dirs) {
    if (dir.type !== "dir" && dir.type !== "symlink") continue;
    // Skip multidisc directories — their games are represented by .m3u in the main dir
    if (dir.name.endsWith("-multidisc")) continue;
    const subEntries = await conn.listDir(`${scanPath.path}/${dir.name}`);
    // Skip subdirectories — files and symlinks (to ROM files) pass through
    // Extension filter in parseRomListing catches any remaining non-ROM entries
    const listing = subEntries
      .filter((e) => e.type !== "dir")
      .map((e) => e.name)
      .join("\n");
    if (listing) {
      const games = parseRomListing(listing, dir.name);
      allGames.push(...games);
    }
  }
```

With this new version:

```typescript
if (scanPath.type === "rom") {
  const dirs = await conn.listDir(scanPath.path);
  for (const dir of dirs) {
    if (dir.type !== "dir" && dir.type !== "symlink") continue;
    if (dir.name.endsWith("-multidisc")) continue;

    // Check if platform uses a subdir (e.g. xbox/roms/, wiiu/roms/)
    const platformDef = getPlatformByDir(dir.name);
    const basePath = `${scanPath.path}/${dir.name}`;
    const romPath = platformDef?.subdir
      ? `${basePath}/${platformDef.subdir}`
      : basePath;

    // Collect ROM files — scan top-level + one level of subdirectories
    const allFiles: string[] = [];
    try {
      const entries = await conn.listDir(romPath);
      for (const entry of entries) {
        if (entry.type === "file" || entry.type === "symlink") {
          allFiles.push(entry.name);
        } else if (entry.type === "dir") {
          // Recurse one level into subdirectories (for region/genre folders)
          try {
            const subEntries = await conn.listDir(`${romPath}/${entry.name}`);
            for (const sub of subEntries) {
              if (sub.type !== "dir") {
                allFiles.push(sub.name);
              }
            }
          } catch {
            // Skip inaccessible subdirs
          }
        }
      }
    } catch {
      // subdir doesn't exist — skip (e.g. xbox/roms/ not created yet)
      if (platformDef?.subdir) continue;
      // Not a subdir platform — re-throw or skip
      continue;
    }

    const listing = allFiles.join("\n");
    if (listing) {
      const games = parseRomListing(listing, dir.name);
      allGames.push(...games);
    }
  }
```

Key changes:
- If `platformDef.subdir` is set, scan `{platformDir}/{subdir}/` instead of `{platformDir}/`
- Recurse one level into subdirectories within platform dirs
- All ROM files (from top-level and subdirs) are collected into a flat list
- `parseRomListing` still handles extension filtering and title cleaning

- [ ] **Step 2: Verify build**

Run:
```bash
pnpm build 2>&1 | tail -5
```
Expected: Build succeeds.

- [ ] **Step 3: Test with SSH scan**

Run a test scan against the Steam Deck to verify:
```bash
npx tsx -e "
import { scanDevice } from './src/lib/scanner';
(async () => {
  const games = await scanDevice({
    id: 2, protocol: 'ssh', host: '192.168.178.131', port: 22,
    user: 'deck', password: '03388476',
    scanPaths: [{ path: '/home/deck/EmuVirtual/Emulation/roms', type: 'rom' }],
    blacklist: [],
  });
  const byPlatform: Record<string,number> = {};
  for (const g of games) byPlatform[g.platform] = (byPlatform[g.platform] || 0) + 1;
  console.log('Total:', games.length);
  Object.entries(byPlatform).sort((a,b) => b[1] - a[1]).forEach(([p, c]) => console.log('  ' + p + ': ' + c));
  // Verify xbox, wiiu, xbox360 now have games
  console.log('');
  console.log('Xbox:', byPlatform['xbox'] || 0, '(expected ~6)');
  console.log('Wii U:', byPlatform['wiiu'] || 0, '(expected ~7)');
  console.log('Xbox 360:', byPlatform['xbox360'] || 0, '(expected ~7)');
  process.exit(0);
})();
"
```
Expected: Xbox ~6, Wii U ~7, Xbox 360 ~7, total > 2251.

- [ ] **Step 4: Commit**

```bash
git add src/lib/scanner.ts
git commit -m "feat: recursive ROM scan + subdir support for ES-DE parity"
```

---

### Task 3: Update IGDB Platform Mappings

**Files:**
- Modify: `src/lib/igdb.ts`

- [ ] **Step 1: Add IGDB platform ID mappings for new systems**

In `src/lib/igdb.ts`, find the `PLATFORM_MAP` (or equivalent IGDB platform ID mapping) and add entries for all new platforms. The IGDB platform IDs are:

```typescript
// Add these to the existing platform map:
jaguarcd: 171,    // Atari Jaguar CD
atarist: 63,      // Atari ST/STE
atari800: 65,     // Atari 8-bit (400/800/XL/XE)
model2: 52,       // Arcade (generic)
odyssey2: 133,    // Philips Odyssey 2
channelf: 127,    // Fairchild Channel F
bbcmicro: 69,     // BBC Microcomputer
x68000: 121,      // Sharp X68000
pico8: 6,         // PC (generic, no IGDB platform)
```

- [ ] **Step 2: Verify build**

Run:
```bash
pnpm build 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/igdb.ts
git commit -m "feat: add IGDB platform mappings for new systems"
```

---

### Task 4: Build Verification & Integration Test

- [ ] **Step 1: Full build**

Run:
```bash
rm -rf .next && pnpm build
```
Expected: Clean build.

- [ ] **Step 2: Run full scan test**

Start dev server, configure devices, scan. Verify:
1. Xbox, Wii U, Xbox 360 games appear (subdir scanning works)
2. No directories imported as games
3. Multi-disc .m3u games still work
4. Platform counts in sidebar are correct
5. New platforms (if ROMs exist) appear in sidebar
