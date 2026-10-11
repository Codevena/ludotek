interface GameIdentity {
  id: number;
  title: string;
  platform: string;
  igdbId: number | null;
}

/** Group platform versions in input order, including transitive title/IGDB aliases. */
export function groupGameIds(games: GameIdentity[]): number[][] {
  const parents = games.map((_, index) => index);
  function root(index: number): number {
    let current = index;
    while (parents[current] !== current) current = parents[current];
    while (parents[index] !== index) {
      const next = parents[index];
      parents[index] = current;
      index = next;
    }
    return current;
  }

  const aliases = new Map<string, number>();
  games.forEach((game, index) => {
    const keys = [JSON.stringify(["title", game.platform, game.title])];
    if (game.igdbId !== null) keys.push(JSON.stringify(["igdb", game.platform, game.igdbId]));
    for (const key of keys) {
      const existing = aliases.get(key);
      if (existing === undefined) {
        aliases.set(key, index);
      } else {
        const left = root(existing);
        const right = root(index);
        parents[Math.max(left, right)] = Math.min(left, right);
      }
    }
  });

  const groups = new Map<number, number[]>();
  games.forEach((game, index) => {
    const key = root(index);
    const group = groups.get(key);
    if (group) group.push(game.id);
    else groups.set(key, [game.id]);
  });
  return Array.from(groups.values());
}
