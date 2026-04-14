/**
 * Build a ROM search URL from a template and game info.
 *
 * Supported variables:
 * - {title}          — raw title, spaces as + for query params
 * - {titleSlug}      — slug: lowercase, hyphens, no special chars
 * - {titleEncoded}   — raw title, URL-encoded (%20)
 * - {platform}       — platform ID (e.g. "snes")
 * - {platformLabel}  — platform slug for ROM sites (e.g. "super-nintendo", "sega-genesis")
 */
export function buildRomSearchUrl(
  template: string,
  title: string,
  platform: string,
  platformSlug?: string
): string {
  const slugify = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();

  const titleQuery = title.replace(/\s+/g, "+");

  // Replace longer variable names first to avoid partial matches
  // (e.g. {platformLabel} contains {platform})
  return template
    .replace(/\{platformLabel\}/g, platformSlug || slugify(platform))
    .replace(/\{titleEncoded\}/g, encodeURIComponent(title))
    .replace(/\{titleSlug\}/g, slugify(title))
    .replace(/\{platform\}/g, platform)
    .replace(/\{title\}/g, titleQuery);
}
