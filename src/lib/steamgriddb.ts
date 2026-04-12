export async function searchSteamGridDb(title: string, apiKey: string): Promise<string | null> {
  if (!apiKey) return null;

  try {
    const searchRes = await fetch(
      `https://www.steamgriddb.com/api/v2/search/autocomplete/${encodeURIComponent(title)}`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );

    if (!searchRes.ok) return null;
    const searchData = await searchRes.json();
    if (!searchData.data || searchData.data.length === 0) return null;

    const gameId = searchData.data[0].id;

    const gridRes = await fetch(
      `https://www.steamgriddb.com/api/v2/grids/game/${gameId}?dimensions=600x900`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );

    if (!gridRes.ok) return null;
    const gridData = await gridRes.json();
    if (!gridData.data || gridData.data.length === 0) return null;

    return gridData.data[0].url;
  } catch (err) {
    console.warn("SteamGridDB lookup failed:", err);
    return null;
  }
}
