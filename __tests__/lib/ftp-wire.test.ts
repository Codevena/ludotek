import * as fs from "node:fs/promises";
import { PassThrough, Readable, Writable } from "node:stream";
import { Client } from "basic-ftp";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FtpFileIo } from "@/lib/ftp-file-io";
import { ftpWireServer, type FtpWireOptions, type FtpWireServer } from "../helpers/ftp-wire-server";

let fixture: FtpWireServer | undefined;
let client: Client | undefined;
async function connect(options: FtpWireOptions = {}) {
  fixture = await ftpWireServer(options);
  client = new Client(2_000);
  await client.access({ host: "127.0.0.1", port: fixture.port, user: "owned", password: "fixture", secure: options.tls, secureOptions: options.tls ? { ca: fixture.ca } : undefined });
  return new FtpFileIo(client);
}
afterEach(async () => {
  client?.close();
  vi.useRealTimers();
  await fixture?.close();
  fixture = undefined;
  client = undefined;
});
function collector() {
  const chunks: Buffer[] = [];
  const sink = new Writable({ write(chunk, _encoding, callback) { chunks.push(Buffer.from(chunk)); callback(); } });
  return { sink, value: () => Buffer.concat(chunks) };
}
const temp = "/roms/.ludotek-1275d8d4-10c9-4c57-959c-f043e41f3906-temp";
const limits = { maxBytes: 1024, timeoutMs: 2_000 };

describe("actual FTP/FTPS checked file I/O", () => {
  it.each([false, true])("streams and publishes exact bytes over trusted TLS=%s without claiming strict capabilities", async (encrypted) => {
    const io = await connect({ tls: encrypted });
    const bytes = Buffer.from([0, 1, 2, 255, 42]);
    expect(io.checked?.policy).toBe("ftp_checked");
    expect(io.checked?.durability).toBe("server_ack");
    const capabilities = await io.capabilities("/roms");
    for (const key of ["exclusiveTemp", "publishNoReplace", "renameNoReplace", "fileFlush", "directoryFlush"] as const) expect(capabilities[key].state).toBe("unsupported");
    expect(await io.freeBytes("/roms")).toMatchObject({ state: "unknown" });
    expect(await io.checked!.writeTempFrom(temp, Readable.from([bytes.subarray(0, 2), bytes.subarray(2)]), { ...limits, expectedBytes: 5 })).toEqual({ bytes: 5 });
    expect((await fs.lstat(fixture!.file(temp + ".reservation"))).isDirectory()).toBe(true);
    const sink = collector();
    expect(await io.readTo(temp, sink.sink, { ...limits, expectedBytes: 5 })).toEqual({ bytes: 5 });
    expect(sink.value()).toEqual(bytes);
    await io.checked!.acknowledgeFile(temp);
    await io.checked!.publish(temp, "/roms/game.nes");
    await io.checked!.acknowledgeDirectory("/roms");
    expect(await fs.readFile(fixture!.file("/roms/game.nes"))).toEqual(bytes);
    await expect(fs.lstat(fixture!.file(temp))).rejects.toMatchObject({ code: "ENOENT" });
    const entry = await io.lstat("/roms/game.nes");
    expect(entry.identity).toBeUndefined();
    expect(entry.uniqueId).toMatch(/^\d+-\d+$/);
    if (encrypted) expect(fixture!.commands.some((entry) => entry.command === "AUTH" && entry.argument === "TLS")).toBe(true);
  }, 20_000);

  it("preserves a missing MLSD unique fact and maps an absent entry to ENOENT", async () => {
    const io = await connect({ uniqueFacts: false });
    await fs.writeFile(fixture!.file("/roms/game.nes"), "ROM");
    expect(await io.lstat("/roms/game.nes")).toMatchObject({ type: "file", size: 3 });
    expect((await io.lstat("/roms/game.nes")).uniqueId).toBeUndefined();
    await expect(io.lstat("/roms/missing.nes")).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("refuses preexisting reservation ownership before reading or uploading", async () => {
    const io = await connect();
    await fs.mkdir(fixture!.file(temp + ".reservation"));
    let reads = 0;
    const source = new Readable({ read() { reads++; this.push("new"); this.push(null); } });
    await expect(io.checked!.writeTempFrom(temp, source, limits)).rejects.toThrow();
    expect(reads).toBe(0);
    expect(fixture!.commands.some((item) => item.command === "STOR")).toBe(false);
    expect((await fs.lstat(fixture!.file(temp + ".reservation"))).isDirectory()).toBe(true);
  });

  it("never overwrites a known existing temp and retains its new reservation for review", async () => {
    const io = await connect();
    await fs.writeFile(fixture!.file(temp), "foreign");
    let reads = 0;
    const source = new Readable({ read() { reads++; this.push(null); } });
    await expect(io.checked!.writeTempFrom(temp, source, limits)).rejects.toMatchObject({ code: "EEXIST" });
    expect(reads).toBe(0);
    expect(await fs.readFile(fixture!.file(temp), "utf8")).toBe("foreign");
    expect((await fs.lstat(fixture!.file(temp + ".reservation"))).isDirectory()).toBe(true);
  });

  it.each([{ maxBytes: 2 }, { expectedBytes: 4 }])("drains an upload that violates its declared bound %j and preserves staging", async (override) => {
    const io = await connect();
    const source = Readable.from(["ROM"]);
    await expect(io.checked!.writeTempFrom(temp, source, { ...limits, ...override })).rejects.toMatchObject({ code: override.maxBytes ? "BYTE_LIMIT" : "SIZE_MISMATCH", tempCreated: true });
    expect(source.destroyed).toBe(true);
    expect(client!.closed).toBe(true);
    await fixture!.drained();
    expect(fixture!.activeSockets()).toBe(0);
    expect((await fs.lstat(fixture!.file(temp + ".reservation"))).isDirectory()).toBe(true);
  });

  it("retains a quota-failed partial instead of claiming a complete upload", async () => {
    const io = await connect({ quotaBytes: 2 });
    await expect(io.checked!.writeTempFrom(temp, Readable.from(["ROM"]), limits)).rejects.toMatchObject({ tempCreated: true });
    expect(client!.closed).toBe(true);
    expect((await fs.lstat(fixture!.file(temp))).isFile()).toBe(true);
  });

  it.each(["STOR", "RNTO"] as const)("reports an unknown effect when the %s success reply is lost", async (command) => {
    const io = await connect();
    await io.checked!.writeTempFrom(temp, Readable.from(["ROM"]), limits);
    if (command === "STOR") {
      fixture!.options.dropReply = "STOR";
      await expect(io.checked!.writeTempFrom(temp + "-second", Readable.from(["ROM"]), limits)).rejects.toMatchObject({ code: "EFFECT_UNKNOWN", tempCreated: true });
      expect(await fs.readFile(fixture!.file(temp + "-second"), "utf8")).toBe("ROM");
    } else {
      fixture!.options.dropReply = "RNTO";
      await expect(io.checked!.publish(temp, "/roms/game.nes")).rejects.toMatchObject({ code: "EFFECT_UNKNOWN" });
      expect(await fs.readFile(fixture!.file("/roms/game.nes"), "utf8")).toBe("ROM");
    }
    expect(client!.closed).toBe(true);
    await fixture!.drained();
    await expect(io.lstat("/roms/game.nes")).rejects.toMatchObject({ code: "CONNECTION_CLOSED" });
  });

  it("rejects a known public collision before RNFR and leaves both files intact", async () => {
    const io = await connect();
    await io.checked!.writeTempFrom(temp, Readable.from(["ROM"]), limits);
    await fs.writeFile(fixture!.file("/roms/game.nes"), "foreign");
    await expect(io.checked!.publish(temp, "/roms/game.nes")).rejects.toMatchObject({ code: "EEXIST" });
    expect(await fs.readFile(fixture!.file(temp), "utf8")).toBe("ROM");
    expect(await fs.readFile(fixture!.file("/roms/game.nes"), "utf8")).toBe("foreign");
    expect(fixture!.commands.some((item) => item.command === "RNFR")).toBe(false);
  });

  it("refuses server permission denial without interpreting it as an absent target", async () => {
    const io = await connect();
    fixture!.options.rejectCommand = { command: "MKD", code: 550 };
    let reads = 0;
    const source = new Readable({ read() { reads++; this.push(null); } });
    await expect(io.checked!.writeTempFrom(temp, source, limits)).rejects.toMatchObject({ code: 550 });
    expect(reads).toBe(0);
    await expect(fs.lstat(fixture!.file(temp))).rejects.toMatchObject({ code: "ENOENT" });
    expect(fixture!.commands.some((item) => item.command === "STOR")).toBe(false);
  });

  it("records the explicit RNTO overwrite race without claiming atomic no-replace", async () => {
    const io = await connect();
    await io.checked!.writeTempFrom(temp, Readable.from(["ROM"]), limits);
    fixture!.options.beforeCommand = async (command) => {
      if (command === "RNTO") await fs.writeFile(fixture!.file("/roms/game.nes"), "external writer introduced this after checks");
    };
    await io.checked!.publish(temp, "/roms/game.nes");
    expect(await fs.readFile(fixture!.file("/roms/game.nes"), "utf8")).toBe("ROM");
    expect((await io.capabilities("/roms")).publishNoReplace.state).toBe("unsupported");
  });

  it("rejects overlapping wrapper commands while a real upload is active", async () => {
    const io = await connect();
    const source = new PassThrough();
    const pending = io.checked!.writeTempFrom(temp, source, limits);
    await fixture!.command("STOR");
    await expect(io.runCommand(() => client!.pwd())).rejects.toMatchObject({ code: "FTP_BUSY" });
    source.end("ROM");
    await pending;
    expect(await io.runCommand(() => client!.pwd())).toBe("/");
  });

  it("keeps every strict mutation unsupported on an actual connected client", async () => {
    const io = await connect();
    const before = fixture!.commands.length;
    await expect(io.writeExclusiveTempFrom(temp, Readable.from(["ROM"]), limits)).rejects.toMatchObject({ code: "UNSUPPORTED_CAPABILITY" });
    await expect(io.publishFileNoReplace(temp, "/roms/game.nes")).rejects.toMatchObject({ code: "UNSUPPORTED_CAPABILITY" });
    await expect(io.renameNoReplace(temp, "/roms/game.nes")).rejects.toMatchObject({ code: "UNSUPPORTED_CAPABILITY" });
    await expect(io.flushDirectory("/roms")).rejects.toMatchObject({ code: "UNSUPPORTED_CAPABILITY" });
    expect(fixture!.commands).toHaveLength(before);
  });

  it("rechecks changed source metadata before RNFR while acknowledging the later RNTO race", async () => {
    const io = await connect();
    await fs.writeFile(fixture!.file("/roms/source.nes"), "ROM");
    let listings = 0;
    fixture!.options.beforeCommand = async (command) => {
      if (command === "MLSD" && ++listings === 2) await fs.writeFile(fixture!.file("/roms/source.nes"), "changed source");
    };
    await expect(io.checked!.rename("/roms/source.nes", "/roms/game.nes")).rejects.toMatchObject({ code: "PRECONDITION_CHANGED" });
    expect(fixture!.commands.some((item) => item.command === "RNFR")).toBe(false);
    expect(await fs.readFile(fixture!.file("/roms/source.nes"), "utf8")).toBe("changed source");
  });

  it("creates a receipt directory and refuses empty-only undo in the presence of user content", async () => {
    const io = await connect();
    const receipt = "869a708d-fcbe-4b1f-9a17-f9e3b3e86e04";
    const created = await io.checked!.createDirectory("/roms/new", receipt);
    expect(created.type).toBe("directory");
    expect(created.identity).toBeUndefined();
    await fs.writeFile(fixture!.file("/roms/new/user.nes"), "keep");
    await expect(io.checked!.removeEmptyDirectory("/roms/new", receipt)).rejects.toMatchObject({ code: "ENOTEMPTY" });
    expect(await fs.readFile(fixture!.file("/roms/new/user.nes"), "utf8")).toBe("keep");
    await fs.unlink(fixture!.file("/roms/new/user.nes"));
    await io.checked!.removeEmptyDirectory("/roms/new", receipt);
    await expect(fs.lstat(fixture!.file("/roms/new"))).rejects.toMatchObject({ code: "ENOENT" });
    expect(fixture!.commands.some((item) => item.command === "RMD" && item.argument === "/roms/new")).toBe(true);
  });

  it("rejects foreign receipt content and preexisting directories without cleanup", async () => {
    const io = await connect();
    const receipt = "869a708d-fcbe-4b1f-9a17-f9e3b3e86e04";
    await io.checked!.createDirectory("/roms/new", receipt);
    const marker = fixture!.file(`/roms/new/.ludotek-directory-receipt-${receipt}`);
    await fs.writeFile(marker, "foreign");
    await expect(io.checked!.removeEmptyDirectory("/roms/new", receipt)).rejects.toMatchObject({ code: "IDENTITY_CONFLICT" });
    await expect(io.checked!.createDirectory("/roms/new", receipt)).rejects.toThrow();
    expect(await fs.readFile(marker, "utf8")).toBe("foreign");
    expect(fixture!.commands.some((item) => item.command === "DELE" || item.command === "RMD")).toBe(false);
  });

  it.each(["MKD", "RMD"] as const)("preserves a directory's unknown effect when its %s success reply is lost", async (command) => {
    const io = await connect();
    const receipt = "869a708d-fcbe-4b1f-9a17-f9e3b3e86e04";
    if (command === "MKD") {
      fixture!.options.dropReply = "MKD";
      await expect(io.checked!.createDirectory("/roms/new", receipt)).rejects.toMatchObject({ code: "EFFECT_UNKNOWN" });
      expect((await fs.lstat(fixture!.file("/roms/new"))).isDirectory()).toBe(true);
      expect(await fs.readdir(fixture!.file("/roms/new"))).toEqual([]);
    } else {
      await io.checked!.createDirectory("/roms/new", receipt);
      fixture!.options.dropReply = "RMD";
      await expect(io.checked!.removeEmptyDirectory("/roms/new", receipt)).rejects.toMatchObject({ code: "EFFECT_UNKNOWN" });
      await expect(fs.lstat(fixture!.file("/roms/new"))).rejects.toMatchObject({ code: "ENOENT" });
    }
    expect(client!.closed).toBe(true);
    await fixture!.drained();
  });

  it("lets nonrecursive RMD preserve content introduced after the empty check", async () => {
    const io = await connect();
    const receipt = "869a708d-fcbe-4b1f-9a17-f9e3b3e86e04";
    await io.checked!.createDirectory("/roms/new", receipt);
    fixture!.options.beforeCommand = async (command) => {
      if (command === "RMD") await fs.writeFile(fixture!.file("/roms/new/user.nes"), "keep");
    };
    await expect(io.checked!.removeEmptyDirectory("/roms/new", receipt)).rejects.toMatchObject({ code: 550 });
    expect(await fs.readFile(fixture!.file("/roms/new/user.nes"), "utf8")).toBe("keep");
    expect((await fs.lstat(fixture!.file("/roms/new"))).isDirectory()).toBe(true);
  });

  it("rejects advertised ancestor symlinks, traversal, root escape and control characters before mutation", async () => {
    const io = await connect();
    await fs.symlink(fixture!.file("/roms"), fixture!.file("/roms/link"));
    for (const filename of ["/roms/../outside", "/outside/game.nes", "/roms/a\r\nDELE /roms/game.nes", "/roms/link/game.nes"]) {
      await expect(io.checkPath!(filename, ["/roms"], true)).rejects.toThrow();
    }
    await expect(io.checked!.writeTempFrom("/roms/plain.nes", Readable.from(["ROM"]), limits)).rejects.toMatchObject({ code: "INVALID_PATH" });
    expect(fixture!.commands.some((item) => item.command === "MKD" || item.command === "STOR")).toBe(false);
  });

  it("aborts a live upload and waits for streams and sockets to drain", async () => {
    const io = await connect();
    const source = new PassThrough();
    const controller = new AbortController();
    const pending = io.checked!.writeTempFrom(temp, source, { ...limits, signal: controller.signal });
    const rejected = expect(pending).rejects.toMatchObject({ code: "ABORT_ERR", tempCreated: true });
    await fixture!.command("STOR");
    source.write("partial");
    controller.abort();
    await rejected;
    expect(source.destroyed).toBe(true);
    expect(client!.closed).toBe(true);
    await fixture!.drained();
  });

  it("expires a stalled upload using a fake deadline without wall-clock sleeps", async () => {
    const io = await connect();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const source = new PassThrough();
    const pending = io.checked!.writeTempFrom(temp, source, { ...limits, timeoutMs: 100 });
    const rejected = expect(pending).rejects.toMatchObject({ code: "IO_TIMEOUT", tempCreated: true });
    await fixture!.command("STOR");
    await vi.advanceTimersByTimeAsync(100);
    await rejected;
    expect(source.destroyed).toBe(true);
    expect(client!.closed).toBe(true);
    await fixture!.drained();
  });
});
