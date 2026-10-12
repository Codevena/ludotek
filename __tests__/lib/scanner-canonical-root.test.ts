import { mkdtemp, mkdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { expect, it, vi } from "vitest";
import { scanDevice } from "@/lib/scanner";

it("records the canonical LOCAL root selected through an allowed symlink alias", async () => {
  const parent = await mkdtemp(path.join(os.tmpdir(), "ludotek-root-alias-"));
  const directory = path.join(parent, "actual");
  const alias = path.join(parent, "alias");
  await mkdir(path.join(directory, "ps1"), { recursive: true });
  await writeFile(path.join(directory, "ps1", "Toy.chd"), "fixture");
  await symlink(directory, alias);
  vi.stubEnv("LOCAL_FILES_ROOT", alias); vi.stubEnv("LOCAL_FILES_ROOTS", "");
  try {
    const result = await scanDevice({ id: 1, protocol: "local", host: "", port: 0, user: "", password: "", blacklist: [], scanPaths: [{ path: alias, type: "rom" }] });
    const canonical = await realpath(directory);
    expect(result.reliable).toBe(true);
    expect(result.files.find((file) => file.type === "file")).toMatchObject({ path: path.join(canonical, "ps1", "Toy.chd"), scanRoot: canonical, platformAlias: "ps1" });
  } finally { vi.unstubAllEnvs(); await rm(parent, { recursive: true }); }
});
