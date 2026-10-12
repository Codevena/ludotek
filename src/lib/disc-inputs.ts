import { open, readdir, realpath, stat } from "fs/promises";
import path from "path";
import { PLATFORM_CONFIG } from "@/lib/platforms";
import { detectGames, type UploadedFile } from "@/lib/upload-detector";

const UPLOAD_BASE = "/tmp/ludotek-uploads";
const MAX_DESCRIPTOR_BYTES = 1024 * 1024;
const MAX_REFERENCES = 1000;

export class UploadInputError extends Error {
  constructor(message: string, public readonly status = 400) { super(message); }
}

export function assertUploadPlatform(platform: unknown): asserts platform is string {
  if (typeof platform !== "string" || !PLATFORM_CONFIG.some((entry) => entry.id === platform)) {
    throw new UploadInputError("Invalid platform");
  }
}

export function assertUploadFilename(filename: unknown): asserts filename is string {
  if (typeof filename !== "string" || !filename.trim() || filename === "." || filename === ".." || /[/\\\x00-\x1f\x7f]/.test(filename)) {
    throw new UploadInputError("Invalid filename");
  }
}

export function validateUploadBody(body: unknown, processing: boolean): {
  sessionId: string; platform: string; gameIds: string[]; deviceId?: number;
} {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new UploadInputError("Invalid JSON body");
  const input = body as Record<string, unknown>;
  if (Object.keys(input).some((key) => !["sessionId", "platform", "gameIds", "deviceId"].includes(key))) throw new UploadInputError("Unexpected upload input field");
  assertUploadPlatform(input.platform);
  assertUploadFilename(input.sessionId);
  if (processing && (!Array.isArray(input.gameIds) || input.gameIds.length === 0 ||
      !input.gameIds.every((id) => typeof id === "string" && /^game-[a-z0-9]+-[a-z0-9]+$/.test(id)))) {
    throw new UploadInputError("Invalid gameIds");
  }
  if ("deviceId" in input && (typeof input.deviceId !== "number" || !Number.isSafeInteger(input.deviceId) || input.deviceId <= 0)) {
    throw new UploadInputError("Invalid deviceId");
  }
  return { sessionId: input.sessionId, platform: input.platform, gameIds: processing ? input.gameIds as string[] : [], deviceId: input.deviceId as number | undefined };
}

function within(root: string, filename: string): boolean {
  const relative = path.relative(root, filename);
  return relative !== "" && !relative.startsWith(".." + path.sep) && relative !== ".." && !path.isAbsolute(relative);
}

async function readDescriptor(filename: string, signal?: AbortSignal): Promise<string> {
  const handle = await open(filename, "r");
  try {
    // The probe byte detects overflow even when size metadata is stale.
    const buffer = Buffer.alloc(MAX_DESCRIPTOR_BYTES + 1);
    let offset = 0;
    while (offset < buffer.length) {
      signal?.throwIfAborted();
      const { bytesRead } = await handle.read(buffer, offset, buffer.length - offset, offset);
      if (bytesRead === 0) break;
      offset += bytesRead;
    }
    if (offset > MAX_DESCRIPTOR_BYTES) throw new UploadInputError("Disc descriptor exceeds 1 MiB");
    let contents: string;
    try { contents = new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, offset)); }
    catch { throw new UploadInputError("Invalid disc descriptor encoding"); }
    if (contents.includes("\0")) throw new UploadInputError("Invalid disc descriptor");
    return contents;
  } finally { await handle.close(); }
}

function tokenize(line: string, limit = Infinity): string[] {
  const tokens: string[] = [];
  let index = 0;
  while (index < line.length && tokens.length < limit) {
    while (index < line.length && /\s/.test(line[index])) index++;
    if (index === line.length) break;
    let token = "";
    let quote = "";
    for (; index < line.length; index++) {
      const char = line[index];
      if ((char === '"' || char === "'") && (!quote || quote === char)) {
        quote = quote ? "" : char;
      } else if (!quote && /\s/.test(char)) { break; }
      else token += char;
    }
    if (quote) throw new UploadInputError("Unclosed disc descriptor quotation");
    tokens.push(token);
  }
  return tokens;
}

function descriptorLines(contents: string): string[] {
  // Match MAME's fgets(..., 511): up to 510 bytes, including a newline.
  // Otherwise a FILE command after a long REM line could escape validation.
  const buffer = Buffer.from(contents.replace(/^\uFEFF/, ""), "utf8");
  const lines: string[] = [];
  let newline = buffer.indexOf(10);
  for (let start = 0; start < buffer.length;) {
    const end = Math.min(start + 510, newline === -1 ? buffer.length : newline + 1);
    lines.push(buffer.subarray(start, end).toString("utf8"));
    if (end === newline + 1) newline = buffer.indexOf(10, end);
    start = end;
  }
  return lines;
}

function parseReferences(contents: string, extension: string): string[] {
  const references: string[] = [];
  const add = (filename: string) => {
    references.push(filename);
    if (references.length > MAX_REFERENCES) throw new UploadInputError("Disc descriptor exceeds 1000 references");
  };
  const lines = descriptorLines(contents);
  if (extension === ".gdi") {
    const nonempty = lines.map((line) => line.trim()).filter(Boolean);
    const header = tokenize(nonempty.shift() ?? "");
    const count = Number(header[0]);
    if (header.length !== 1 || !Number.isSafeInteger(count) || count <= 0 || count > MAX_REFERENCES || nonempty.length !== count) {
      throw new UploadInputError("Invalid GDI track count");
    }
    const trackNumbers = new Set<number>();
    for (const line of nonempty) {
      // MAME parse_gdi: track, LBA, type, sector size, quoted/unquoted name, offset.
      const fields = tokenize(line);
      if (fields.length !== 6 || [0, 1, 2, 3, 5].some((index) => !/^\d+$/.test(fields[index]) || !Number.isSafeInteger(Number(fields[index]))) ||
          Number(fields[0]) <= 0 || Number(fields[0]) > count || trackNumbers.has(Number(fields[0])) ||
          !["0", "4"].includes(fields[2]) || !["2048", "2352"].includes(fields[3]) ||
          (fields[2] === "0" && fields[3] !== "2352")) throw new UploadInputError("Invalid GDI track");
      trackNumbers.add(Number(fields[0]));
      add(fields[4]);
    }
  } else {
    let currentFile = false;
    let hasTrack = false;
    for (const line of lines) {
      const command = tokenize(line, 1)[0]?.toUpperCase();
      if (command === "FILE") {
        if (currentFile && !hasTrack) throw new UploadInputError("CUE file has no track");
        const fields = tokenize(line);
        if (fields.length !== 3 || !["BINARY", "MOTOROLA", "WAVE"].includes(fields[2].toUpperCase())) throw new UploadInputError("Invalid CUE file reference");
        add(fields[1]);
        currentFile = true;
        hasTrack = false;
      } else if (command === "TRACK") {
        const fields = tokenize(line);
        if (!currentFile || fields.length !== 3 || !/^\d+$/.test(fields[1]) || Number(fields[1]) <= 0 ||
            !/^(AUDIO|CDG|MODE[12]\/\d+|CDI\/\d+)$/i.test(fields[2])) throw new UploadInputError("Invalid CUE track");
        hasTrack = true;
      }
    }
    if (!currentFile || !hasTrack) throw new UploadInputError("CUE has no file tracks");
  }
  return references;
}

/** Detect and Process must use the same canonical paths and descriptor ownership. */
export async function loadUploadSession(sessionId: string, platform: string, options: { signal?: AbortSignal } = {}) {
  assertUploadPlatform(platform);
  assertUploadFilename(sessionId);
  options.signal?.throwIfAborted();
  let sessionDir: string;
  try {
    const base = await realpath(UPLOAD_BASE);
    sessionDir = await realpath(path.join(base, sessionId));
    if (!within(base, sessionDir)) throw new UploadInputError("Invalid sessionId");
  } catch (error) {
    if (error instanceof UploadInputError) throw error;
    throw new UploadInputError("Session directory not found", 404);
  }
  const files: UploadedFile[] = [];
  const seenPaths = new Set<string>();
  let entries = 0; let totalBytes = 0;
  for (const relative of await readdir(sessionDir, { recursive: true })) {
    options.signal?.throwIfAborted();
    if (++entries > 1000) throw new UploadInputError("Upload session exceeds its entry limit", 413);
    if (relative.split(path.sep).some((part) => part.startsWith(".ludotek-"))) continue;
    const filename = await realpath(path.join(sessionDir, relative));
    if (!within(sessionDir, filename)) throw new UploadInputError("File escapes upload session");
    const info = await stat(filename);
    if (!info.isFile() || seenPaths.has(filename)) continue;
    if (!Number.isSafeInteger(info.size) || info.size < 0 || info.size > 16 * 1024 ** 3 || (totalBytes += info.size) > 32 * 1024 ** 3 || files.length >= 100) throw new UploadInputError("Upload session exceeds its byte/file limit", 413);
    // Converter dispatches by its actual input path, not a symlink alias.
    const name = path.basename(filename);
    assertUploadFilename(name);
    seenPaths.add(filename);
    files.push({ name, size: info.size, path: filename });
  }
  files.sort((a, b) => a.path.localeCompare(b.path));
  const fileByPath = new Map(files.map((file) => [file.path, file]));
  const descriptorInputs = new Map<string, string[]>();
  const referenced = new Set<string>();
  for (const descriptor of files) {
    options.signal?.throwIfAborted();
    const extension = path.extname(descriptor.name).toLowerCase();
    if (extension !== ".cue" && extension !== ".gdi") continue;
    const inputs: string[] = [];
    for (const reference of parseReferences(await readDescriptor(descriptor.path, options.signal), extension)) {
      if (!reference || /[\\\x00-\x1f\x7f]/.test(reference) || path.isAbsolute(reference) || path.win32.isAbsolute(reference)) {
        throw new UploadInputError("Invalid disc reference");
      }
      const candidate = path.resolve(path.dirname(descriptor.path), reference);
      if (!within(sessionDir, candidate)) throw new UploadInputError("Disc reference escapes upload session");
      let canonical: string;
      try { canonical = await realpath(candidate); }
      catch { throw new UploadInputError("Disc input not found"); }
      if (!within(sessionDir, canonical) || !fileByPath.has(canonical) || /\.(cue|gdi)$/i.test(canonical)) {
        throw new UploadInputError("Invalid disc input");
      }
      inputs.push(canonical);
      referenced.add(canonical);
    }
    descriptorInputs.set(descriptor.path, Array.from(new Set(inputs)));
  }
  // Remove tracks before filename grouping, then attach them to their descriptor.
  const games = detectGames(files.filter((file) => !referenced.has(file.path)), platform);
  for (const game of games) {
    const gamePaths = new Set(game.files.map((file) => file.path));
    for (const descriptor of [...game.files]) {
      for (const input of descriptorInputs.get(descriptor.path) ?? []) {
        if (gamePaths.has(input)) continue;
        game.files.push(fileByPath.get(input)!);
        gamePaths.add(input);
      }
    }
    game.totalSize = game.files.reduce((total, file) => total + file.size, 0);
  }
  return { sessionDir, games, descriptorInputs };
}
