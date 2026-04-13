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
  themes: string[]
): string {
  const gameLines = games
    .map(
      (g) =>
        `- ${g.title} (${g.platformLabel}) — Genres: ${g.genres.join(", ")} | Score: ${g.igdbScore || "N/A"}`
    )
    .join("\n");

  const themesPart =
    themes.length > 0 ? " und Themes: " + themes.join(", ") : "";

  return `Du bist ein Gaming-Experte. Der User hat folgende Games:

${gameLines}

Der User mag besonders: ${genres.join(", ")}${themesPart}

Empfehle 5-8 Games aus dieser Library die der User unbedingt spielen sollte.
Fokus auf versteckte Perlen und unterschaetzte Titel, nicht nur die offensichtlichen Klassiker.

Fuer jedes Game antworte mit diesem JSON-Format:
[{"title":"Exakter Titel wie oben","platform":"platform-id","reason":"2-3 Saetze warum...","vibeTag":"Hidden Gem"}]

Gueltige vibeTags: "Hidden Gem", "Absoluter Klassiker", "Unterschaetzt", "Must Play", "Geheimtipp", "Ueberraschung"

Antworte NUR mit dem JSON-Array, kein anderer Text.`;
}

export function buildWishlistPrompt(
  gameTitles: string[],
  platforms: string[],
  genres: string[],
  themes: string[]
): string {
  const titleLines = gameTitles.map((t) => `- ${t}`).join("\n");

  const themesPart =
    themes.length > 0 ? " und Themes: " + themes.join(", ") : "";

  return `Du bist ein Gaming-Experte. Der User hat bereits diese Games auf ${platforms.join(", ")}:

${titleLines}

Der User mag besonders: ${genres.join(", ")}${themesPart}

Empfehle 5-8 Games fuer diese Plattform(en) die der User NICHT hat aber lieben wuerde.
Die Games muessen real existieren und fuer die genannte(n) Plattform(en) verfuegbar sein.
Empfehle KEINE Games die der User bereits hat!

Fuer jedes Game antworte mit diesem JSON-Format:
[{"title":"Offizieller Spieletitel","platform":"platform-id","reason":"2-3 Saetze warum...","vibeTag":"Must Have"}]

Gueltige vibeTags: "Must Have", "Fehlt dir!", "Absolut genial", "Versteckter Klassiker", "Top Empfehlung"
Gueltige platform-IDs: ${platforms.join(", ")}

Antworte NUR mit dem JSON-Array, kein anderer Text.`;
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
