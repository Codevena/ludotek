import { EventEmitter } from "node:events";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  ssh: undefined as unknown,
  sftp: { readdir: vi.fn(), stat: vi.fn() },
  ftp: { ftp: { verbose: false }, access: vi.fn(), list: vi.fn(), close: vi.fn() },
  localReaddir: vi.fn(),
}));

vi.mock("ssh2", () => ({ Client: function () { return dependencies.ssh; } }));
vi.mock("basic-ftp", () => ({ Client: function () { return dependencies.ftp; } }));
vi.mock("fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs/promises")>();
  dependencies.localReaddir.mockImplementation(actual.readdir);
  return { ...actual, readdir: dependencies.localReaddir };
});

import { createConnection, type DeviceConnection } from "@/lib/connection";
import { scanSteamDeck } from "@/lib/scanner";

const config = { host: "fixture.invalid", port: 22, user: "fixture", password: "fixture" };
const complete = { requireComplete: true };
const temporaryPaths: string[] = [];

class SshFixture extends EventEmitter {
  connect = vi.fn(() => this.emit("ready"));
  setNoDelay = vi.fn(() => this);
  end = vi.fn();
  sftp = vi.fn((callback) => callback(null, dependencies.sftp));
  exec = vi.fn((_command, callback) => {
    const stream = new EventEmitter() as EventEmitter & { stderr: EventEmitter };
    stream.stderr = new EventEmitter();
    callback(null, stream);
    stream.emit("exit", 0);
    stream.emit("close", 0);
  });
}

function sftpEntries(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    filename: `Game ${index}.nes`,
    longname: "",
    attrs: { mode: 0o100644, size: 0, mtime: 0, isDirectory: () => false },
  }));
}

function ftpEntries(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    name: `Game ${index}.nes`, type: 1, size: 0, isSymbolicLink: false, isDirectory: false,
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  dependencies.ssh = new SshFixture();
  dependencies.ftp.access.mockResolvedValue(undefined);
  dependencies.sftp.stat.mockImplementation((_path, callback) => callback(null, { size: 0, isDirectory: () => true }));
});

afterEach(async () => {
  for (const path of temporaryPaths.splice(0)) await rm(path, { recursive: true, force: true });
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("complete directory listings", () => {
  it.each(["ssh", "ftp"] as const)("keeps browser %s listings at 500 while complete listings return 501", async (protocol) => {
    dependencies.sftp.readdir.mockImplementation((_path, callback) => callback(null, sftpEntries(501)));
    dependencies.ftp.list.mockResolvedValue(ftpEntries(501));
    const connection = await createConnection({ ...config, protocol });
    expect(await connection.listDir("/roms")).toHaveLength(500);
    expect(await connection.listDir("/roms", complete)).toHaveLength(501);
    connection.disconnect();
  });

  it("reads all 501 local files for a scan while keeping the browser limit", async () => {
    const root = await mkdtemp(join(tmpdir(), "ludotek-listing-"));
    temporaryPaths.push(root);
    vi.stubEnv("LOCAL_FILES_ROOT", root);
    vi.stubEnv("LOCAL_FILES_ROOTS", "");
    for (let index = 0; index < 501; index++) await writeFile(join(root, `Game ${index}.nes`), "");
    const connection = await createConnection({ ...config, protocol: "local" });
    expect(await connection.listDir(root)).toHaveLength(500);
    expect(await connection.listDir(root, complete)).toHaveLength(501);
  });

  it.each(["ssh", "ftp", "local"] as const)("rejects oversized %s complete listings rather than silently truncating", async (protocol) => {
    dependencies.sftp.readdir.mockImplementation((_path, callback) => callback(null, sftpEntries(100_001)));
    dependencies.ftp.list.mockResolvedValue(ftpEntries(100_001));
    if (protocol === "local") {
      const root = await mkdtemp(join(tmpdir(), "ludotek-listing-"));
      temporaryPaths.push(root);
      vi.stubEnv("LOCAL_FILES_ROOT", root);
      vi.stubEnv("LOCAL_FILES_ROOTS", "");
      dependencies.localReaddir.mockResolvedValueOnce(Array.from({ length: 100_001 }, (_, index) => ({
        name: `${index}.nes`, isSymbolicLink: () => false, isDirectory: () => false,
      })));
    }
    const connection = await createConnection({ ...config, protocol });
    await expect(connection.listDir(protocol === "local" ? process.env.LOCAL_FILES_ROOT! : "/roms", complete)).rejects.toThrow(/limit|100000|100,000/i);
    if (protocol === "ssh") expect((dependencies.ssh as SshFixture).exec).not.toHaveBeenCalled();
    connection.disconnect();
  });

  it("does not turn a complete SFTP listing failure into an empty SSH fallback", async () => {
    dependencies.sftp.readdir.mockImplementation((_path, callback) => callback(new Error("SFTP unavailable")));
    const connection = await createConnection({ ...config, protocol: "ssh" });
    await expect(connection.listDir("/roms", complete)).rejects.toThrow("SFTP unavailable");
    expect((dependencies.ssh as SshFixture).exec).not.toHaveBeenCalled();
    connection.disconnect();
  });
});

describe("SSH shell path arguments", () => {
  const specialPath = "/roms/O'Brien $HOME `printf substituted`; spaced name";

  function argumentPassedBy(command: string, operation: "remove" | "browse") {
    const prefix = operation === "remove" ? /^rm -rf -- / : /^ls -1p -- /;
    expect(command).toMatch(prefix);
    const printable = command.replace(prefix, "printf '%s' ");
    return execFileSync("/bin/sh", ["-c", printable], { encoding: "utf8" });
  }

  it.each(["remove", "browse"] as const)("preserves apostrophes, dollars, backticks and spaces during %s", async (operation) => {
    const connection = await createConnection({ ...config, protocol: "ssh" });
    if (operation === "browse") {
      dependencies.sftp.readdir.mockImplementation((_path, callback) => callback(new Error("unavailable")));
      await connection.listDir(specialPath);
    } else {
      await connection.remove(specialPath);
    }
    const command = (dependencies.ssh as SshFixture).exec.mock.calls[0][0];
    expect(argumentPassedBy(command, operation)).toBe(specialPath);
    connection.disconnect();
  });

  it.each(["remove", "browse"] as const)("rejects NUL in a %s shell path before exec", async (operation) => {
    const connection: DeviceConnection = await createConnection({ ...config, protocol: "ssh" });
    dependencies.sftp.readdir.mockImplementation((_path, callback) => callback(new Error("unavailable")));
    await expect(operation === "remove" ? connection.remove("/roms/bad\0name") : connection.listDir("/roms/bad\0name")).rejects.toThrow();
    expect((dependencies.ssh as SshFixture).exec).not.toHaveBeenCalled();
    connection.disconnect();
  });
});

describe("legacy Steam Deck scanning", () => {
  it("rejects a failed remote command instead of completing an empty scan", async () => {
    (dependencies.ssh as SshFixture).exec.mockImplementation((_command, callback) => {
      const stream = new EventEmitter() as EventEmitter & { stderr: EventEmitter };
      stream.stderr = new EventEmitter();
      callback(null, stream);
      stream.emit("exit", 1);
      stream.emit("close", 1);
    });
    await expect(scanSteamDeck("fixture.invalid", "fixture", "fixture")).rejects.toThrow();
    expect((dependencies.ssh as SshFixture).end).toHaveBeenCalledTimes(1);
  });

  it("passes the exact legacy platform directory as a single literal shell argument", async () => {
    const directory = "O'Brien $HOME `printf substituted`; spaced name";
    let calls = 0;
    (dependencies.ssh as SshFixture).exec.mockImplementation((_command, callback) => {
      const stream = new EventEmitter() as EventEmitter & { stderr: EventEmitter };
      stream.stderr = new EventEmitter();
      callback(null, stream);
      if (calls++ === 0) stream.emit("data", Buffer.from(directory));
      stream.emit("exit", 0);
      stream.emit("close", 0);
    });
    await scanSteamDeck("fixture.invalid", "fixture", "fixture");
    const command = (dependencies.ssh as SshFixture).exec.mock.calls[1][0];
    // Replace only the listing program with harmless printf; evaluate the
    // production-generated quoting with the same local POSIX shell parser.
    expect(command).toMatch(/^ls -1(?: --)? /);
    const printable = command.replace(/^ls -1(?: --)? /, "printf '%s' ");
    expect(execFileSync("/bin/sh", ["-c", printable], { encoding: "utf8" }))
      .toBe(`/run/media/deck/SD/Emulation/roms/${directory}`);
    expect((dependencies.ssh as SshFixture).end).toHaveBeenCalledTimes(1);
  });
});
