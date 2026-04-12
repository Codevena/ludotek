import Link from "next/link";
import { ScoreBadge } from "./score-badge";
import { PlatformTag } from "./platform-tag";

interface GameCardProps {
  id: number;
  title: string;
  coverUrl: string | null;
  platformLabel: string;
  platformColor?: string;
  igdbScore: number | null;
}

export function GameCard({ id, title, coverUrl, platformLabel, platformColor, igdbScore }: GameCardProps) {
  return (
    <Link href={`/game/${id}`} className="card group block">
      <div className="aspect-[3/4] bg-vault-bg rounded-lg overflow-hidden mb-3">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-vault-muted text-sm">
            No Cover
          </div>
        )}
      </div>
      <div className="space-y-2">
        <h3 className="font-heading font-semibold text-sm leading-tight line-clamp-2">{title}</h3>
        <div className="flex items-center gap-2">
          <PlatformTag label={platformLabel} color={platformColor} />
          <ScoreBadge score={igdbScore} />
        </div>
      </div>
    </Link>
  );
}
