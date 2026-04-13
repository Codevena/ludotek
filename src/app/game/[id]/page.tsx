import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PlatformTag } from "@/components/platform-tag";
import { ScreenshotGallery } from "@/components/screenshot-gallery";
import { MarkdownContent } from "@/components/markdown-content";
import { EnrichWizard } from "@/components/enrich-wizard";
import { Breadcrumbs } from "@/components/breadcrumbs";

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
  const gameId = parseInt(id, 10);
  if (isNaN(gameId)) notFound();

  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game) notFound();

  const screenshots = safeJsonParse(game.screenshotUrls);
  const genres = safeJsonParse(game.genres);
  const videoIds = safeJsonParse(game.videoIds);
  const safeVideoIds = videoIds.filter((vid) => /^[a-zA-Z0-9_-]{6,15}$/.test(vid));
  const artworks = safeJsonParse(game.artworkUrls);
  const themes = safeJsonParse(game.themes);

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
            {game.coverUrl ? (
              <img src={game.coverUrl} alt={game.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-vault-muted text-xs">No Cover</div>
            )}
          </div>
          <div className="flex-1 min-w-0 pb-1">
            <h1 className="font-heading text-2xl md:text-3xl font-bold text-white drop-shadow-lg">{game.title}</h1>
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
            {game.igdbScore !== null && <div className="w-px h-8 bg-vault-border" />}
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">{game.metacriticScore}</div>
              <div className="text-[10px] text-vault-muted uppercase tracking-wider">Metacritic</div>
            </div>
          </>
        )}
        {game.releaseDate && (
          <>
            {(game.igdbScore !== null || game.metacriticScore !== null) && <div className="w-px h-8 bg-vault-border" />}
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
                <span key={g} className="text-xs bg-vault-bg px-2.5 py-0.5 rounded-full text-vault-muted">{g}</span>
              ))}
              {themes.map((t) => (
                <span key={t} className="text-xs bg-indigo-500/10 px-2.5 py-0.5 rounded-full text-indigo-400">{t}</span>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Info + Summary */}
      <div className="mt-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
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

        {game.summary && (
          <div className="card">
            <h2 className="font-heading font-semibold mb-2">Summary</h2>
            <p className="text-vault-muted text-sm leading-relaxed">{game.summary}</p>
          </div>
        )}
      </div>

      {/* Artwork Gallery (skip first -- used as hero) */}
      {artworks.length > 1 && (
        <div className="mt-8">
          <h2 className="font-heading text-xl font-bold mb-4">Artwork</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {artworks.slice(1).map((url, i) => (
              <div key={i} className="aspect-video rounded-xl overflow-hidden bg-vault-surface">
                <img src={url} alt={`${game.title} artwork ${i + 2}`} className="w-full h-full object-cover" loading="lazy" />
              </div>
            ))}
          </div>
        </div>
      )}

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
        <details className="mt-8 card group" open>
          <summary className="font-heading text-xl font-bold cursor-pointer list-none flex items-center justify-between">
            Fun Facts
            <span className="text-vault-muted text-sm group-open:rotate-180 transition-transform">&#9660;</span>
          </summary>
          <div className="mt-4"><MarkdownContent content={game.aiFunFacts} /></div>
        </details>
      )}

      {game.aiStory && (
        <details className="mt-8 card group" open>
          <summary className="font-heading text-xl font-bold cursor-pointer list-none flex items-center justify-between">
            Story &amp; Background
            <span className="text-vault-muted text-sm group-open:rotate-180 transition-transform">&#9660;</span>
          </summary>
          <div className="mt-4"><MarkdownContent content={game.aiStory} /></div>
        </details>
      )}

      <EnrichWizard gameId={game.id} gameTitle={game.title} />
    </div>
  );
}
