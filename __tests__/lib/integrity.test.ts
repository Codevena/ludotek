import { Readable } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
import { classifyDump, hashReadable, type FileFingerprint } from "@/lib/integrity";
import type { DatRom } from "@/lib/dat";

const toy: FileFingerprint = {
  size: 9, crc32: "cbf43926", md5: "25f9e794323b453885f5181f1b624d0b",
  sha1: "f7c3bc1d808e04732adf679965ccc34ca7ae3441", sha256: "15e2b0d3c33891ebb0f1ef609ec419420c20e320ce94c65fbc8c3312448eb225",
};
const rom: DatRom = { gameName: "Toy (Rev 1)", name: "toy.bin", ...toy };
const stalled = () => new Readable({ read() {} });

afterEach(() => vi.useRealTimers());

describe("hashReadable", () => {
  it("hashes the literal 123456789 vector across chunk boundaries", async () => {
    const progress: number[] = [];
    const source = Readable.from([Buffer.from("1"), Buffer.from("234"), Buffer.from("56789")]);
    expect(await hashReadable(source, { maxBytes: 9, onProgress: (bytes) => progress.push(bytes) })).toEqual(toy);
    expect(progress).toEqual([1, 4, 9]);
  });

  it("hashes an empty byte stream at the zero-byte boundary", async () => {
    expect(await hashReadable(Readable.from([]), { maxBytes: 0 })).toEqual({
      size: 0, crc32: "00000000", md5: "d41d8cd98f00b204e9800998ecf8427e",
      sha1: "da39a3ee5e6b4b0d3255bfef95601890afd80709", sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    });
  });

  it("reports incremental consumption before the source ends", async () => {
    const source = stalled();
    const progress: number[] = [];
    const result = hashReadable(source, { maxBytes: 9, onProgress: (size) => progress.push(size) });
    source.emit("data", Buffer.from("1234"));
    expect(progress).toEqual([4]);
    source.emit("data", new Uint8Array(Buffer.from("56789")));
    source.emit("end");
    expect(await result).toEqual(toy);
    source.destroy();
  });

  it("destroys the source as soon as a chunk exceeds the byte budget", async () => {
    const source = stalled();
    const progress: number[] = [];
    const result = hashReadable(source, { maxBytes: 8, onProgress: (size) => progress.push(size) });
    source.emit("data", Buffer.from("1234"));
    source.emit("data", Buffer.from("56789"));
    await expect(result).rejects.toThrow(/byte|size|limit/i);
    expect(source.destroyed).toBe(true);
    expect(progress).toEqual([4]);
  });

  it("rejects the first byte when the budget is zero", async () => {
    const source = Readable.from([Buffer.from("x")]);
    await expect(hashReadable(source, { maxBytes: 0 })).rejects.toThrow(/byte|size|limit/i);
    expect(source.destroyed).toBe(true);
  });

  it("cancels a pending read promptly and clears its deadline", async () => {
    vi.useFakeTimers();
    const source = stalled();
    const controller = new AbortController();
    const result = hashReadable(source, { maxBytes: 10, timeoutMs: 100, signal: controller.signal });
    controller.abort();
    await expect(result).rejects.toMatchObject({ name: "AbortError" });
    expect(source.destroyed).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not begin reading an already aborted source", async () => {
    let reads = 0;
    const source = new Readable({ read() { reads++; } });
    const controller = new AbortController();
    controller.abort();
    await expect(hashReadable(source, { maxBytes: 10, signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
    expect(source.destroyed).toBe(true);
    expect(reads).toBe(0);
  });

  it("handles an underlying source cleanup error during cancellation", async () => {
    const source = new Readable({ read() {}, destroy(_error, callback) { callback(new Error("source cleanup failed")); } });
    const controller = new AbortController();
    const result = hashReadable(source, { maxBytes: 10, signal: controller.signal });
    const closed = new Promise<void>((resolve) => source.once("close", resolve));
    controller.abort();
    await expect(result).rejects.toMatchObject({ name: "AbortError" });
    await closed;
    expect(source.listenerCount("data")).toBe(0);
    expect(source.listenerCount("end")).toBe(0);
  });

  it("enforces its deadline with fake timers and destroys the source", async () => {
    vi.useFakeTimers();
    const source = stalled();
    const rejection = hashReadable(source, { maxBytes: 10, timeoutMs: 50 }).catch((error: Error) => error);
    await vi.advanceTimersByTimeAsync(49);
    expect(source.destroyed).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await rejection).toMatchObject({ name: "TimeoutError" });
    expect(source.destroyed).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cleans timers and its listeners after successful completion", async () => {
    vi.useFakeTimers();
    const source = Readable.from([Buffer.from("123456789")]);
    const existingListener = () => {};
    source.on("error", existingListener);
    const result = hashReadable(source, { maxBytes: 9, timeoutMs: 100 });
    expect(vi.getTimerCount()).toBe(1);
    await result;
    expect(vi.getTimerCount()).toBe(0);
    expect(source.listeners("error")).toEqual([existingListener]);
    expect(source.listenerCount("data")).toBe(0);
    expect(source.listenerCount("end")).toBe(0);
    expect(source.listenerCount("close")).toBe(0);
  });

  it("rejects source errors without returning a partial fingerprint", async () => {
    const source = stalled();
    source.on("error", () => {});
    const result = hashReadable(source, { maxBytes: 9 });
    const failure = new Error("toy read failed");
    source.emit("data", Buffer.from("123"));
    source.destroy(failure);
    await expect(result).rejects.toBe(failure);
    expect(source.destroyed).toBe(true);
  });

  it("rejects a premature close rather than hashing an incomplete file", async () => {
    const source = stalled();
    const result = hashReadable(source, { maxBytes: 9 });
    source.emit("data", Buffer.from("123"));
    source.destroy();
    await expect(result).rejects.toThrow(/closed|incomplete/i);
  });

  it("rejects decoded strings because byte identity must be preserved", async () => {
    const source = Readable.from(["123456789"]);
    await expect(hashReadable(source, { maxBytes: 9 })).rejects.toThrow(/byte|binary|buffer/i);
    expect(source.destroyed).toBe(true);
  });

  it("destroys the source if progress delivery fails", async () => {
    const source = Readable.from([Buffer.from("123456789")]);
    const failure = new Error("progress consumer failed");
    await expect(hashReadable(source, { maxBytes: 9, onProgress: () => { throw failure; } })).rejects.toBe(failure);
    expect(source.destroyed).toBe(true);
  });

  it.each([-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])("rejects an invalid byte bound %s", async (maxBytes) => {
    const source = stalled();
    await expect(hashReadable(source, { maxBytes })).rejects.toThrow(/bound|byte|limit/i);
    expect(source.destroyed).toBe(true);
  });

  it.each([0, -1, NaN, Infinity, 1.5, 2_147_483_648])("rejects an invalid timeout %s", async (timeoutMs) => {
    const source = stalled();
    await expect(hashReadable(source, { maxBytes: 9, timeoutMs })).rejects.toThrow(/timeout|deadline/i);
    expect(source.destroyed).toBe(true);
  });
});

describe("classifyDump", () => {
  it("returns every exact duplicate/revision match independently of its filename", () => {
    const renamed = { ...rom, gameName: "Toy (Rev A)", name: "renamed.bin" };
    expect(classifyDump(toy, [rom, renamed])).toEqual({ status: "verified", matches: [rom, renamed] });
  });

  it.each(["size", "crc32", "md5", "sha1", "sha256"] as const)("requires matching %s when it is supplied", (field) => {
    const wrong = { ...rom, [field]: field === "size" ? 10 : "0".repeat(toy[field].length) };
    expect(classifyDump(toy, [wrong])).toEqual({ status: "unknown", matches: [] });
    expect(classifyDump(toy, [wrong], wrong)).toEqual({ status: "mismatch", matches: [] });
  });

  it("does not infer corruption from a missing hash or a familiar filename", () => {
    const noHash: DatRom = { gameName: "Toy", name: "toy.bin", size: 9 };
    expect(classifyDump(toy, [noHash], noHash)).toEqual({ status: "unknown", matches: [] });
    expect(classifyDump(toy, [])).toEqual({ status: "unknown", matches: [] });
  });

  it("never automatically verifies a nodump entry even if a checksum was supplied", () => {
    const nodump = { ...rom, status: "nodump" };
    expect(classifyDump(toy, [nodump], nodump)).toEqual({ status: "unknown", matches: [] });
  });

  it("marks an explicitly expected different revision as mismatch despite another known match", () => {
    const expected = { ...rom, gameName: "Toy (Rev 2)", crc32: "00000000" };
    expect(classifyDump(toy, [rom, expected], expected)).toEqual({ status: "mismatch", matches: [rom] });
  });

  it("can verify an explicit expected identity that is not repeated in the candidate list", () => {
    expect(classifyDump(toy, [], rom)).toEqual({ status: "verified", matches: [] });
  });

  it("supports a DAT that supplies only one normalized checksum", () => {
    const crcOnly: DatRom = { gameName: "Toy", name: "toy.bin", size: 9, crc32: "CBF43926" };
    expect(classifyDump(toy, [crcOnly])).toEqual({ status: "verified", matches: [crcOnly] });
  });

  it("does not treat a malformed caller-supplied checksum as verifiable", () => {
    const invalid = { ...rom, crc32: "" };
    expect(classifyDump(toy, [invalid], invalid)).toEqual({ status: "unknown", matches: [] });
  });
});
