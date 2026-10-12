import { lstat, realpath, stat } from "node:fs/promises";
import path from "node:path";

export class LocalPathError extends Error {
  constructor(message: string, public readonly status: 400 | 403 | 503) {
    super(message);
    this.name = "LocalPathError";
  }
}

function validAbsolutePath(value: unknown): value is string {
  return typeof value === "string" && path.isAbsolute(value) && !/[\x00-\x1f\x7f-\x9f]/.test(value);
}

/** Containment is component-based; /roms-other never belongs to /roms. */
function contains(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

/** Resolve missing destinations through their nearest existing parent, rejecting dangling links. */
async function canonicalPath(value: string, allowMissing: boolean): Promise<string> {
  let candidate = path.resolve(value);
  const missing: string[] = [];
  for (;;) {
    try {
      const existing = await realpath(candidate);
      if (missing.length > 0 && !(await stat(existing)).isDirectory()) {
        throw new LocalPathError("Local target parent must be a directory", 400);
      }
      return path.join(existing, ...missing);
    } catch (error) {
      if (!allowMissing || (error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      // realpath also reports ENOENT for dangling symlinks. Never treat those
      // as a new filename: writes would follow the link outside the root.
      try {
        const existing = await lstat(candidate);
        if (existing.isSymbolicLink()) throw new LocalPathError("Local path contains an unresolved symlink", 403);
      } catch (linkError) {
        if ((linkError as NodeJS.ErrnoException).code !== "ENOENT") throw linkError;
      }
      const parent = path.dirname(candidate);
      if (parent === candidate) throw error;
      missing.unshift(path.basename(candidate));
      candidate = parent;
    }
  }
}

async function protectedPaths(): Promise<{ app: string; areas: string[] }> {
  const app = await canonicalPath(process.cwd(), true);
  const areas = ["data", "prisma", "src", "node_modules", ".next", ".git"].map((name) => path.join(app, name));
  areas.push("/tmp/ludotek-uploads");
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl?.startsWith("file:")) {
    const filename = databaseUrl.slice(5).split("?")[0];
    if (filename && filename !== ":memory:") {
      // Prisma resolves relative SQLite URLs against the schema directory.
      const databasePath = path.resolve(app, "prisma", decodeURIComponent(filename));
      areas.push(databasePath, `${databasePath}-wal`, `${databasePath}-shm`, `${databasePath}-journal`);
    }
  }
  return { app, areas: await Promise.all(areas.map((area) => canonicalPath(area, true))) };
}

/** Server configuration is the only source of LOCAL device roots. */
export async function getLocalFilesRoots(): Promise<string[]> {
  const single = process.env.LOCAL_FILES_ROOT;
  const multiple = process.env.LOCAL_FILES_ROOTS;
  let configured: unknown[];
  if (single && multiple) throw new LocalPathError("Configure only one LOCAL files root setting", 503);
  if (multiple) {
    try {
      const value: unknown = JSON.parse(multiple);
      if (!Array.isArray(value)) throw new Error("Not an array");
      configured = value;
    } catch {
      throw new LocalPathError("Invalid LOCAL_FILES_ROOTS configuration", 503);
    }
  } else if (single) {
    configured = [single];
  } else {
    throw new LocalPathError("LOCAL files roots are not configured", 503);
  }
  if (configured.length < 1 || configured.length > 32 || configured.some((root) => !validAbsolutePath(root))) {
    throw new LocalPathError("LOCAL files roots must contain 1–32 absolute directory paths", 503);
  }

  try {
    const { app, areas } = await protectedPaths();
    const roots: string[] = [];
    for (const configuredRoot of configured as string[]) {
      const root = await canonicalPath(configuredRoot, false);
      if (root === path.parse(root).root || contains(root, app) || areas.some((area) => contains(root, area) || contains(area, root))) {
        throw new LocalPathError("LOCAL files root overlaps a protected application area", 503);
      }
      if (!(await stat(root)).isDirectory()) throw new LocalPathError("LOCAL files root must be a directory", 503);
      if (!roots.includes(root)) roots.push(root);
    }
    return roots;
  } catch (error) {
    if (error instanceof LocalPathError && error.status === 503) throw error;
    throw new LocalPathError("LOCAL files root configuration is unavailable", 503);
  }
}

export async function resolveLocalPath(
  requestedPath: string,
  options: { allowMissing?: boolean; destructive?: boolean } = {},
): Promise<string> {
  if (!validAbsolutePath(requestedPath)) throw new LocalPathError("Invalid absolute local path", 400);
  const roots = await getLocalFilesRoots();
  const normalized = path.resolve(requestedPath);
  if (normalized === path.parse(normalized).root || !roots.some((root) => contains(root, normalized))) {
    // Configured roots may themselves be symlink aliases; canonicalization
    // below still checks the destination against the canonical allowlist.
    const configuredAliases = process.env.LOCAL_FILES_ROOTS
      ? JSON.parse(process.env.LOCAL_FILES_ROOTS) as string[]
      : [process.env.LOCAL_FILES_ROOT!];
    if (normalized === path.parse(normalized).root || !configuredAliases.some((root) => contains(path.resolve(root), normalized))) {
      throw new LocalPathError("Local path is outside the allowed roots", 403);
    }
  }
  const resolved = await canonicalPath(normalized, options.allowMissing ?? false);
  if (!roots.some((root) => contains(root, resolved))) throw new LocalPathError("Local path is outside the allowed roots", 403);
  if (options.destructive && roots.some((root) => contains(resolved, root))) throw new LocalPathError("Cannot remove or rename a LOCAL files root", 403);
  if (options.destructive) {
    // Rename/remove operate on the directory entry itself, including a valid
    // final symlink. Canonicalizing its parent preserves those semantics.
    const parent = await canonicalPath(path.dirname(normalized), options.allowMissing ?? false);
    const entry = path.join(parent, path.basename(normalized));
    if (!roots.some((root) => contains(root, entry))) throw new LocalPathError("Local path is outside the allowed roots", 403);
    return entry;
  }
  return resolved;
}

export async function getLocalBrowseLocation(requestedPath: string): Promise<{ path: string; parent: string | null; virtualRoot?: boolean }> {
  if (requestedPath === "/") {
    await getLocalFilesRoots();
    return { path: "/", parent: null, virtualRoot: true };
  }
  const resolved = await resolveLocalPath(requestedPath);
  const roots = await getLocalFilesRoots();
  return { path: resolved, parent: roots.includes(resolved) ? "/" : path.dirname(resolved) };
}
