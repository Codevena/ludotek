import * as fs from "node:fs/promises";
import path from "node:path";
import { Readable, Writable, PassThrough } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createConnection, requireFileIo, type DeviceConnection } from "@/lib/connection";
import { startSshWireServer, type SshWireOptions } from "../helpers/ssh-wire-server";

let fixture: Awaited<ReturnType<typeof startSshWireServer>>;
let connection: DeviceConnection;
afterEach(async () => { vi.useRealTimers(); connection?.disconnect(); await fixture?.close(); });
async function setup(options?: SshWireOptions) {
  fixture = await startSshWireServer(options); connection = await createConnection(fixture.config); return requireFileIo(connection);
}
const limits = { maxBytes: 1024 * 1024, timeoutMs: 5000 };
function sink() { const buffers: Buffer[] = []; return { stream: new Writable({ write(data, _encoding, callback) { buffers.push(Buffer.from(data)); callback(); } }), bytes: () => Buffer.concat(buffers) }; }

describe("actual SSH/SFTP file writer", () => {
  it("normalizes an actual missing SFTP entry to the shared ENOENT contract", async () => {
    const io = await setup();
    await expect(io.lstat(path.join(fixture.root, "missing.rom"))).rejects.toMatchObject({ code: "ENOENT", cause: { code: 2 } });
  });
  it("checks an absent target through its existing parent when OpenSSH REALPATH canonicalizes missing names", async () => {
    const io = await setup({ canonicalizeMissing: true }), temporary = path.join(fixture.root, ".temp");
    await io.checkPath!(temporary, [fixture.root], true);
    expect((await io.capabilities(fixture.root)).directoryFlush.state).toBe("supported");
    expect(fixture.commands.some((command) => command.startsWith("realpath -e -- ") && command.includes("/.temp'"))).toBe(false);
    await io.writeExclusiveTempFrom(temporary, Readable.from(["ROM"]), { ...limits, expectedBytes: 3 });
    expect(await fs.readFile(temporary, "utf8")).toBe("ROM"); expect((await io.lstat(temporary)).identity).toMatch(/^\d+:\d+$/);
  });
  it("evidences capabilities using read-only directory OPEN/FSTAT/fsync and actual space", async () => {
    const io = await setup(); const capabilities = await io.capabilities(fixture.root);
    expect(capabilities.publishNoReplace.state).toBe("supported"); expect(capabilities.directoryFlush.state).toBe("supported");
    expect(fixture.events.some((event) => event.op === "OPEN" && event.filename === fixture.root && event.flags === 1)).toBe(true);
    expect(fixture.events.filter((event) => ["WRITE", "MKDIR", "REMOVE", "HARDLINK"].includes(event.op))).toEqual([]);
    expect(await fs.readdir(fixture.root)).toEqual([]); expect((await io.freeBytes(fixture.root)).state).toBe("known");
  });
  it("streams exclusive bytes, fsyncs the retained handle before CLOSE, then hardlinks without replacement", async () => {
    const io = await setup(); const temporary = path.join(fixture.root, ".temp"), target = path.join(fixture.root, "game.nes");
    await io.writeExclusiveTempFrom(temporary, Readable.from([Buffer.alloc(33000, 7), "ROM"]), { ...limits, expectedBytes: 33003 });
    const operations = fixture.events.filter((event) => event.filename === temporary).map((event) => event.op);
    expect(fixture.events.find((event) => event.op === "OPEN" && event.filename === temporary)!.flags! & 40).toBe(40);
    expect(operations.indexOf("WRITE")).toBeGreaterThan(operations.indexOf("OPEN"));
    expect(operations.indexOf("FSYNC")).toBeGreaterThan(operations.lastIndexOf("WRITE")); expect(operations.indexOf("CLOSE")).toBeGreaterThan(operations.indexOf("FSYNC"));
    const identity = (await io.lstat(temporary)).identity; expect(identity).toMatch(/^\d+:\d+$/);
    await io.publishFileNoReplace(temporary, target); expect((await io.lstat(target)).identity).toBe(identity);
    expect((await fs.readFile(target)).length).toBe(33003); await expect(fs.lstat(temporary)).rejects.toMatchObject({ code: "ENOENT" });
    const collected = sink(); expect(await io.readTo(target, collected.stream, { ...limits, expectedBytes: 33003 })).toEqual({ bytes: 33003 }); expect(collected.bytes()).toEqual(await fs.readFile(target));
  });
  it("preserves a colliding temp and target without consuming their replacement source", async () => {
    const io = await setup(); const temporary = path.join(fixture.root, ".temp"), target = path.join(fixture.root, "target"); await fs.writeFile(temporary, "original"); await fs.writeFile(target, "foreign");
    const read = vi.fn(); await expect(io.writeExclusiveTempFrom(temporary, new Readable({ read }), limits)).rejects.toThrow(); expect(read).not.toHaveBeenCalled();
    await expect(io.renameNoReplace(temporary, target)).rejects.toThrow(); expect(await fs.readFile(target, "utf8")).toBe("foreign"); expect(await fs.readFile(temporary, "utf8")).toBe("original");
  });
  it("refuses missing hardlink/fsync or unsuccessful directory fsync before writes", async () => {
    for (const options of [{ extensions: ["fsync@openssh.com"] }, { extensions: ["hardlink@openssh.com"] }, { failDirectoryFsync: true }]) {
      const io = await setup(options); const read = vi.fn(); await expect(io.writeExclusiveTempFrom(path.join(fixture.root, ".temp"), new Readable({ read }), limits)).rejects.toMatchObject({ code: "UNSUPPORTED_CAPABILITY" });
      const directory = path.join(fixture.root, "owned-directory"); await fs.mkdir(directory); const identity = (await io.lstat(directory)).identity!;
      await expect(io.removeEmptyDirectory!(directory, identity)).rejects.toMatchObject({ code: "UNSUPPORTED_CAPABILITY" }); expect((await fs.lstat(directory)).isDirectory()).toBe(true);
      expect(read).not.toHaveBeenCalled(); expect(fixture.events.some((event) => event.op === "WRITE" || (event.op === "OPEN" && !!(event.flags! & 8)))).toBe(false);
      expect(fixture.events.some((event) => event.op === "RMDIR")).toBe(false);
      connection.disconnect(); await fixture.close();
    }
  });
  it("rejects resolved root escapes and differing native/SFTP namespaces; safely quotes shell metacharacters", async () => {
    const io = await setup(); await fs.symlink(fixture.outside, path.join(fixture.root, "escape"));
    await expect(io.checkPath!(path.join(fixture.root, "escape", "game"), [fixture.root], true)).rejects.toThrow(/root|outside|escape/i);
    const special = path.join(fixture.root, "game'$(touch INJECTED);.nes"); await fs.writeFile(special, "ROM");
    await io.checkPath!(special, [fixture.root]); expect((await io.lstat(special)).identity).toMatch(/^\d+:\d+$/); expect(await fs.readdir(fixture.root)).not.toContain("INJECTED");
    fixture.options.nativeRoot = "/different-native-root";
    await expect(io.checkPath!(special, [fixture.root])).rejects.toThrow(/namespace/i);
  });
  it("creates one owned nonrecursive directory and removes only its verified empty identity", async () => {
    const io = await setup(); const directory = path.join(fixture.root, "created"); const created = await io.createDirectoryNoReplace!(directory);
    expect(created.type).toBe("directory"); expect(created.identity).toMatch(/^\d+:\d+$/);
    await expect(io.createDirectoryNoReplace!(directory)).rejects.toThrow(); await expect(io.removeEmptyDirectory!(directory, "foreign")).rejects.toMatchObject({ code: "IDENTITY_CONFLICT" });
    await fs.writeFile(path.join(directory, "retained"), "ROM"); await expect(io.removeEmptyDirectory!(directory, created.identity!)).rejects.toThrow(); expect(await fs.readFile(path.join(directory, "retained"), "utf8")).toBe("ROM");
    await fs.unlink(path.join(directory, "retained")); await io.removeEmptyDirectory!(directory, created.identity!); await expect(fs.lstat(directory)).rejects.toMatchObject({ code: "ENOENT" });
  });
  it("retains its byte-limit partial temp and drains an aborted stalled wire WRITE", async () => {
    const io = await setup({ stallWrite: true }); const source = new PassThrough(), abort = new AbortController(); const temporary = path.join(fixture.root, ".temp");
    const pending = io.writeExclusiveTempFrom(temporary, source, { ...limits, signal: abort.signal }); const rejected = expect(pending).rejects.toMatchObject({ code: "ABORT_ERR", tempCreated: true }); source.write("partial");
    while (!fixture.events.some((event) => event.op === "WRITE")) await new Promise<void>((resolve) => setImmediate(resolve));
    abort.abort(); await rejected; expect(source.destroyed).toBe(true); expect((await fs.lstat(temporary)).isFile()).toBe(true);
    while (fixture.activeConnections()) await new Promise<void>((resolve) => setImmediate(resolve)); expect(fixture.activeConnections()).toBe(0);
  });
  it("reports lost hardlink acknowledgement as a possible public effect, retaining both entries", async () => {
    const io = await setup({ loseHardlinkReply: true }); const source = path.join(fixture.root, "source"), target = path.join(fixture.root, "target"); await fs.writeFile(source, "original");
    await expect(io.renameNoReplace(source, target)).rejects.toMatchObject({ published: true, sourceRetained: true });
    expect(await fs.readFile(source, "utf8")).toBe("original"); expect(await fs.readFile(target, "utf8")).toBe("original");
  });
  it("preserves native foreign replacements after hardlink even with equal bytes and visible mtime", async () => {
    const io = await setup(); const source = path.join(fixture.root, "source"), target = path.join(fixture.root, "target"), backup = path.join(fixture.root, "retained-original");
    await fs.writeFile(source, "original"); const original = await fs.lstat(source); let changed = false;
    fixture.options.afterFsync = async () => {
      if (!changed && fixture.events.some((event) => event.op === "HARDLINK")) { changed = true; await fs.rename(source, backup); await fs.writeFile(source, "original"); await fs.utimes(source, original.atime, original.mtime); }
    };
    await expect(io.renameNoReplace(source, target)).rejects.toMatchObject({ code: "IDENTITY_CONFLICT", published: true, sourceRetained: true });
    expect(await fs.readFile(source, "utf8")).toBe("original"); expect((await fs.lstat(source)).ino).not.toBe((await fs.lstat(target)).ino); expect((await fs.lstat(backup)).ino).toBe((await fs.lstat(target)).ino);
  });
  it("retains the source when target-directory durability fails after the hardlink", async () => {
    const io = await setup(); const source = path.join(fixture.root, "source"), target = path.join(fixture.root, "target"); await fs.writeFile(source, "original");
    fixture.options.afterFsync = async () => { if (fixture.events.some((event) => event.op === "HARDLINK")) throw new Error("Controlled target directory flush failure"); };
    await expect(io.renameNoReplace(source, target)).rejects.toMatchObject({ published: true, sourceRetained: true });
    expect(await fs.readFile(source, "utf8")).toBe("original"); expect(await fs.readFile(target, "utf8")).toBe("original"); expect(fixture.events.some((event) => event.op === "REMOVE")).toBe(false);
  });
  it("bounds real remote reads and writes, retaining only its exclusive failed temp", async () => {
    const io = await setup(); const source = path.join(fixture.root, "source"), temporary = path.join(fixture.root, ".temp"); await fs.writeFile(source, "12345"); const collected = sink();
    await expect(io.readTo(source, collected.stream, { ...limits, maxBytes: 4 })).rejects.toMatchObject({ code: "BYTE_LIMIT" }); expect(collected.stream.destroyed).toBe(true);
    await expect(io.writeExclusiveTempFrom(temporary, Readable.from(["12345"]), { ...limits, maxBytes: 4 })).rejects.toMatchObject({ code: "BYTE_LIMIT", tempCreated: true }); expect((await fs.lstat(temporary)).isFile()).toBe(true);
  });
  it("flushes actual regular-file handles and rejects symlinks, native parser errors and namespace mismatches before mutation", async () => {
    const io = await setup(); const source = path.join(fixture.root, "source"), link = path.join(fixture.root, "link"); await fs.writeFile(source, "ROM"); await fs.symlink(source, link);
    await io.flushFile!(source); expect(fixture.events.some((event) => event.op === "FSYNC" && event.filename === source)).toBe(true); await expect(io.flushFile!(link)).rejects.toThrow(/regular|file/i);
    fixture.options.nativeStatOutput = "invented identity\n"; await expect(io.writeExclusiveTempFrom(path.join(fixture.root, ".temp"), Readable.from(["ROM"]), limits)).rejects.toMatchObject({ code: "INVALID_NATIVE_STAT" });
    expect(fixture.events.some((event) => event.op === "WRITE")).toBe(false);
  });
  it("preserves bounded read-only SFTP when native SSH execution is unavailable while refusing strict writes", async () => {
    const io = await setup({ refuseExec: true }); const source = path.join(fixture.root, "source"); await fs.writeFile(source, "ROM");
    await io.checkPath!(source, [fixture.root]); expect((await io.lstat(source)).identity).toBeUndefined(); const collected = sink();
    expect(await io.readTo(source, collected.stream, { ...limits, expectedBytes: 3 })).toEqual({ bytes: 3 }); expect(collected.bytes().toString()).toBe("ROM");
    expect((await io.capabilities(fixture.root)).directoryFlush.state).toBe("unsupported");
    const read = vi.fn(); await expect(io.writeExclusiveTempFrom(path.join(fixture.root, ".temp"), new Readable({ read }), limits)).rejects.toMatchObject({ code: "UNSUPPORTED_CAPABILITY" }); expect(read).not.toHaveBeenCalled();
    expect(fixture.events.some((event) => event.op === "WRITE" || (event.op === "OPEN" && !!(event.flags! & 8)))).toBe(false);
  });
});
