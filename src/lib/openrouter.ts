interface AiContent {
  funFacts: string;
  story: string;
}

export async function generateGameAiContent(
  title: string,
  platform: string,
  developer: string | null,
  releaseYear: number | null,
  genres: string[],
  summary: string | null,
  apiKey: string,
  model: string = "anthropic/claude-sonnet-4-20250514"
): Promise<AiContent> {
  const context = [
    `Game: ${title}`,
    `Platform: ${platform}`,
    developer ? `Developer: ${developer}` : null,
    releaseYear ? `Release Year: ${releaseYear}` : null,
    genres.length > 0 ? `Genres: ${genres.join(", ")}` : null,
    summary ? `Summary: ${summary}` : null,
  ].filter(Boolean).join("\n");

  const prompt = `You are a gaming expert. Given the following game information, generate two sections in Markdown:

${context}

## Section 1: Fun Facts
Write 3-5 interesting fun facts about this game. Include development stories, Easter eggs, cultural impact, world records, or surprising connections. Each fact should be a bullet point.

## Section 2: Story & Background
Write 2-3 paragraphs about the game's story, setting, and what makes it special. If the game doesn't have a traditional story (like a puzzle game), talk about the game's concept, design philosophy, and legacy.

Format your response as:
---FUN_FACTS---
(markdown content)
---STORY---
(markdown content)`;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1000,
    }),
  });

  if (!res.ok) throw new Error(`OpenRouter API failed: ${res.status}`);

  const data = await res.json();
  const content: string = data.choices[0]?.message?.content || "";

  const funFactsMatch = content.match(/---FUN_FACTS---\s*([\s\S]*?)(?=---STORY---|$)/);
  const storyMatch = content.match(/---STORY---\s*([\s\S]*?)$/);

  return {
    funFacts: funFactsMatch?.[1]?.trim() || content,
    story: storyMatch?.[1]?.trim() || "",
  };
}
