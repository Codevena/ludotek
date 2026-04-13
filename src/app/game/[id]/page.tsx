import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ScoreBadge } from "@/components/score-badge";
import { PlatformTag } from "@/components/platform-tag";
import { ScreenshotGallery } from "@/components/screenshot-gallery";
import { MarkdownContent } from "@/components/markdown-content";
import { EnrichWizard } from "@/components/enrich-wizard";

function safeJsonParse(str: string | null): string[] {
  if (!str) return [];
  try { const parsed = JSON.parse(str); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
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
  const safeVideoIds = videoIds.filter((id) => /^[a-zA-Z0-9_-]{6,15}$/.test(id));
  const artworks = safeJsonParse(game.artworkUrls);
  const themes = safeJsonParse(game.themes);

  return (
    <div className="max-w-5xl mx-auto">
      <Link
        href="/"
        className="text-vault-muted hover:text-vault-text text-sm mb-6 inline-block"
      >
        &larr; Back to library
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Cover */}
        <div className="md:col-span-1">
          <div className="aspect-[3/4] bg-vault-surface rounded-xl overflow-hidden">
            {game.coverUrl ? (
              <img
                src={game.coverUrl}
                alt={game.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-vault-muted">
                No Cover
              </div>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="md:col-span-2 space-y-6">
          <div>
            <h1 className="font-heading text-3xl font-bold mb-3">
              {game.title}
            </h1>
            <div className="flex items-center gap-3 flex-wrap">
              <PlatformTag label={game.platformLabel} />
              {game.franchise && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-purple-500/20 text-purple-400">
                  {game.franchise}
                </span>
              )}
              <ScoreBadge score={game.igdbScore} />
              {game.metacriticScore !== null && game.metacriticScore !== undefined && (
                <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-bold">
                  MC {game.metacriticScore}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            {game.developer && (
              <div>
                <span className="text-vault-muted">Developer</span>
                <p>{game.developer}</p>
              </div>
            )}
            {game.publisher && (
              <div>
                <span className="text-vault-muted">Publisher</span>
                <p>{game.publisher}</p>
              </div>
            )}
            {game.releaseDate && (
              <div>
                <span className="text-vault-muted">Release Date</span>
                <p>
                  {new Date(game.releaseDate).toLocaleDateString("de-DE", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            )}
            {game.source && (
              <div>
                <span className="text-vault-muted">Source</span>
                <p className="capitalize">{game.source}</p>
              </div>
            )}
          </div>

          {(genres.length > 0 || themes.length > 0) && (
            <div className="flex gap-2 flex-wrap">
              {genres.map((g) => (
                <span key={g} className="text-xs bg-vault-bg px-3 py-1 rounded-full text-vault-muted">
                  {g}
                </span>
              ))}
              {themes.map((t) => (
                <span key={t} className="text-xs bg-indigo-500/10 px-3 py-1 rounded-full text-indigo-400">
                  {t}
                </span>
              ))}
            </div>
          )}

          {game.summary && (
            <div className="card">
              <h2 className="font-heading font-semibold mb-2">Summary</h2>
              <p className="text-vault-muted text-sm leading-relaxed">
                {game.summary}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Hero Artwork */}
      {artworks.length > 0 && (
        <div className="mt-8">
          <h2 className="font-heading text-xl font-bold mb-4">Artwork</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {artworks.map((url, i) => (
              <div key={i} className="aspect-video rounded-xl overflow-hidden bg-vault-surface">
                <img src={url} alt={`${game.title} artwork ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trailer Videos */}
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

      {screenshots.length > 0 && (
        <div className="mt-8">
          <h2 className="font-heading text-xl font-bold mb-4">Screenshots</h2>
          <ScreenshotGallery urls={screenshots} />
        </div>
      )}

      {game.aiFunFacts && (
        <details className="mt-8 card group" open>
          <summary className="font-heading text-xl font-bold cursor-pointer list-none flex items-center justify-between">
            Fun Facts
            <span className="text-vault-muted text-sm group-open:rotate-180 transition-transform">▼</span>
          </summary>
          <div className="mt-4">
            <MarkdownContent content={game.aiFunFacts} />
          </div>
        </details>
      )}

      {game.aiStory && (
        <details className="mt-8 card group" open>
          <summary className="font-heading text-xl font-bold cursor-pointer list-none flex items-center justify-between">
            Story &amp; Background
            <span className="text-vault-muted text-sm group-open:rotate-180 transition-transform">▼</span>
          </summary>
          <div className="mt-4">
            <MarkdownContent content={game.aiStory} />
          </div>
        </details>
      )}

      <EnrichWizard gameId={game.id} gameTitle={game.title} />
    </div>
  );
}
