/**
 * Build a ROM search URL from a template and game info.
 *
 * Supported variables:
 * - {title}          — raw title, URL-encoded
 * - {titleSlug}      — slug: lowercase, hyphens, no special chars
 * - {platform}       — platform ID (e.g. "snes")
 * - {platformLabel}  — platform label slug (e.g. "super-nintendo")
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

  return template
    .replace("{title}", encodeURIComponent(title))
    .replace("{titleSlug}", slugify(title))
    .replace("{platform}", encodeURIComponent(platform))
    .replace("{platformLabel}", slugify(platformLabel || platform));
}
