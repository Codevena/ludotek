let cachedToken: { token: string; expiresAt: number } | null = null;

async function getIgdbToken(clientId: string, clientSecret: string): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const res = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
    { method: "POST" }
  );

  if (!res.ok) throw new Error(`IGDB auth failed: ${res.status}`);

  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000 - 60000,
  };

  return cachedToken.token;
}

const IGDB_PLATFORM_MAP: Record<string, number> = {
  snes: 19, gba: 24, gb: 33, megadrive: 29, nes: 18, gbc: 22,
  gamegear: 35, mastersystem: 64, n64: 4, psx: 7, ps2: 8,
  dreamcast: 23, saturn: 32, gc: 21, switch: 130, segacd: 78,
  n3ds: 37, xbox360: 12, steam: 6,
};

export interface IgdbGameData {
  igdbId: number;
  coverUrl: string | null;
  igdbScore: number | null;
  genres: string[];
  developer: string | null;
  publisher: string | null;
  releaseDate: Date | null;
  summary: string | null;
  screenshotUrls: string[];
}

async function igdbQuery(clientId: string, token: string, endpoint: string, body: string): Promise<unknown[]> {
  const res = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
    method: "POST",
    headers: {
      "Client-ID": clientId,
      Authorization: `Bearer ${token}`,
      "Content-Type": "text/plain",
    },
    body,
  });

  if (!res.ok) throw new Error(`IGDB ${endpoint} failed: ${res.status}`);
  return res.json();
}

export async function searchIgdb(
  title: string,
  platform: string,
  clientId: string,
  clientSecret: string
): Promise<IgdbGameData | null> {
  const token = await getIgdbToken(clientId, clientSecret);
  const platformId = IGDB_PLATFORM_MAP[platform];

  const searchQuery = platformId
    ? `search "${title.replace(/"/g, '\\"')}"; fields name,rating,genres,first_release_date,summary,cover,involved_companies,screenshots; where platforms = (${platformId}); limit 5;`
    : `search "${title.replace(/"/g, '\\"')}"; fields name,rating,genres,first_release_date,summary,cover,involved_companies,screenshots; limit 5;`;

  const results = (await igdbQuery(clientId, token, "games", searchQuery)) as Array<{
    id: number; name: string; rating?: number; genres?: number[];
    first_release_date?: number; summary?: string; cover?: number;
    involved_companies?: number[]; screenshots?: number[];
  }>;

  if (results.length === 0) return null;

  const game = results[0];

  let coverUrl: string | null = null;
  if (game.cover) {
    const covers = (await igdbQuery(clientId, token, "covers",
      `fields image_id; where id = ${game.cover};`
    )) as Array<{ image_id: string }>;
    if (covers.length > 0) {
      coverUrl = `https://images.igdb.com/igdb/image/upload/t_cover_big/${covers[0].image_id}.jpg`;
    }
  }

  let genreNames: string[] = [];
  if (game.genres && game.genres.length > 0) {
    const genres = (await igdbQuery(clientId, token, "genres",
      `fields name; where id = (${game.genres.join(",")}); limit 10;`
    )) as Array<{ name: string }>;
    genreNames = genres.map((g) => g.name);
  }

  let developer: string | null = null;
  let publisher: string | null = null;
  if (game.involved_companies && game.involved_companies.length > 0) {
    const companies = (await igdbQuery(clientId, token, "involved_companies",
      `fields company,developer,publisher; where id = (${game.involved_companies.join(",")}); limit 10;`
    )) as Array<{ company: number; developer: boolean; publisher: boolean }>;

    const companyIds = companies.map((c) => c.company);
    const companyDetails = (await igdbQuery(clientId, token, "companies",
      `fields name; where id = (${companyIds.join(",")}); limit 10;`
    )) as Array<{ id: number; name: string }>;

    const companyMap = new Map(companyDetails.map((c) => [c.id, c.name]));
    const devCompany = companies.find((c) => c.developer);
    const pubCompany = companies.find((c) => c.publisher);
    if (devCompany) developer = companyMap.get(devCompany.company) || null;
    if (pubCompany) publisher = companyMap.get(pubCompany.company) || null;
  }

  let screenshotUrls: string[] = [];
  if (game.screenshots && game.screenshots.length > 0) {
    const screenshots = (await igdbQuery(clientId, token, "screenshots",
      `fields image_id; where id = (${game.screenshots.slice(0, 4).join(",")}); limit 4;`
    )) as Array<{ image_id: string }>;
    screenshotUrls = screenshots.map(
      (s) => `https://images.igdb.com/igdb/image/upload/t_screenshot_big/${s.image_id}.jpg`
    );
  }

  return {
    igdbId: game.id,
    coverUrl,
    igdbScore: game.rating || null,
    genres: genreNames,
    developer,
    publisher,
    releaseDate: game.first_release_date ? new Date(game.first_release_date * 1000) : null,
    summary: game.summary || null,
    screenshotUrls,
  };
}
