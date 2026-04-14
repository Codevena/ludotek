import Link from "next/link";
import { PlatformTag } from "./platform-tag";
import { FavoriteButton } from "./favorite-button";

interface DeviceBadge {
  id: number;
  name: string;
  type: string;
}

interface GameCardProps {
  id: number;
  title: string;
  coverUrl: string | null;
  platformLabel: string;
  platformColor?: string;
  igdbScore: number | null;
  metacriticScore: number | null;
  isFavorite?: boolean;
  devices?: DeviceBadge[];
}

function deviceTypeColor(type: string): string {
  switch (type) {
    case "steamdeck": return "bg-purple-500/20 text-purple-400";
    case "android": return "bg-green-500/20 text-green-400";
    default: return "bg-blue-500/20 text-blue-400";
  }
}

function deviceAbbrev(name: string): string {
  const words = name.split(/\s+/);
  if (words.length >= 2) return words.map((w) => w[0]).join("").toUpperCase().slice(0, 3);
  return name.slice(0, 2).toUpperCase();
}

function scoreColor(score: number): string {
  if (score >= 75) return "bg-green-500/15 text-green-400";
  if (score >= 50) return "bg-yellow-500/15 text-yellow-400";
  return "bg-red-500/15 text-red-400";
}

export function GameCard({ id, title, coverUrl, platformLabel, platformColor, igdbScore, metacriticScore, isFavorite = false, devices = [] }: GameCardProps) {
  return (
    <Link href={`/game/${id}`} className="card group block">
      <div className="relative aspect-[3/4] bg-vault-bg rounded-lg overflow-hidden mb-3">
        <FavoriteButton gameId={id} initialFavorite={isFavorite} />
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
        {devices.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {devices.map((d) => (
              <span
                key={d.id}
                title={d.name}
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${deviceTypeColor(d.type)}`}
              >
                {deviceAbbrev(d.name)}
              </span>
            ))}
          </div>
        )}
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
