import {
  PlatformDef,
  getPlatformByDir,
  getPlatformByExtension,
  PLATFORM_CONFIG,
} from "./platforms";

interface FileWithPath {
  file: File;
  relativePath: string;
}

interface PlatformDetection {
  platform: PlatformDef;
  confidence: "high" | "medium" | "low";
}

export interface PlatformGroup {
  platformId: string;
  platform: PlatformDef;
  confidence: "high" | "medium" | "low";
  files: FileWithPath[];
}

/** Normalize a string for fuzzy comparison: lowercase, strip hyphens/underscores/spaces. */
function normalize(s: string): string {
  return s.toLowerCase().replace(/[-_\s]/g, "");
}

/** Build a set of normalized dir aliases for fuzzy matching. */
const fuzzyDirMap = new Map<string, PlatformDef>();
for (const p of PLATFORM_CONFIG) {
  for (const dir of p.dirs) {
    fuzzyDirMap.set(normalize(dir), p);
  }
}

/**
 * Detect the platform from a file's relative path.
 *
 * Strategy (first match wins):
 * 1. Exact dir-alias match on directory segments (deepest first) -> high confidence
 * 2. Fuzzy dir-alias match (normalized) on directory segments (deepest first) -> medium confidence
 * 3. File extension match -> low confidence
 * 4. null if nothing matches
 */
export function detectPlatformFromPath(
  relativePath: string,
): PlatformDetection | null {
  const segments = relativePath.split("/");
  // Remove the filename (last segment) to keep only directories
  const dirSegments = segments.slice(0, -1);

  // 1. Exact match — deepest directory first
  for (let i = dirSegments.length - 1; i >= 0; i--) {
    const match = getPlatformByDir(dirSegments[i]);
    if (match) {
      return { platform: match, confidence: "high" };
    }
  }

  // 2. Fuzzy match — deepest directory first
  for (let i = dirSegments.length - 1; i >= 0; i--) {
    const normalized = normalize(dirSegments[i]);
    const match = fuzzyDirMap.get(normalized);
    if (match) {
      return { platform: match, confidence: "medium" };
    }
  }

  // 3. File extension match
  const filename = segments[segments.length - 1];
  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex !== -1) {
    const ext = filename.slice(dotIndex).toLowerCase();
    const match = getPlatformByExtension(ext);
    if (match) {
      return { platform: match, confidence: "low" };
    }
  }

  return null;
}

const CONFIDENCE_RANK: Record<string, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

/**
 * Group an array of files by their detected platform.
 * Files that cannot be matched are placed in the `unknown` array.
 * Groups are sorted by platform sortOrder.
 */
export function groupFilesByPlatform(files: FileWithPath[]): {
  groups: PlatformGroup[];
  unknown: FileWithPath[];
} {
  const groupMap = new Map<
    string,
    {
      platform: PlatformDef;
      confidence: "high" | "medium" | "low";
      files: FileWithPath[];
    }
  >();
  const unknown: FileWithPath[] = [];

  for (const f of files) {
    const detection = detectPlatformFromPath(f.relativePath);
    if (!detection) {
      unknown.push(f);
      continue;
    }

    const existing = groupMap.get(detection.platform.id);
    if (existing) {
      existing.files.push(f);
      // Keep the highest confidence
      if (
        CONFIDENCE_RANK[detection.confidence] >
        CONFIDENCE_RANK[existing.confidence]
      ) {
        existing.confidence = detection.confidence;
      }
    } else {
      groupMap.set(detection.platform.id, {
        platform: detection.platform,
        confidence: detection.confidence,
        files: [f],
      });
    }
  }

  const groups: PlatformGroup[] = Array.from(groupMap.entries())
    .map(([platformId, data]) => ({
      platformId,
      platform: data.platform,
      confidence: data.confidence,
      files: data.files,
    }))
    .sort((a, b) => a.platform.sortOrder - b.platform.sortOrder);

  return { groups, unknown };
}
