import Link from "next/link";
import { PlatformTag } from "./platform-tag";

interface GameCardProps {
  id: number;
  title: string;
  coverUrl: string | null;
  platformLabel: string;
  platformColor?: string;
  igdbScore: number | null;
  metacriticScore: number | null;
}

function scoreColor(score: number): string {
  if (score >= 75) return "bg-green-500/15 text-green-400";
  if (score >= 50) return "bg-yellow-500/15 text-yellow-400";
  return "bg-red-500/15 text-red-400";
}

export function GameCard({ id, title, coverUrl, platformLabel, platformColor, igdbScore, metacriticScore }: GameCardProps) {
  return (
    <Link href={`/game/${id}`} className="card group block">
      <div className="aspect-[3/4] bg-vault-bg rounded-lg overflow-hidden mb-3">
        {coverUrl ? (
          <img src={coverUrl} alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-vault-muted text-sm">No Cover</div>
        )}
      </div>
      <div className="space-y-2">
        <h3 className="font-heading font-semibold text-sm leading-tight line-clamp-2">{title}</h3>
        <PlatformTag label={platformLabel} color={platformColor} />
        {(igdbScore !== null || metacriticScore !== null) && (
          <div className="flex gap-2 pt-1">
            {igdbScore !== null && (
              <div className="flex items-center gap-1.5">
                <div className={`w-7 h-7 rounded-md flex items-center justify-center font-bold text-xs ${scoreColor(Math.round(igdbScore))}`}>
                  {Math.round(igdbScore)}
                </div>
                <span className="text-[8px] text-vault-muted">IGDB</span>
              </div>
            )}
            {metacriticScore !== null && (
              <div className="flex items-center gap-1.5">
                <div className="w-7 h-7 rounded-md flex items-center justify-center font-bold text-xs bg-blue-500/15 text-blue-400">
                  {metacriticScore}
                </div>
                <span className="text-[8px] text-vault-muted">MC</span>
              </div>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
