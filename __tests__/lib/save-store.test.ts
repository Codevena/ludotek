import { mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSaveObject, verifySaveObject } from "@/lib/save-store";
let sandbox: string;
let storageDirectory: string;
beforeEach(async () => { sandbox = await mkdtemp(path.join(tmpdir(), "ludotek-save-store-")); storageDirectory = path.join(sandbox, "store"); });
afterEach(async () => { vi.useRealTimers(); await rm(sandbox, { recursive: true }); });
const put = (contents: string) => createSaveObject(async (sink, signal) => { await pipeline(Readable.from(contents), sink, { signal }); }, { storageDirectory, expectedBytes: Buffer.byteLength(contents) });
describe("immutable verified save object store", () => {
  it("streams content to one hashed immutable object, verifies dedup and preserves original bytes", async () => {
    const first = await put("own save bytes"); const second = await put("own save bytes");
    expect(first).toEqual(second); expect(first.storageKey).toMatch(/^[a-f0-9]{64}$/);
    expect(await readdir(storageDirectory)).toEqual([first.storageKey]);
    expect(await verifySaveObject(first.storageKey, { storageDirectory })).toMatchObject({ sha256: first.storageKey, size: "14" });
    expect(await readFile(path.join(storageDirectory, first.storageKey), "utf8")).toBe("own save bytes");
  });
  it("rejects a corrupt existing object rather than overwriting it under a matching filename", async () => {
    const first = await put("own save bytes"); await writeFile(path.join(storageDirectory, first.storageKey), "corrupt bytes!");
    await expect(put("own save bytes")).rejects.toThrow();
    expect(await readFile(path.join(storageDirectory, first.storageKey), "utf8")).toBe("corrupt bytes!");
  });
  it("refuses traversal, final symlinks and incorrect expected stream sizes", async () => {
    await expect(verifySaveObject("../outside", { storageDirectory })).rejects.toThrow();
    const first = await put("own save bytes");
    const outside = path.join(sandbox, "outside"); await writeFile(outside, "private other bytes");
    const key = "a".repeat(64); await symlink(outside, path.join(storageDirectory, key));
    await expect(verifySaveObject(key, { storageDirectory })).rejects.toThrow();
    await expect(createSaveObject(async (sink, signal) => { await pipeline(Readable.from("short"), sink, { signal }); }, { storageDirectory, expectedBytes: 6 })).rejects.toThrow();
    expect(await readFile(outside, "utf8")).toBe("private other bytes");
    expect(await readFile(path.join(storageDirectory, first.storageKey), "utf8")).toBe("own save bytes");
  });
  it("a stale version read does not create a missing object store", async () => {
    await expect(verifySaveObject("a".repeat(64), { storageDirectory })).rejects.toThrow();
    expect(await readdir(sandbox)).toEqual([]);
  });
  it("requests cancellation but waits for the source to drain before finishing", async () => {
    const controller = new AbortController(); let drain!: () => void; let finished = false;
    const transfer = createSaveObject(async (_sink, signal) => {
      await new Promise<void>((resolve) => { drain = resolve; signal.addEventListener("abort", () => {}, { once: true }); });
      signal.throwIfAborted();
    }, { storageDirectory, expectedBytes: 5, signal: controller.signal }).catch(() => { finished = true; });
    await vi.waitFor(() => expect(drain).toBeTypeOf("function")); controller.abort();
    await Promise.resolve(); expect(finished).toBe(false);
    drain(); await transfer; expect(finished).toBe(true);
    expect(await readdir(storageDirectory)).toEqual([]);
  });
});
