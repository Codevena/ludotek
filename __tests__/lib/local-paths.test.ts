import { lstat, mkdtemp, mkdir, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createConnection, type DeviceConnection } from "@/lib/connection";

const config = { protocol: "local" as const, host: "", port: 0, user: "", password: "" };
let sandbox: string;
let root: string;
let outside: string;
let connection: DeviceConnection;

beforeEach(async () => {
  sandbox = await mkdtemp(join(tmpdir(), "ludotek-local-paths-"));
  root = join(sandbox, "roms");
  outside = join(sandbox, "roms-other");
  await mkdir(root);
  await mkdir(outside);
  await writeFile(join(root, "game.nes"), "allowed ROM");
  await writeFile(join(outside, "private.nes"), "outside ROM");
  vi.stubEnv("LOCAL_FILES_ROOT", root);
  vi.stubEnv("LOCAL_FILES_ROOTS", "");
  vi.stubEnv("DATABASE_URL", `file:${join(sandbox, "database", "test.db")}`);
  connection = await createConnection(config);
});

afterEach(async () => {
  connection?.disconnect();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  await rm(sandbox, { recursive: true, force: true });
});

describe("LOCAL configured filesystem roots", () => {
  it("rejects a prefix sibling instead of reading outside the configured root", async () => {
    await expect(connection.readFile(join(outside, "private.nes"))).rejects.toThrow(/outside|allowed/i);
    expect(await readFile(join(outside, "private.nes"), "utf8")).toBe("outside ROM");
  });

  it("fails closed when no local roots are configured", async () => {
    vi.stubEnv("LOCAL_FILES_ROOT", "");
    await expect(createConnection(config)).rejects.toThrow(/configured|configuration/i);
  });

  it("allows read/list/stat and mutations only within a configured root", async () => {
    expect((await connection.readFile(join(root, "game.nes"), 7)).toString()).toBe("allowed");
    expect(await connection.listDir(root)).toEqual([{ name: "game.nes", type: "file" }]);
    expect((await connection.stat(join(root, "game.nes"))).size).toBe(11);
    await connection.mkdir(join(root, "child"));
    await connection.writeFile(join(root, "child", "new.nes"), Buffer.from("new"));
    await connection.rename(join(root, "child", "new.nes"), join(root, "child", "renamed.nes"));
    expect(await readFile(join(root, "child", "renamed.nes"), "utf8")).toBe("new");
    await connection.remove(join(root, "child"));
    await expect(lstat(join(root, "child"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it.each(["list", "detailed", "stat", "mkdir", "write", "remove", "rename-source", "rename-target"])("rejects an outside %s with no fixture mutation", async (operation) => {
    const privateFile = join(outside, "private.nes");
    const allowedFile = join(root, "game.nes");
    const calls: Record<string, () => Promise<unknown>> = {
      list: () => connection.listDir(outside),
      detailed: () => connection.listDirDetailed(outside),
      stat: () => connection.stat(privateFile),
      mkdir: () => connection.mkdir(join(outside, "new")),
      write: () => connection.writeFile(privateFile, Buffer.from("changed")),
      remove: () => connection.remove(privateFile),
      "rename-source": () => connection.rename(privateFile, join(root, "moved.nes")),
      "rename-target": () => connection.rename(allowedFile, join(outside, "moved.nes")),
    };
    await expect(calls[operation]()).rejects.toThrow(/outside|allowed/i);
    expect(await readFile(privateFile, "utf8")).toBe("outside ROM");
    expect(await readFile(allowedFile, "utf8")).toBe("allowed ROM");
    await expect(lstat(join(outside, "new"))).rejects.toMatchObject({ code: "ENOENT" });
    await expect(lstat(join(outside, "moved.nes"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it.each(["remove", "rename-source", "rename-target"])("protects a configured root during %s", async (operation) => {
    const call = operation === "remove" ? connection.remove(root)
      : operation === "rename-source" ? connection.rename(root, join(sandbox, "renamed"))
      : connection.rename(join(root, "game.nes"), root);
    await expect(call).rejects.toThrow(/root/i);
    expect(await readFile(join(root, "game.nes"), "utf8")).toBe("allowed ROM");
  });

  it.each(["relative", "nul\0file", "control\nfile", "control\u009ffile"])("rejects malformed path %j before writing", async (name) => {
    await expect(connection.writeFile(name === "relative" ? name : join(root, name), Buffer.from("bad"))).rejects.toThrow(/invalid|absolute/i);
    expect(await connection.listDir(root)).toHaveLength(1);
  });

  it("rejects symlink sources, directory parents and dangling write links that escape", async () => {
    await symlink(join(outside, "private.nes"), join(root, "escaped.nes"));
    await symlink(outside, join(root, "escaped-dir"));
    await symlink(join(outside, "missing.nes"), join(root, "dangling.nes"));
    await expect(connection.readFile(join(root, "escaped.nes"))).rejects.toThrow(/outside|allowed/i);
    await expect(connection.stat(join(root, "escaped.nes"))).rejects.toThrow(/outside|allowed/i);
    await expect(connection.writeFile(join(root, "escaped-dir", "missing", "new.nes"), Buffer.from("bad"))).rejects.toThrow(/outside|allowed/i);
    await expect(connection.mkdir(join(root, "escaped-dir", "new"))).rejects.toThrow(/outside|allowed/i);
    await expect(connection.writeFile(join(root, "dangling.nes"), Buffer.from("bad"))).rejects.toThrow(/symlink/i);
    await expect(connection.rename(join(root, "game.nes"), join(root, "escaped-dir", "new.nes"))).rejects.toThrow(/outside|allowed/i);
    expect((await connection.listDirDetailed(root)).map((entry) => entry.name)).toEqual(["game.nes"]);
    expect(await readFile(join(outside, "private.nes"), "utf8")).toBe("outside ROM");
    await expect(lstat(join(outside, "missing.nes"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("preserves valid symlink rename/delete semantics without mutating their target", async () => {
    await symlink(join(root, "game.nes"), join(root, "link.nes"));
    await connection.rename(join(root, "link.nes"), join(root, "renamed-link.nes"));
    expect((await lstat(join(root, "renamed-link.nes"))).isSymbolicLink()).toBe(true);
    await connection.remove(join(root, "renamed-link.nes"));
    expect(await readFile(join(root, "game.nes"), "utf8")).toBe("allowed ROM");
  });

  it("offers only configured canonical roots at the virtual root", async () => {
    vi.stubEnv("LOCAL_FILES_ROOT", "");
    vi.stubEnv("LOCAL_FILES_ROOTS", JSON.stringify([root, outside, root]));
    const canonicalRoot = await realpath(root);
    const canonicalOutside = await realpath(outside);
    expect(await connection.listDirDetailed("/")).toEqual([
      { name: canonicalRoot, absolutePath: canonicalRoot, type: "dir", size: 0 },
      { name: canonicalOutside, absolutePath: canonicalOutside, type: "dir", size: 0 },
    ]);
    await expect(connection.listDir("/")).rejects.toThrow(/outside|allowed/i);
    await expect(connection.stat("/")).rejects.toThrow(/outside|allowed/i);
  });

  it.each(["/", "relative", "[]", "{}", "not-json", "[1]", JSON.stringify(Array(33).fill("/"))])("fails closed on invalid root configuration %j", async (value) => {
    vi.stubEnv("LOCAL_FILES_ROOT", value === "/" || value === "relative" ? value : "");
    vi.stubEnv("LOCAL_FILES_ROOTS", value === "/" || value === "relative" ? "" : value);
    await expect(createConnection(config)).rejects.toThrow(/root|configuration|absolute/i);
  });

  it("rejects nonexistent, file and ambiguous configured roots", async () => {
    for (const invalid of [join(sandbox, "missing"), join(root, "game.nes")]) {
      vi.stubEnv("LOCAL_FILES_ROOT", invalid);
      await expect(createConnection(config)).rejects.toThrow(/root|configuration|directory/i);
    }
    vi.stubEnv("LOCAL_FILES_ROOT", root);
    vi.stubEnv("LOCAL_FILES_ROOTS", JSON.stringify([root]));
    await expect(createConnection(config)).rejects.toThrow(/one|configuration/i);
  });

  it("rejects application/data/database roots but permits an application ROM directory", async () => {
    const app = join(sandbox, "app");
    await mkdir(join(app, "roms"), { recursive: true });
    await mkdir(join(app, "data"));
    await mkdir(join(app, "prisma"));
    vi.spyOn(process, "cwd").mockReturnValue(app);
    for (const invalid of [app, sandbox, join(app, "data"), join(app, "prisma"), join(sandbox, "database")]) {
      await mkdir(invalid, { recursive: true });
      vi.stubEnv("LOCAL_FILES_ROOT", invalid);
      await expect(createConnection(config)).rejects.toThrow(/protected/i);
    }
    vi.stubEnv("LOCAL_FILES_ROOT", join(app, "roms"));
    const romConnection = await createConnection(config);
    expect(await romConnection.listDir(join(app, "roms"))).toEqual([]);
  });

  it("accepts a configured symlink alias while returning only canonical child paths", async () => {
    const alias = join(sandbox, "alias");
    await symlink(root, alias);
    vi.stubEnv("LOCAL_FILES_ROOT", alias);
    const canonicalRoot = await realpath(root);
    expect((await connection.readFile(join(alias, "game.nes"))).toString()).toBe("allowed ROM");
    expect((await connection.listDirDetailed(alias))[0].absolutePath).toBe(join(canonicalRoot, "game.nes"));
  });

  it("protects a nested configured root when an ancestor subtree is removed or renamed", async () => {
    const subtree = join(root, "child");
    const nestedRoot = join(subtree, "library");
    await mkdir(nestedRoot, { recursive: true });
    vi.stubEnv("LOCAL_FILES_ROOT", "");
    vi.stubEnv("LOCAL_FILES_ROOTS", JSON.stringify([root, nestedRoot]));
    await expect(connection.remove(subtree)).rejects.toThrow(/root/i);
    await expect(connection.rename(subtree, join(root, "moved"))).rejects.toThrow(/root/i);
    expect((await lstat(nestedRoot)).isDirectory()).toBe(true);
  });

  it("allows app/roms when a configured SQLite file sits directly in the app directory", async () => {
    const app = join(sandbox, "app");
    await mkdir(join(app, "roms"), { recursive: true });
    vi.spyOn(process, "cwd").mockReturnValue(app);
    vi.stubEnv("DATABASE_URL", `file:${join(app, "library.db")}`);
    vi.stubEnv("LOCAL_FILES_ROOT", join(app, "roms"));
    const romConnection = await createConnection(config);
    expect(await romConnection.listDir(join(app, "roms"))).toEqual([]);
  });
});
