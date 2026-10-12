import { createHash } from "node:crypto";
import type { Readable } from "node:stream";
import type { DatRom } from "./dat";

export interface FileFingerprint {
  size: number;
  crc32: string;
  md5: string;
  sha1: string;
  sha256: string;
}

export interface HashOptions {
  maxBytes: number;
  signal?: AbortSignal;
  timeoutMs?: number;
  onProgress?: (bytes: number) => void;
}

const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let value = i;
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  crcTable[i] = value >>> 0;
}

function namedError(name: string, message: string): Error {
  const error = new Error(message);
  error.name = name;
  return error;
}

/** Consumes binary chunks without retaining the file; owns cancellation of this source. */
export function hashReadable(stream: Readable, options: HashOptions): Promise<FileFingerprint> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined = undefined;
    let size = 0;
    let crc = 0xffffffff;
    const md5 = createHash("md5");
    const sha1 = createHash("sha1");
    const sha256 = createHash("sha256");
    const cleanup = () => {
      if (timer !== undefined) clearTimeout(timer);
      options.signal?.removeEventListener("abort", onAbort);
      stream.removeListener("data", onData);
      stream.removeListener("end", onEnd);
      stream.removeListener("error", fail);
      stream.removeListener("close", onClose);
    };
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      // A source's asynchronous _destroy may itself fail. Consume that late error
      // while preserving the original rejection, then remove the temporary listeners.
      const destroyed = () => {
        stream.removeListener("error", destroyed);
        stream.removeListener("close", destroyed);
      };
      if (!stream.closed) {
        stream.once("error", destroyed);
        stream.once("close", destroyed);
      }
      stream.destroy();
      reject(error);
    };
    const onAbort = () => fail(namedError("AbortError", "Hashing was aborted"));
    const onClose = () => fail(new Error("Source closed before its complete end"));
    const onData = (chunk: unknown) => {
      if (settled) return;
      if (!(chunk instanceof Uint8Array)) { fail(new Error("Hashing requires binary byte chunks")); return; }
      if (chunk.byteLength > options.maxBytes - size) { fail(new Error("File byte limit exceeded")); return; }
      try {
        for (let i = 0; i < chunk.byteLength; i++) crc = crcTable[(crc ^ chunk[i]) & 0xff] ^ (crc >>> 8);
        md5.update(chunk);
        sha1.update(chunk);
        sha256.update(chunk);
        size += chunk.byteLength;
        options.onProgress?.(size);
      } catch (error) { fail(error); }
    };
    const onEnd = () => {
      if (settled) return;
      try {
        const fingerprint = {
          size, crc32: ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, "0"),
          md5: md5.digest("hex"), sha1: sha1.digest("hex"), sha256: sha256.digest("hex"),
        };
        settled = true;
        cleanup();
        resolve(fingerprint);
      } catch (error) { fail(error); }
    };
    const timeoutMs = options.timeoutMs ?? 120_000;
    if (!Number.isSafeInteger(options.maxBytes) || options.maxBytes < 0) { fail(new Error("Invalid file byte bound")); return; }
    if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 2_147_483_647) { fail(new Error("Invalid hash timeout")); return; }
    if (options.signal?.aborted) { onAbort(); return; }
    if (stream.destroyed || stream.readableEnded) { fail(new Error("Source already closed or consumed")); return; }
    stream.on("error", fail);
    stream.on("close", onClose);
    stream.on("end", onEnd);
    options.signal?.addEventListener("abort", onAbort, { once: true });
    timer = setTimeout(() => fail(namedError("TimeoutError", "Hash deadline exceeded")), timeoutMs);
    timer.unref?.();
    stream.on("data", onData);
  });
}

const hashKeys = ["crc32", "md5", "sha1", "sha256"] as const;
const lengths = { crc32: 8, md5: 32, sha1: 40, sha256: 64 };

function verifiable(rom: DatRom): boolean {
  if (rom.status?.toLowerCase() === "nodump" || !Number.isSafeInteger(rom.size) || rom.size < 0) return false;
  let supplied = false;
  for (const key of hashKeys) {
    if (rom[key] !== undefined) {
      supplied = true;
      if (typeof rom[key] !== "string" || !new RegExp(`^[a-fA-F0-9]{${lengths[key]}}$`).test(rom[key])) return false;
    }
  }
  return supplied;
}

function agrees(fingerprint: FileFingerprint, rom: DatRom): boolean {
  return fingerprint.size === rom.size && hashKeys.every((key) => rom[key] === undefined || fingerprint[key].toLowerCase() === rom[key].toLowerCase());
}

/** A no-match is unknown unless a concrete expected checksum identity was supplied. */
export function classifyDump(fingerprint: FileFingerprint, roms: DatRom[], expectedRom?: DatRom): { status: "verified" | "unknown" | "mismatch"; matches: DatRom[] } {
  const matches = roms.filter((rom) => verifiable(rom) && agrees(fingerprint, rom));
  if (expectedRom) return { status: !verifiable(expectedRom) ? "unknown" : agrees(fingerprint, expectedRom) ? "verified" : "mismatch", matches };
  return { status: matches.length ? "verified" : "unknown", matches };
}
