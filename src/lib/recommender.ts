export interface GameForPrompt {
  title: string;
  platform: string;
  platformLabel: string;
  genres: string[];
  themes: string[];
  igdbScore: number | null;
}

export interface Recommendation {
  title: string;
  platform: string;
  reason: string;
  vibeTag: string;
}

export function buildLibraryPrompt(
  games: GameForPrompt[],
  genres: string[],
  themes: string[],
  language: string = "en"
): string {
  const gameLines = games
    .map(
      (g) =>
        `- ${g.title} (${g.platformLabel}) — Genres: ${g.genres.join(", ")} | Score: ${g.igdbScore || "N/A"}`
    )
    .join("\n");

  const categories = [...genres, ...themes].join(", ");
  const isGerman = language === "de";

  return `You are a gaming expert. The user has the following games in their library:

${gameLines}

The user is especially interested in: ${categories}

Recommend 5-8 games FROM THIS LIBRARY that the user absolutely should play.
Focus on hidden gems and underrated titles, not just the obvious classics.
The title MUST match exactly as listed above.
${isGerman ? "\nWrite ALL reason texts in German." : ""}

For each game respond with this JSON format:
[{"title":"Exact title from the list above","platform":"platform-id","reason":"2-3 sentences why they will love this","vibeTag":"Hidden Gem"}]

Valid vibeTags: "Hidden Gem", "All-Time Classic", "Underrated", "Must Play", "Sleeper Hit", "Surprise Pick"

Respond ONLY with the JSON array, no other text.`;
}

export function buildWishlistPrompt(
  gameTitles: string[],
  platforms: string[],
  genres: string[],
  themes: string[],
  language: string = "en"
): string {
  const titleLines = gameTitles.map((t) => `- ${t}`).join("\n");
  const categories = [...genres, ...themes].join(", ");
  const isGerman = language === "de";

  return `You are a gaming expert. The user already has these games on ${platforms.join(", ")}:

${titleLines}

The user is especially interested in: ${categories}

Recommend 5-8 games for these platform(s) that the user does NOT have but would love.
The games must actually exist and be available for the listed platform(s).
Do NOT recommend any games the user already owns!
${isGerman ? "\nWrite ALL reason texts in German." : ""}

For each game respond with this JSON format:
[{"title":"Official game title","platform":"platform-id","reason":"2-3 sentences why they will love this","vibeTag":"Must Have"}]

Valid vibeTags: "Must Have", "You're Missing Out!", "Absolute Gem", "Hidden Classic", "Top Pick"
Valid platform IDs: ${platforms.join(", ")}

Respond ONLY with the JSON array, no other text.`;
}

export function parseRecommendations(aiResponse: string): Recommendation[] {
  let cleaned = aiResponse.trim();
  cleaned = cleaned
    .replace(/^```(?:json)?\s*/m, "")
    .replace(/\s*```\s*$/m, "");

  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((r: unknown) => {
      if (typeof r !== "object" || r === null) return false;
      const rec = r as Record<string, unknown>;
      return (
        typeof rec.title === "string" &&
        typeof rec.platform === "string" &&
        typeof rec.reason === "string" &&
        typeof rec.vibeTag === "string"
      );
    }) as Recommendation[];
  } catch {
    return [];
  }
}
