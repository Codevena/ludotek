import { mkdir, readFile, realpath, rm, lstat } from "node:fs/promises";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import path from "node:path";
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("node:fs/promises", async (original) => { const actual = await original<typeof import("node:fs/promises")>(); return { ...actual, statfs: vi.fn(actual.statfs), mkdir: vi.fn(actual.mkdir) }; });
import { statfs } from "node:fs/promises";
import { createTestDatabase } from "../helpers/temp-database";
import { receiveUpload, UPLOAD_BASE } from "@/lib/upload-journal";
import { loadUploadSession } from "@/lib/disc-inputs";

let fixture: Awaited<ReturnType<typeof createTestDatabase>>;
let base: string;
const actualStatfs = vi.mocked(statfs).getMockImplementation()!;
beforeAll(async () => { fixture = await createTestDatabase(); await mkdir(UPLOAD_BASE, { recursive: true }); base = await realpath(UPLOAD_BASE); });
afterAll(async () => { await fixture.cleanup(); });
beforeEach(async () => { vi.mocked(mkdir).mockClear(); vi.mocked(statfs).mockImplementation(actualStatfs); });
const ownSessions = () => vi.mocked(mkdir).mock.calls.map(([filename]) => String(filename)).filter((filename) => path.dirname(filename) === base && /^[a-f0-9-]{36}$/.test(path.basename(filename)));
async function expectOwnFailedSessionsRemoved() { for (const directory of ownSessions()) await expect(lstat(directory)).rejects.toHaveProperty("code", "ENOENT"); }
afterEach(async () => { for (const directory of ownSessions()) await rm(directory, { recursive: true, force: true }); vi.restoreAllMocks(); });
function multipart(files: Array<[string, Uint8Array | string]>) { const form = new FormData(); for (const [name, bytes] of files) form.append("files", new File([bytes as BlobPart], name)); return new Request("http://localhost/api/upload", { method: "POST", body: form }); }
function crc32(bytes: Buffer) { let crc = 0xffffffff; for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); } return (crc ^ 0xffffffff) >>> 0; }
/** Tiny stored ZIPs generated only from these test literals. No dependency or external data. */
function zip(entries: Array<{ name: string; bytes: string; mode?: number; declaredSize?: number }>) {
  const locals: Buffer[] = []; const central: Buffer[] = []; let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name); const bytes = Buffer.from(entry.bytes); const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt32LE(crc32(bytes), 14); local.writeUInt32LE(bytes.length, 18); local.writeUInt32LE(entry.declaredSize ?? bytes.length, 22); local.writeUInt16LE(name.length, 26);
    const record = Buffer.alloc(46); record.writeUInt32LE(0x02014b50); record.writeUInt16LE(0x0314, 4); record.writeUInt16LE(20, 6); record.writeUInt32LE(crc32(bytes), 16); record.writeUInt32LE(bytes.length, 20); record.writeUInt32LE(entry.declaredSize ?? bytes.length, 24); record.writeUInt16LE(name.length, 28); record.writeUInt32LE(((entry.mode ?? 0x81a4) * 65536) >>> 0, 38); record.writeUInt32LE(offset, 42);
    locals.push(local, name, bytes); central.push(record, name); offset += local.length + name.length + bytes.length;
  }
  const directory = Buffer.concat(central); const footer = Buffer.alloc(22); footer.writeUInt32LE(0x06054b50); footer.writeUInt16LE(entries.length, 8); footer.writeUInt16LE(entries.length, 10); footer.writeUInt32LE(directory.length, 12); footer.writeUInt32LE(offset, 16); return Buffer.concat([...locals, directory, footer]);
}
describe("bounded streaming upload intake", () => {
  it("streams literal files and a tiny ZIP without whole-file arrayBuffer copies, then uses actual extracted descriptor paths", async () => {
    const arrayBuffer = vi.spyOn(Blob.prototype, "arrayBuffer").mockImplementation(async () => { throw new Error("Extra whole-file buffer copy is forbidden"); });
    const archive = zip([{ name: "set/Own Track.bin", bytes: "TRACK" }, { name: "set/Own Track.cue", bytes: 'FILE "Own Track.bin" BINARY\n TRACK 01 MODE1/2352\n' }]);
    const result = await receiveUpload(multipart([["own.zip", archive], ["Another.chd", "CHD"]]), { db: fixture.client });
    expect(arrayBuffer).not.toHaveBeenCalled(); expect(result.files).toHaveLength(3);
    expect(await readFile(result.files.find((file) => file.name === "Own Track.bin")!.path, "utf8")).toBe("TRACK");
    const loaded = await loadUploadSession(result.sessionId, "psx"); expect(loaded.games).toHaveLength(2);
    expect(loaded.descriptorInputs.get(result.files.find((file) => file.name === "Own Track.cue")!.path)).toEqual([await realpath(result.files.find((file) => file.name === "Own Track.bin")!.path)]);
  });
  it("rejects traversal, symlinks, duplicate entries and excessive directory counts and removes only its own failed session", async () => {
    for (const entries of [
      [{ name: "../escape.chd", bytes: "BAD" }], [{ name: "link.chd", bytes: "../outside", mode: 0xa1ff }],
      [{ name: "same.chd", bytes: "ONE" }, { name: "same.chd", bytes: "TWO" }],
      Array.from({ length: 101 }, (_, index) => ({ name: `${index}.chd`, bytes: "x" })),
    ]) {
      await expect(receiveUpload(multipart([["own.zip", zip(entries)]]), { db: fixture.client })).rejects.toThrow(); await expectOwnFailedSessionsRemoved();
    }
  });
  it("checks authoritative free disk space before session creation and before extracting declared expanded bytes", async () => {
    vi.mocked(statfs).mockResolvedValue({ bavail: BigInt(1), bsize: BigInt(1) } as never);
    await expect(receiveUpload(multipart([["small.chd", "x"]]), { db: fixture.client })).rejects.toMatchObject({ status: 413 }); expect(ownSessions()).toEqual([]);
    vi.mocked(statfs).mockResolvedValue({ bavail: BigInt(-1), bsize: BigInt(1) } as never);
    await expect(receiveUpload(multipart([["small.chd", "x"]]), { db: fixture.client })).rejects.toMatchObject({ status: 503 }); expect(ownSessions()).toEqual([]);
    // Enough for wire/archive bytes, insufficient for its 2 MiB claimed output.
    vi.mocked(statfs).mockResolvedValue({ bavail: BigInt(256 * 1024 * 1024 + 1024), bsize: BigInt(1) } as never);
    await expect(receiveUpload(multipart([["own.zip", zip([{ name: "large.chd", bytes: "x", declaredSize: 2 * 1024 * 1024 }])]]), { db: fixture.client })).rejects.toMatchObject({ status: 413 }); await expectOwnFailedSessionsRemoved();
  });
  it("rejects wire/file limits and reserved cache names before creating a session", async () => {
    const oversized = multipart([["own.chd", "x"]]); oversized.headers.set("Content-Length", String(1024 ** 3 + 1));
    await expect(receiveUpload(oversized, { db: fixture.client })).rejects.toMatchObject({ status: 413 });
    await expect(receiveUpload(multipart([[".ludotek-internal.chd", "x"]]), { db: fixture.client })).rejects.toMatchObject({ status: 413 });
    await expect(receiveUpload(multipart(Array.from({ length: 101 }, (_, index) => [`${index}.chd`, "x"])), { db: fixture.client })).rejects.toThrow();
    expect(ownSessions()).toEqual([]);
  });
});
