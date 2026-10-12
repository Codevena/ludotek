import { mkdtemp, mkdir, readFile, rm, symlink, writeFile, lstat, rename } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough, Readable, Writable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createConnection, requireFileIo } from "@/lib/connection";
import { FileIoError, FtpFileIo, LocalFileIo, SftpFileIo } from "@/lib/file-io";
import type { Client as FtpClient } from "basic-ftp";
import type { SFTPWrapper } from "ssh2";

let sandbox: string;
let root: string;
beforeEach(async () => {
  sandbox = await mkdtemp(join(tmpdir(), "ludotek-file-io-"));
  root = join(sandbox, "roms");
  await mkdir(root);
  vi.stubEnv("LOCAL_FILES_ROOT", root);
  vi.stubEnv("LOCAL_FILES_ROOTS", "");
  vi.stubEnv("DATABASE_URL", `file:${join(sandbox, "test.db")}`);
});
afterEach(async () => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.useRealTimers();
  await rm(sandbox, { recursive: true, force: true });
});
async function localIo() {
  return requireFileIo(await createConnection({ protocol: "local", host: "", port: 0, user: "", password: "" }));
}
function collector() {
  const chunks: Buffer[] = [];
  const sink = new Writable({ write(chunk, _encoding, callback) { chunks.push(Buffer.from(chunk)); callback(); } });
  return { sink, value: () => Buffer.concat(chunks).toString() };
}
const limits = { maxBytes: 100, timeoutMs: 1_000 };

describe("bounded LOCAL file I/O", () => {
  it("exposes actual capabilities and streams an exact file without a whole-ROM buffer", async () => {
    const io = await localIo();
    await writeFile(join(root, "game.nes"), "ROM bytes");
    const sink = collector();
    const progress: number[] = [];
    const result = await io.readTo(join(root, "game.nes"), sink.sink, { ...limits, expectedBytes: 9, onProgress: (bytes) => progress.push(bytes) });
    expect(result).toEqual({ bytes: 9 });
    expect(sink.value()).toBe("ROM bytes");
    expect(progress.at(-1)).toBe(9);
    expect((await io.capabilities(root)).publishNoReplace.state).toBe("supported");
    expect((await io.freeBytes(root)).state).toBe("known");
    const identity = (await io.lstat(join(root, "game.nes"))).identity;
    expect(identity).toMatch(/^\d+:\d+$/);
    await io.renameNoReplace(join(root, "game.nes"), join(root, "renamed.nes"));
    expect((await io.lstat(join(root, "renamed.nes"))).identity).toBe(identity);
  });
  it("fails on too many or too few bytes and drains both streams before rejecting", async () => {
    const io = await localIo();
    await writeFile(join(root, "game.nes"), "12345");
    for (const options of [{ ...limits, maxBytes: 4 }, { ...limits, expectedBytes: 6 }]) {
      const sink = collector();
      await expect(io.readTo(join(root, "game.nes"), sink.sink, options)).rejects.toThrow(/bytes|size|limit/i);
      expect(sink.sink.destroyed).toBe(true);
    }
  });
  it("creates and flushes an exclusive temp, publishes without replacing a colliding target", async () => {
    const io = await localIo();
    const temp = join(root, ".plan-temp");
    const target = join(root, "target.nes");
    await io.writeExclusiveTempFrom(temp, Readable.from(["new ROM"]), { ...limits, expectedBytes: 7 });
    await writeFile(target, "foreign ROM");
    await expect(io.publishFileNoReplace(temp, target)).rejects.toMatchObject({ code: "EEXIST" });
    expect(await readFile(target, "utf8")).toBe("foreign ROM");
    expect(await readFile(temp, "utf8")).toBe("new ROM");
    await rm(target);
    await io.publishFileNoReplace(temp, target);
    expect(await readFile(target, "utf8")).toBe("new ROM");
    await expect(lstat(temp)).rejects.toMatchObject({ code: "ENOENT" });
  });
  it("rejects an already-existing temp before reading the source", async () => {
    const io = await localIo();
    const temp = join(root, ".temp");
    await writeFile(temp, "foreign");
    let reads = 0;
    const source = new Readable({ read() { reads++; this.push("replacement"); this.push(null); } });
    await expect(io.writeExclusiveTempFrom(temp, source, limits)).rejects.toMatchObject({ code: "EEXIST" });
    expect(reads).toBe(0);
    expect(await readFile(temp, "utf8")).toBe("foreign");
  });
  it("retains a failed partial exclusive temp for journal recovery", async () => {
    const io = await localIo();
    const temp = join(root, ".temp");
    await expect(io.writeExclusiveTempFrom(temp, Readable.from(["12345"]), { ...limits, maxBytes: 4 })).rejects.toThrow(/limit/i);
    expect((await lstat(temp)).isFile()).toBe(true);
  });
  it("refuses unavailable directory durability before reading or creating a temp", async () => {
    const io = new LocalFileIo();
    vi.spyOn(io, "flushDirectory").mockRejectedValue(new Error("unsupported fsync"));
    const read = vi.fn();
    const source = new Readable({ read });
    const temp = join(root, ".temp");
    await expect(io.writeExclusiveTempFrom(temp, source, limits)).rejects.toMatchObject({ code: "UNSUPPORTED_CAPABILITY", tempCreated: false });
    expect(read).not.toHaveBeenCalled();
    await expect(lstat(temp)).rejects.toMatchObject({ code: "ENOENT" });
  });
  it("flushes existing regular-file data before a namespace operation, without following links", async () => {
    const io = new LocalFileIo();
    const filename = join(root, "game.nes");
    await writeFile(filename, "ROM");
    await io.flushFile(filename);
    await symlink(filename, join(root, "link.nes"));
    await expect(io.flushFile(join(root, "link.nes"))).rejects.toThrow(/regular|symlink/i);
    await expect(io.flushFile(root)).rejects.toThrow(/regular/i);
    expect(await readFile(filename, "utf8")).toBe("ROM");
  });
  it("reports an owned temp when its final directory flush fails after handle close", async () => {
    const io = new LocalFileIo();
    const flush = io.flushDirectory.bind(io);
    let calls = 0;
    vi.spyOn(io, "flushDirectory").mockImplementation(async (dir) => {
      if (++calls === 2) throw new Error("final flush failed");
      await flush(dir);
    });
    const temp = join(root, ".temp");
    await expect(io.writeExclusiveTempFrom(temp, Readable.from(["ROM"]), limits)).rejects.toMatchObject({ tempCreated: true });
    expect(await readFile(temp, "utf8")).toBe("ROM");
  });
  it("does not follow symlink entries, cross configured roots or rename directories as regular files", async () => {
    const io = await localIo();
    await writeFile(join(root, "game.nes"), "ROM");
    await symlink(join(root, "game.nes"), join(root, "link.nes"));
    expect((await io.lstat(join(root, "link.nes"))).type).toBe("symlink");
    await expect(io.readTo(join(root, "link.nes"), collector().sink, limits)).rejects.toThrow(/regular|symlink/i);
    await expect(io.publishFileNoReplace(join(root, "game.nes"), join(sandbox, "outside.nes"))).rejects.toThrow(/outside|allowed/i);
    await mkdir(join(root, "dir"));
    await expect(io.renameNoReplace(join(root, "dir"), join(root, "renamed"))).rejects.toThrow(/regular|directory/i);
    expect(await readFile(join(root, "game.nes"), "utf8")).toBe("ROM");
  });
  it("stops an aborted or timed-out source and retains only its own incomplete temp", async () => {
    const io = await localIo();
    const source = new PassThrough();
    const abort = new AbortController();
    const pending = io.writeExclusiveTempFrom(join(root, ".temp"), source, { ...limits, signal: abort.signal });
    source.write("partial");
    // Abort after the exclusive file has actually opened; no wall-clock sleep.
    while (!source.readableFlowing) await new Promise<void>((resolve) => setImmediate(resolve));
    abort.abort();
    await expect(pending).rejects.toThrow(/abort/i);
    expect(source.destroyed).toBe(true);
    expect((await lstat(join(root, ".temp"))).isFile()).toBe(true);
  });
  it("accounts for a target published before directory flush fails without deleting the source", async () => {
    const io = new LocalFileIo();
    const source = join(root, "source.nes");
    const target = join(root, "target.nes");
    await writeFile(source, "ROM");
    const actualFlush = io.flushDirectory.bind(io);
    let calls = 0;
    vi.spyOn(io, "flushDirectory").mockImplementation(async (dir) => {
      if (++calls === 2) throw new Error("injected directory flush failure");
      await actualFlush(dir);
    });
    await expect(io.renameNoReplace(source, target)).rejects.toMatchObject({ published: true, sourceRetained: true });
    expect(await readFile(source, "utf8")).toBe("ROM");
    expect(await readFile(target, "utf8")).toBe("ROM");
  });
  it("preserves a native replacement source detected after target creation and flush", async () => {
    const io = new LocalFileIo();
    const source = join(root, "source.nes");
    const target = join(root, "target.nes");
    await writeFile(source, "original ROM");
    const flush = io.flushDirectory.bind(io);
    let calls = 0;
    vi.spyOn(io, "flushDirectory").mockImplementation(async (dir) => {
      await flush(dir);
      if (++calls === 2) {
        await rename(source, join(root, "native-backup.nes"));
        await writeFile(source, "foreign replacement");
      }
    });
    await expect(io.renameNoReplace(source, target)).rejects.toMatchObject({ code: "IDENTITY_CONFLICT", published: true, sourceRetained: true });
    expect(await readFile(source, "utf8")).toBe("foreign replacement");
    expect(await readFile(target, "utf8")).toBe("original ROM");
  });
  it("preserves the original source when another process replaces the newly linked target", async () => {
    const io = new LocalFileIo();
    const source = join(root, "source.nes");
    const target = join(root, "target.nes");
    await writeFile(source, "original ROM");
    const flush = io.flushDirectory.bind(io);
    let calls = 0;
    vi.spyOn(io, "flushDirectory").mockImplementation(async (dir) => {
      await flush(dir);
      if (++calls === 2) {
        await rm(target);
        await writeFile(target, "foreign target");
      }
    });
    await expect(io.renameNoReplace(source, target)).rejects.toMatchObject({ code: "IDENTITY_CONFLICT", published: true, sourceRetained: true });
    expect(await readFile(source, "utf8")).toBe("original ROM");
    expect(await readFile(target, "utf8")).toBe("foreign target");
  });
  it("applies a total deadline to a stalled writable source using an injected test clock", async () => {
    const io = await localIo();
    const source = new PassThrough();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const pending = io.writeExclusiveTempFrom(join(root, ".timeout-temp"), source, { ...limits, timeoutMs: 100 });
    const result = expect(pending).rejects.toMatchObject({ code: "IO_TIMEOUT", tempCreated: true });
    while (!source.readableFlowing) await new Promise<void>((resolve) => setImmediate(resolve));
    await vi.advanceTimersByTimeAsync(100);
    await result;
    expect(source.destroyed).toBe(true);
  });
});

describe("bounded remote transport doubles", () => {
  it("keeps SSH extension claims unknown and rejects mutations before opening a channel or consuming a source", async () => {
    const getSftp = vi.fn();
    const io = new SftpFileIo(getSftp, vi.fn());
    const source = new Readable({ read() { throw new Error("source must never be consumed"); } });
    expect((await io.capabilities("/roms")).directoryFlush.state).toBe("unknown");
    await expect(io.writeExclusiveTempFrom("/roms/temp", source, limits)).rejects.toMatchObject({ code: "UNSUPPORTED_CAPABILITY" });
    await expect(io.publishFileNoReplace("/roms/temp", "/roms/target")).rejects.toBeInstanceOf(FileIoError);
    expect(getSftp).not.toHaveBeenCalled();
    expect(source.readableFlowing).toBe(null);
  });
  it("streams SSH with exact bytes, and does not leak a stalled channel on abort", async () => {
    const source = new PassThrough();
    const end = vi.fn(() => source.destroy());
    const sftp = { createReadStream: vi.fn(() => source) } as unknown as SFTPWrapper;
    const io = new SftpFileIo(async () => sftp, end);
    const sink = collector();
    const signal = new AbortController();
    const pending = io.readTo("/roms/a", sink.sink, { ...limits, signal: signal.signal });
    const result = expect(pending).rejects.toMatchObject({ code: "ABORT_ERR" });
    while (!source.readableFlowing) await new Promise<void>((resolve) => setImmediate(resolve));
    source.write("part");
    signal.abort();
    await result;
    expect(end).toHaveBeenCalledOnce();
    expect(source.destroyed).toBe(true);
    expect(sink.sink.destroyed).toBe(true);
  });
  it("closes a late SFTP channel after the total acquisition deadline without starting reads", async () => {
    vi.useFakeTimers();
    let resolveChannel!: (sftp: SFTPWrapper) => void;
    const channel = { createReadStream: vi.fn(), end: vi.fn() } as unknown as SFTPWrapper;
    const disconnected = vi.fn();
    const io = new SftpFileIo(() => new Promise((resolve) => { resolveChannel = resolve; }), disconnected);
    const pending = io.readTo("/roms/a", collector().sink, { ...limits, timeoutMs: 100 });
    const result = expect(pending).rejects.toMatchObject({ code: "IO_TIMEOUT" });
    await vi.advanceTimersByTimeAsync(100);
    await result;
    resolveChannel(channel);
    await Promise.resolve();
    await Promise.resolve();
    expect(disconnected).toHaveBeenCalledOnce();
    expect(channel.end).toHaveBeenCalledOnce();
    expect(channel.createReadStream).not.toHaveBeenCalled();
  });
  it("uses an actual successful SFTP statvfs result, not the presence of an extension method", async () => {
    const statvfs = vi.fn((_path, callback) => callback(undefined, { f_bavail: 3, f_frsize: 4096 }));
    const io = new SftpFileIo(async () => ({ ext_openssh_statvfs: statvfs }) as unknown as SFTPWrapper, vi.fn());
    expect(await io.freeBytes("/roms")).toEqual({ state: "known", bytes: BigInt(12288) });
    statvfs.mockImplementationOnce((_path, callback) => callback(new Error("unsupported")));
    expect((await io.freeBytes("/roms")).state).toBe("unknown");
  });
  it("rejects FTP mutation capabilities before STOR/MKD/read and never enables separate transfer hosts", async () => {
    const client = { uploadFrom: vi.fn(), ensureDir: vi.fn(), rename: vi.fn(), close: vi.fn() } as unknown as FtpClient;
    const io = new FtpFileIo(client);
    const read = vi.fn();
    const source = new Readable({ read });
    await expect(io.writeExclusiveTempFrom("/roms/temp", source, limits)).rejects.toMatchObject({ code: "UNSUPPORTED_CAPABILITY" });
    await expect(io.renameNoReplace("/roms/a", "/roms/b")).rejects.toMatchObject({ code: "UNSUPPORTED_CAPABILITY" });
    expect(client.uploadFrom).not.toHaveBeenCalled();
    expect(client.ensureDir).not.toHaveBeenCalled();
    expect(client.rename).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
  });
  it("drains FTP streams after immediate driver failure instead of waiting for an unwritten meter", async () => {
    const close = vi.fn();
    const io = new FtpFileIo({ downloadTo: async () => { throw new Error("FTP transfer failed"); }, close } as unknown as FtpClient);
    const sink = collector();
    await expect(io.readTo("/roms/a", sink.sink, limits)).rejects.toThrow("FTP transfer failed");
    expect(sink.sink.destroyed).toBe(true);
    expect(close).toHaveBeenCalledOnce();
  });
  it("finishes a bounded FTP download without closing a healthy connection", async () => {
    const { pipeline } = await import("node:stream/promises");
    const close = vi.fn();
    const downloadTo = async (destination: Writable) => { await pipeline(Readable.from(["ROM"]), destination); };
    const io = new FtpFileIo({ downloadTo, close } as unknown as FtpClient);
    const sink = collector();
    expect(await io.readTo("/roms/a", sink.sink, { ...limits, expectedBytes: 3 })).toEqual({ bytes: 3 });
    expect(sink.value()).toBe("ROM");
    expect(close).not.toHaveBeenCalled();
  });
  it("stops an FTP download at the byte boundary and drains its driver and sink", async () => {
    const { pipeline } = await import("node:stream/promises");
    const close = vi.fn();
    const downloadTo = async (destination: Writable) => { await pipeline(Readable.from(["12345"]), destination); };
    const io = new FtpFileIo({ downloadTo, close } as unknown as FtpClient);
    const sink = collector();
    await expect(io.readTo("/roms/a", sink.sink, { ...limits, maxBytes: 4 })).rejects.toMatchObject({ code: "BYTE_LIMIT" });
    expect(sink.value()).toBe("");
    expect(sink.sink.destroyed).toBe(true);
    expect(close).toHaveBeenCalledOnce();
  });
  it("closes stalled FTP transfers once at the total deadline and does not start a simultaneous command", async () => {
    vi.useFakeTimers();
    let rejectDownload!: (error: Error) => void;
    const close = vi.fn(() => rejectDownload(new Error("closed")));
    const download = vi.fn(() => new Promise((_resolve, reject) => { rejectDownload = reject; }));
    const io = new FtpFileIo({ downloadTo: download, close, list: vi.fn() } as unknown as FtpClient);
    const sink = collector();
    const pending = io.readTo("/roms/a", sink.sink, { ...limits, timeoutMs: 100 });
    const result = expect(pending).rejects.toMatchObject({ code: "IO_TIMEOUT" });
    await expect(io.lstat("/roms/a")).rejects.toMatchObject({ code: "FTP_BUSY" });
    await vi.advanceTimersByTimeAsync(100);
    await result;
    expect(close).toHaveBeenCalledOnce();
    expect(download).toHaveBeenCalledOnce();
    expect(sink.sink.destroyed).toBe(true);
  });
  it("places a finite deadline on stalled SSH metadata callbacks and closes the connection once", async () => {
    vi.useFakeTimers();
    const channel = { lstat: vi.fn() } as unknown as SFTPWrapper;
    const stop = vi.fn();
    const io = new SftpFileIo(async () => channel, stop);
    const result = expect(io.lstat("/roms/a")).rejects.toMatchObject({ code: "IO_TIMEOUT" });
    await vi.advanceTimersByTimeAsync(10_000);
    await result;
    expect(stop).toHaveBeenCalledOnce();
  });
  it("places a finite deadline on stalled FTP metadata and refuses reuse of the closed client", async () => {
    vi.useFakeTimers();
    const list = vi.fn(() => new Promise(() => {}));
    const close = vi.fn();
    const io = new FtpFileIo({ list, close } as unknown as FtpClient);
    const result = expect(io.lstat("/roms/a")).rejects.toMatchObject({ code: "IO_TIMEOUT" });
    await vi.advanceTimersByTimeAsync(10_000);
    await result;
    await expect(io.lstat("/roms/a")).rejects.toMatchObject({ code: "CONNECTION_CLOSED" });
    expect(list).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });
  it("streams a synthetic 2-GiB ROM using one reused 1-MiB chunk", async () => {
    const chunk = Buffer.alloc(1024 * 1024, 7);
    function* chunks() { for (let index = 0; index < 2048; index++) yield chunk; }
    const io = new SftpFileIo(async () => ({ createReadStream: () => Readable.from(chunks()) }) as unknown as SFTPWrapper, vi.fn());
    let counted = 0;
    const sink = new Writable({ write(buffer, _encoding, callback) { counted += buffer.length; callback(); } });
    expect(await io.readTo("/roms/a", sink, { maxBytes: 2 ** 31, expectedBytes: 2 ** 31, timeoutMs: 2000 })).toEqual({ bytes: 2 ** 31 });
    expect(counted).toBe(2 ** 31);
  });
});
