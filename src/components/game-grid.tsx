import { GameCard } from "./game-card";

interface Game {
  id: number;
  title: string;
  coverUrl: string | null;
  platformLabel: string;
  igdbScore: number | null;
  metacriticScore: number | null;
  isFavorite?: boolean;
}

export function GameGrid({ games }: { games: Game[] }) {
  if (games.length === 0) {
    return (
      <div className="text-center text-vault-muted py-20">
        <p className="text-lg">No games found</p>
        <p className="text-sm mt-2">Try scanning your Steam Deck in the Admin panel</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {games.map((game) => (
        <GameCard key={game.id} id={game.id} title={game.title} coverUrl={game.coverUrl}
          platformLabel={game.platformLabel} igdbScore={game.igdbScore}
          metacriticScore={game.metacriticScore} isFavorite={game.isFavorite} />
      ))}
    </div>
  );
}
