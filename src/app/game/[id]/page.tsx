import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ScoreBadge } from "@/components/score-badge";
import { PlatformTag } from "@/components/platform-tag";
import { ScreenshotGallery } from "@/components/screenshot-gallery";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function GameDetailPage({ params }: Props) {
  const { id } = await params;
  const gameId = parseInt(id, 10);
  if (isNaN(gameId)) notFound();

  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game) notFound();

  const screenshots: string[] = game.screenshotUrls
    ? JSON.parse(game.screenshotUrls)
    : [];
  const genres: string[] = game.genres ? JSON.parse(game.genres) : [];

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
              <ScoreBadge score={game.igdbScore} />
              {game.metacriticScore && (
                <span className="text-xs text-vault-muted">
                  MC: {game.metacriticScore}
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

          {genres.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {genres.map((g) => (
                <span
                  key={g}
                  className="text-xs bg-vault-bg px-3 py-1 rounded-full text-vault-muted"
                >
                  {g}
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

      {screenshots.length > 0 && (
        <div className="mt-8">
          <h2 className="font-heading text-xl font-bold mb-4">Screenshots</h2>
          <ScreenshotGallery urls={screenshots} />
        </div>
      )}

      {game.aiFunFacts && (
        <div className="mt-8 card">
          <h2 className="font-heading text-xl font-bold mb-4">Fun Facts</h2>
          <div
            className="text-vault-muted text-sm leading-relaxed prose prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: game.aiFunFacts }}
          />
        </div>
      )}

      {game.aiStory && (
        <div className="mt-8 card">
          <h2 className="font-heading text-xl font-bold mb-4">Story &amp; Background</h2>
          <div
            className="text-vault-muted text-sm leading-relaxed prose prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: game.aiStory }}
          />
        </div>
      )}
    </div>
  );
}
