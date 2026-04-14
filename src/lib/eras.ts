export const ERA_BUCKETS = [
  { name: "Dawn of Gaming", slug: "dawn-of-gaming", shortName: "Dawn", range: "1977–1982", minYear: 1977, maxYear: 1982, color: "#92400e" },
  { name: "8-Bit Era", slug: "8-bit-era", shortName: "8-Bit", range: "1983–1988", minYear: 1983, maxYear: 1988, color: "#dc2626" },
  { name: "16-Bit Golden Age", slug: "16-bit-golden-age", shortName: "16-Bit", range: "1989–1993", minYear: 1989, maxYear: 1993, color: "#7c3aed" },
  { name: "The 3D Revolution", slug: "3d-revolution", shortName: "3D", range: "1994–1997", minYear: 1994, maxYear: 1997, color: "#6b7280" },
  { name: "The Golden Era", slug: "golden-era", shortName: "Golden", range: "1998–2004", minYear: 1998, maxYear: 2004, color: "#ea580c" },
  { name: "HD Generation", slug: "hd-generation", shortName: "HD", range: "2005–2011", minYear: 2005, maxYear: 2011, color: "#16a34a" },
  { name: "Modern Era", slug: "modern-era", shortName: "Modern", range: "2012–today", minYear: 2012, maxYear: 9999, color: "#e11d48" },
] as const;

export type EraBucket = (typeof ERA_BUCKETS)[number];
export type EraSlug = EraBucket["slug"];

export function findEraBySlug(slug: string): EraBucket | undefined {
  return ERA_BUCKETS.find((e) => e.slug === slug);
}
