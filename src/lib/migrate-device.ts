import { prisma } from "./prisma";

const DEFAULT_STEAM_DECK_PATHS = [
  { path: "/run/media/deck/SD/Emulation/roms", type: "rom" },
  { path: "/run/media/deck/SD/Games", type: "steam" },
  { path: "/home/deck/.local/share/Steam/steamapps/common", type: "steam" },
];

const DEFAULT_STEAM_DECK_BLACKLIST = [
  "Proton *",
  "SteamLinuxRuntime*",
  "Steamworks Common Redistributables",
  "SteamworksShared",
];

export async function migrateSettingsToDevice(): Promise<void> {
  const deviceCount = await prisma.device.count();
  if (deviceCount > 0) return;

  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  if (!settings?.deckHost) return;

  await prisma.device.create({
    data: {
      name: "Steam Deck",
      type: "steamdeck",
      protocol: "ssh",
      host: settings.deckHost,
      port: 22,
      user: settings.deckUser || "deck",
      password: settings.deckPassword || "",
      scanPaths: JSON.stringify(DEFAULT_STEAM_DECK_PATHS),
      blacklist: JSON.stringify(DEFAULT_STEAM_DECK_BLACKLIST),
    },
  });

  console.warn("Migrated Steam Deck SSH settings to Device model");
}
