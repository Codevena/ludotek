import { mkdtemp, mkdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({ auth: vi.fn(), device: vi.fn(), readdir: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireAuth: dependencies.auth }));
vi.mock("@/lib/encryption", () => ({ getDecryptedDevice: dependencies.device }));
vi.mock("fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs/promises")>();
  dependencies.readdir.mockImplementation(actual.readdir);
  return { ...actual, readdir: dependencies.readdir };
});

import { GET } from "@/app/api/devices/[id]/browse/route";

let sandbox: string;
let root: string;
let canonicalRoot: string;

async function browse(path: string) {
  return GET(new NextRequest(`http://localhost/api/devices/1/browse?path=${encodeURIComponent(path)}`), { params: Promise.resolve({ id: "1" }) });
}

beforeEach(async () => {
  vi.clearAllMocks();
  dependencies.auth.mockReturnValue(null);
  dependencies.device.mockResolvedValue({ id: 1, protocol: "local", host: "", port: 0, user: "", password: "", ftps: false });
  sandbox = await mkdtemp(join(tmpdir(), "ludotek-local-browse-"));
  root = join(sandbox, "roms");
  await mkdir(join(root, "nes"), { recursive: true });
  await writeFile(join(root, "nes", "game.nes"), "ROM");
  canonicalRoot = await realpath(root);
  vi.stubEnv("LOCAL_FILES_ROOT", root);
  vi.stubEnv("LOCAL_FILES_ROOTS", "");
  vi.stubEnv("DATABASE_URL", `file:${join(sandbox, "database.db")}`);
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(sandbox, { recursive: true, force: true });
});

describe("LOCAL browse route", () => {
  it("returns virtual configured roots without listing the OS root", async () => {
    const response = await browse("/");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ path: "/", parent: null, virtualRoot: true, entries: [{ name: canonicalRoot, type: "dir", size: 0, absolutePath: canonicalRoot }] });
    expect(dependencies.readdir).not.toHaveBeenCalled();
  });

  it("returns canonical paths and takes an allowed root parent back to the virtual root", async () => {
    const alias = join(sandbox, "alias");
    await symlink(root, alias);
    vi.stubEnv("LOCAL_FILES_ROOT", alias);
    const response = await browse(alias);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.path).toBe(canonicalRoot);
    expect(body.parent).toBe("/");
    expect(body.entries).toEqual([expect.objectContaining({ name: "nes", type: "dir", absolutePath: join(canonicalRoot, "nes") })]);
    const child = await browse(join(alias, "nes"));
    expect(await child.json()).toEqual({ path: join(canonicalRoot, "nes"), parent: canonicalRoot, entries: [expect.objectContaining({ name: "game.nes", type: "file", size: 3, absolutePath: join(canonicalRoot, "nes", "game.nes") })] });
  });

  it("rejects outside paths with 403 before directory listing", async () => {
    const response = await browse(sandbox);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Local path is outside the allowed roots" });
    expect(dependencies.readdir).not.toHaveBeenCalled();
  });

  it("returns 503 for missing root configuration", async () => {
    vi.stubEnv("LOCAL_FILES_ROOT", "");
    const response = await browse("/");
    expect(response.status).toBe(503);
    expect(dependencies.readdir).not.toHaveBeenCalled();
  });

  it("returns 400 for control paths before directory listing", async () => {
    const response = await browse(join(root, "bad\nname"));
    expect(response.status).toBe(400);
    expect(dependencies.readdir).not.toHaveBeenCalled();
  });

  it("keeps auth rejection ahead of device lookup and filesystem work", async () => {
    dependencies.auth.mockReturnValue(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
    const response = await browse("/");
    expect(response.status).toBe(401);
    expect(dependencies.device).not.toHaveBeenCalled();
    expect(dependencies.readdir).not.toHaveBeenCalled();
  });
});
