/**
 * Build a ROM search URL from a template and game info.
 *
 * Supported variables:
 * - {title}          — raw title, spaces as + for query params
 * - {titleSlug}      — slug: lowercase, hyphens, no special chars
 * - {titleEncoded}   — raw title, URL-encoded (%20)
 * - {platform}       — platform ID (e.g. "snes")
 * - {platformLabel}  — platform label as slug (e.g. "super-nintendo")
 */
export function buildRomSearchUrl(
  template: string,
  title: string,
  platform: string,
  platformLabel?: string
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
    .replace("{platformLabel}", slugify(platformLabel || platform))
    .replace("{titleEncoded}", encodeURIComponent(title))
    .replace("{titleSlug}", slugify(title))
    .replace("{platform}", platform)
    .replace("{title}", titleQuery);
}
