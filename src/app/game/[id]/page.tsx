import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PlatformTag } from "@/components/platform-tag";
import { ScreenshotGallery } from "@/components/screenshot-gallery";
import { MarkdownContent } from "@/components/markdown-content";
import { EnrichWizard } from "@/components/enrich-wizard";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { FavoriteButton } from "@/components/favorite-button";
import { RefreshMetadataButton } from "@/components/refresh-metadata-button";
import { GameFiles } from "@/components/game-files";
import { coverUrl, screenshotUrls, artworkUrls } from "@/lib/image-url";

function safeJsonParse(str: string | null): string[] {
  if (!str) return [];
  try { const parsed = JSON.parse(str); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
}

function scoreColor(score: number): string {
  if (score >= 75) return "text-green-400";
  if (score >= 50) return "text-yellow-400";
  return "text-red-400";
}

interface Props {
  params: Promise<{ id: string }>;
}

export default async function GameDetailPage({ params }: Props) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const gameId = parseInt(id, 10);

  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game) notFound();

  const gameDevices = await prisma.gameDevice.findMany({
    where: { gameId },
    include: { device: { select: { id: true, name: true, scanPaths: true } } },
  });

  const { PLATFORM_CONFIG } = await import("@/lib/platforms");

  const deviceFiles = gameDevices.flatMap((gd) => {
    let scanPaths: { path: string; type: string }[];
    try {
      scanPaths = JSON.parse(gd.device.scanPaths);
    } catch {
      return [];
    }
    if (!Array.isArray(scanPaths)) return [];
    const platDef = PLATFORM_CONFIG.find((p) => p.id === game.platform);
    const platDir = platDef?.dirs[0] || game.platform;

    return scanPaths
      .filter((sp) => sp.type === "rom")
      .map((sp) => ({
        deviceId: gd.device.id,
        deviceName: gd.device.name,
        filePath: `${sp.path}/${platDir}/${game.originalFile}`,
        fileName: game.originalFile,
      }));
  });

  const screenshots = screenshotUrls(game);
  const genres = safeJsonParse(game.genres);
  const videoIds = safeJsonParse(game.videoIds);
  const safeVideoIds = videoIds.filter((vid) => /^[a-zA-Z0-9_-]{6,15}$/.test(vid));
  const artworks = artworkUrls(game);
  const themes = safeJsonParse(game.themes);
  const resolvedCoverUrl = coverUrl(game);

  const platform = await prisma.platform.findUnique({ where: { id: game.platform } });
  const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
  const platformColor = (platform?.color && HEX_RE.test(platform.color)) ? platform.color : "#6366f1";
  const heroImage = artworks[0] || null;

  return (
    <div className="max-w-5xl mx-auto">
      <Breadcrumbs items={[
        { label: "Home", href: "/" },
        { label: game.platformLabel, href: `/platform/${game.platform}` },
        { label: game.title },
      ]} />

      {/* Hero Banner */}
      <div className="relative rounded-xl overflow-hidden mb-0 h-[200px] md:h-[280px]">
        {heroImage ? (
          <img src={heroImage} alt={game.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full"
            style={{ background: `linear-gradient(135deg, ${platformColor}33, ${platformColor}11, ${platformColor}33)` }} />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-vault-bg" />

        {/* Cover + Title overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-6 flex items-end gap-5">
          <div className="w-24 h-32 bg-vault-surface rounded-lg overflow-hidden border-2 border-vault-border flex-shrink-0 shadow-xl">
            {resolvedCoverUrl ? (
              <img src={resolvedCoverUrl} alt={game.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-vault-muted text-xs">No Cover</div>
            )}
          </div>
          <div className="flex-1 min-w-0 pb-1">
            <div className="flex items-center gap-2">
              <h1 className="font-heading text-2xl md:text-3xl font-bold text-white drop-shadow-lg">{game.title}</h1>
              <FavoriteButton gameId={game.id} initialFavorite={game.isFavorite} />
            </div>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <PlatformTag label={game.platformLabel} />
              {game.franchise && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-purple-500/20 text-purple-400">
                  {game.franchise}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Score Bar */}
      <div className="flex items-center gap-6 px-4 py-3 border-b border-vault-border">
        {game.igdbScore !== null && game.igdbScore !== undefined && (
          <div className="text-center">
            <div className={`text-2xl font-bold ${scoreColor(Math.round(game.igdbScore))}`}>{Math.round(game.igdbScore)}</div>
            <div className="text-[10px] text-vault-muted uppercase tracking-wider">IGDB</div>
          </div>
        )}
        {game.metacriticScore !== null && game.metacriticScore !== undefined && (
          <>
            {game.igdbScore != null && <div className="w-px h-8 bg-vault-border" />}
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">{game.metacriticScore}</div>
              <div className="text-[10px] text-vault-muted uppercase tracking-wider">Metacritic</div>
            </div>
          </>
        )}
        {game.releaseDate && (
          <>
            {(game.igdbScore != null || game.metacriticScore != null) && <div className="w-px h-8 bg-vault-border" />}
            <div className="text-center">
              <div className="text-2xl font-bold text-vault-amber">{new Date(game.releaseDate).getFullYear()}</div>
              <div className="text-[10px] text-vault-muted uppercase tracking-wider">Release</div>
            </div>
          </>
        )}
        {(genres.length > 0 || themes.length > 0) && (
          <>
            <div className="flex-1" />
            <div className="flex gap-1.5 flex-wrap justify-end">
              {genres.map((g) => (
                <Link key={g} href={`/platform/${game.platform}?tag=${encodeURIComponent(g)}`}
                  className="text-xs bg-vault-bg px-2.5 py-0.5 rounded-full text-vault-muted hover:text-vault-text hover:bg-vault-surface transition-colors">
                  {g}
                </Link>
              ))}
              {themes.map((t) => (
                <Link key={t} href={`/platform/${game.platform}?tag=${encodeURIComponent(t)}`}
                  className="text-xs bg-indigo-500/10 px-2.5 py-0.5 rounded-full text-indigo-400 hover:bg-indigo-500/20 transition-colors">
                  {t}
                </Link>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Info + Summary */}
      <div className="mt-6 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm flex-1">
            {game.developer && (
              <div><span className="text-vault-muted text-xs">Developer</span><p>{game.developer}</p></div>
            )}
            {game.publisher && (
              <div><span className="text-vault-muted text-xs">Publisher</span><p>{game.publisher}</p></div>
            )}
            {game.releaseDate && (
              <div>
                <span className="text-vault-muted text-xs">Release Date</span>
                <p>{new Date(game.releaseDate).toLocaleDateString("de-DE", { year: "numeric", month: "long", day: "numeric" })}</p>
              </div>
            )}
          </div>
          <RefreshMetadataButton gameId={game.id} />
        </div>

        {game.summary && (
          <div className="card">
            <h2 className="font-heading font-semibold mb-2">Summary</h2>
            <p className="text-vault-muted text-sm leading-relaxed">{game.summary}</p>
          </div>
        )}
      </div>

      {/* Videos */}
      {safeVideoIds.length > 0 && (
        <div className="mt-8">
          <h2 className="font-heading text-xl font-bold mb-4">Videos</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {safeVideoIds.map((ytId) => (
              <div key={ytId} className="aspect-video rounded-xl overflow-hidden bg-vault-surface">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${ytId}`}
                  title="Game Trailer"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Screenshots */}
      {screenshots.length > 0 && (
        <div className="mt-8">
          <h2 className="font-heading text-xl font-bold mb-4">Screenshots</h2>
          <ScreenshotGallery urls={screenshots} />
        </div>
      )}

      {/* AI Content */}
      {game.aiFunFacts && (
        <div className="mt-8 rounded-xl border border-vault-amber/20 bg-gradient-to-br from-vault-amber/[0.08] to-transparent p-6 [&_li]:marker:text-vault-amber">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">&#9889;</span>
            <h2 className="font-heading text-xl font-bold text-vault-amber">Fun Facts</h2>
          </div>
          <MarkdownContent content={game.aiFunFacts} />
        </div>
      )}

      {game.aiStory && (
        <div className="mt-6 rounded-xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/[0.08] to-transparent p-6 prose-vault-indigo">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">&#128214;</span>
            <h2 className="font-heading text-xl font-bold text-indigo-400">Story &amp; Background</h2>
          </div>
          <MarkdownContent content={game.aiStory} />
        </div>
      )}

      <GameFiles gameId={game.id} files={deviceFiles} />

      <EnrichWizard gameId={game.id} gameTitle={game.title} />
    </div>
  );
}
