/** Real Linux/OpenSSH acceptance; starts only its own bounded Docker Desktop fixture. */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { chmod, mkdtemp, mkdir, rm, statfs, writeFile } from "node:fs/promises";
import { createConnection as connectTcp } from "node:net";
import os from "node:os";
import path from "node:path";
import { Readable, Writable } from "node:stream";
import { promisify } from "node:util";
import { createConnection, requireFileIo, type DeviceConnection } from "../src/lib/connection";
import type { FileIo } from "../src/lib/file-io";

const execute = promisify(execFile);

async function main() {
  if (process.argv.includes("--help")) {
    console.warn("Usage: node node_modules/tsx/dist/cli.mjs scripts/openssh-smoke.ts <built-image>\nOptional: LUDOTEK_TEST_DOCKER_CONTEXT=desktop-linux, LUDOTEK_OPENSSH_IMAGE=<built-image>.\nBuild separately from a clean context containing Dockerfile.openssh and openssh-entrypoint.sh. This script never builds or deletes its supplied image.");
    return;
  }
  const image = process.argv[2] ?? process.env.LUDOTEK_OPENSSH_IMAGE;
  assert(image && image.length <= 255 && /^[a-zA-Z0-9][a-zA-Z0-9._/:@-]+$/.test(image), "Provide the built OpenSSH smoke image");
  const context = process.env.LUDOTEK_TEST_DOCKER_CONTEXT ?? "desktop-linux";
  assert(context === "desktop-linux" || context === "default", "OpenSSH smoke permits only an explicitly local Docker Desktop context");
  const docker = (args: string[]) => execute("docker", ["--context", context, ...args], { timeout: 60_000, maxBuffer: 1024 * 1024 });
  const endpoint = (await docker(["context", "inspect", context, "--format", "{{.Endpoints.docker.Host}}"])).stdout.trim();
  assert(endpoint.startsWith("unix://"), "Docker Desktop fixture requires a local Unix socket");
  assert((await docker(["info", "--format", "{{.OperatingSystem}}"])).stdout.includes("Docker Desktop"), "Refusing a non-Desktop Docker daemon");
  const imageVolumes = JSON.parse((await docker(["image", "inspect", image, "--format", "{{json .Config.Volumes}}"])).stdout) as Record<string, unknown> | null;
  assert(!imageVolumes || Object.keys(imageVolumes).length === 0, "Fixture image must not declare anonymous volumes");
  const disk = await statfs(os.tmpdir(), { bigint: true });
  assert(disk.bavail * disk.bsize >= BigInt(512 * 1024 * 1024), "Less than512MiB available; refusing the own fixture");

  const directory = await mkdtemp(path.join(os.tmpdir(), "ludotek-openssh-smoke-"));
  const name = `ludotek-openssh-${randomUUID()}`;
  const password = randomBytes(24).toString("hex");
  const remoteRoot = "/fixtures/roms";
  let connection: DeviceConnection | undefined;
  let attempted = false;
  let cleanupFailed = false;
  let stage = "fixture startup";
  let lastCapabilities: unknown;
  try {
    const fixtures = path.join(directory, "fixtures"), passwordFile = path.join(directory, "password");
    for (const relative of ["", "roms", "outside"]) {
      const target = path.join(fixtures, relative); await mkdir(target, { mode: 0o777 }); await chmod(target, 0o777);
    }
    await writeFile(passwordFile, password, { mode: 0o600 });
    attempted = true;
    await docker(["run", "--rm", "--detach", "--name", name, "--memory", "256m", "--cpus", "1", "--pids-limit", "64",
      "--publish", "127.0.0.1::22",
      "--mount", `type=bind,source=${fixtures},target=/fixtures`,
      "--mount", `type=bind,source=${passwordFile},target=/run/secrets/openssh-smoke-password,readonly`, image]);
    const published = (await docker(["port", name, "22/tcp"])).stdout.trim();
    const match = /^127\.0\.0\.1:(\d+)$/.exec(published); assert(match, "OpenSSH port must be published only on127.0.0.1");
    const port = Number(match[1]); assert(Number.isInteger(port) && port >= 1 && port <= 65535);
    await waitForTcp(port);
    stage = "production SSH connect and root validation";
    connection = await createConnection({ protocol: "ssh", host: "127.0.0.1", port, user: "smoke", password });
    const io = requireFileIo(connection);
    const actualCapabilities = io.capabilities.bind(io);
    io.capabilities = async (parent) => {
      const result = await actualCapabilities(parent); lastCapabilities = { parent, ...result }; return result;
    };
    await io.checkPath!(remoteRoot, [remoteRoot]);
    stage = "read-only OpenSSH capabilities";
    const capabilities = await io.capabilities(remoteRoot);
    for (const key of ["exclusiveTemp", "publishNoReplace", "renameNoReplace", "fileFlush", "directoryFlush", "directoryCreate", "directoryRemoveEmpty"] as const) {
      assert.equal(capabilities[key]?.state, "supported", `${key}: ${capabilities[key]?.reason}`);
    }
    assert.equal((await io.freeBytes(remoteRoot)).state, "known", "OpenSSH must return an actual statvfs count");
    assert.match((await io.lstat(remoteRoot)).identity ?? "", /^\d+:\d+$/);

    const bytes = Buffer.concat([Buffer.alloc(65536, 7), Buffer.from("own-synthetic-rom")]);
    const hash = createHash("sha256").update(bytes).digest("hex");
    const limits = { maxBytes: 1024 * 1024, expectedBytes: bytes.length, timeoutMs: 10_000 };
    const temporary = `${remoteRoot}/.exclusive-temp`, target = `${remoteRoot}/published.rom`;
    stage = "missing temp path validation";
    await io.checkPath!(temporary, [remoteRoot], true);
    stage = "exclusive temp streaming";
    assert.deepEqual(await io.writeExclusiveTempFrom(temporary, Readable.from([bytes.subarray(0, 32000), bytes.subarray(32000)]), limits), { bytes: bytes.length });
    const original = await io.lstat(temporary); assert.match(original.identity ?? "", /^\d+:\d+$/);
    stage = "hardlink publication";
    await io.publishFileNoReplace(temporary, target);
    assert.equal((await io.lstat(target)).identity, original.identity);
    await assert.rejects(io.lstat(temporary), { code: "ENOENT" });
    assert.equal(await hashRemote(io, target), hash);

    const collidingSource = `${remoteRoot}/collision-source.rom`, foreign = Buffer.from("own-foreign-collision");
    stage = "no-clobber collision";
    await io.writeExclusiveTempFrom(collidingSource, Readable.from([foreign]), { ...limits, expectedBytes: foreign.length });
    const sourceIdentity = (await io.lstat(collidingSource)).identity;
    await assert.rejects(io.renameNoReplace(collidingSource, target));
    assert.equal((await io.lstat(collidingSource)).identity, sourceIdentity); assert.equal((await io.lstat(target)).identity, original.identity);
    assert.equal(await hashRemote(io, target), hash);
    let consumed = false;
    await assert.rejects(io.writeExclusiveTempFrom(target, new Readable({ read() { consumed = true; this.push("replacement"); this.push(null); } }), limits));
    assert.equal(consumed, false); assert.equal(await hashRemote(io, target), hash);

    // Inject one actual Linux inode replacement after the real target-directory
    // fsync. The transport and every protocol primitive remain production code.
    const replacementSource = `${remoteRoot}/replacement-source.rom`, replacementTarget = `${remoteRoot}/replacement-target.rom`, retained = `${remoteRoot}/retained-original.rom`;
    stage = "native replacement counterexample";
    await io.writeExclusiveTempFrom(replacementSource, Readable.from([bytes]), limits);
    const replacementOriginal = await io.lstat(replacementSource), flush = io.flushDirectory.bind(io);
    let injected = false;
    io.flushDirectory = async (dirname) => {
      await flush(dirname);
      if (!injected) {
        injected = true;
        await docker(["exec", name, "/bin/sh", "-ec", 'mv -- "$1" "$2"; cp -p -- "$2" "$1"', "--", replacementSource, retained]);
        await flush(dirname);
      }
    };
    try { await assert.rejects(io.renameNoReplace(replacementSource, replacementTarget), { code: "IDENTITY_CONFLICT", published: true, sourceRetained: true }); }
    finally { io.flushDirectory = flush; }
    assert.equal(injected, true);
    const replacement = await io.lstat(replacementSource);
    assert.notEqual(replacement.identity, replacementOriginal.identity); assert.equal(replacement.size, replacementOriginal.size); assert.equal(replacement.modifiedAt, replacementOriginal.modifiedAt);
    assert.equal((await io.lstat(replacementTarget)).identity, replacementOriginal.identity); assert.equal((await io.lstat(retained)).identity, replacementOriginal.identity);
    for (const filename of [replacementSource, replacementTarget, retained]) assert.equal(await hashRemote(io, filename), hash);

    stage = "nonrecursive owned directory creation";
    const createdPath = `${remoteRoot}/created`, created = await io.createDirectoryNoReplace!(createdPath);
    assert.equal(created.type, "directory"); assert.match(created.identity ?? "", /^\d+:\d+$/);
    await assert.rejects(io.createDirectoryNoReplace!(createdPath));
    await assert.rejects(io.removeEmptyDirectory!(createdPath, "foreign"), { code: "IDENTITY_CONFLICT" });
    stage = "nonempty and identity-checked directory Undo";
    const child = `${createdPath}/retained.rom`; await io.writeExclusiveTempFrom(child, Readable.from([foreign]), { ...limits, expectedBytes: foreign.length });
    await assert.rejects(io.removeEmptyDirectory!(createdPath, created.identity!)); assert.equal(await hashRemote(io, child), createHash("sha256").update(foreign).digest("hex"));
    assert.equal((await io.lstat(child)).type, "file"); await connection.remove(child);
    await io.removeEmptyDirectory!(createdPath, created.identity!); await assert.rejects(io.lstat(createdPath), { code: "ENOENT" });
    stage = "symlink root escape";
    await docker(["exec", name, "ln", "-s", "/fixtures/outside", `${remoteRoot}/escape`]);
    await assert.rejects(io.checkPath!(`${remoteRoot}/escape/forbidden.rom`, [remoteRoot], true), { code: "PATH_OUTSIDE_ROOT" });
    console.warn("PASS Linux/OpenSSH: negotiated hardlink/fsync, actual READ directory OPEN/FSTAT/fsync, statvfs/dev:ino, bounded write/hash, no-clobber, same-byte/mtime native replacement, owned mkdir/empty-only Undo, root escape rejection.");
  } catch (error) {
    const details: unknown[] = [];
    for (let cause: unknown = error; cause instanceof Error && details.length < 4; cause = cause.cause) {
      const effect = cause as Error & { code?: unknown; tempCreated?: boolean; published?: boolean; sourceRetained?: boolean };
      details.push({ name: effect.name, message: effect.message, code: effect.code, tempCreated: effect.tempCreated, published: effect.published, sourceRetained: effect.sourceRetained });
    }
    console.error(JSON.stringify({ stage, errors: details, lastCapabilities }).replaceAll(password, "[fixture-password]"));
    process.exitCode = 1;
  } finally {
    connection?.disconnect();
    if (attempted) {
      try {
        const exists = await docker(["ps", "--all", "--filter", `name=^/${name}$`, "--format", "{{.Names}}"]);
        if (exists.stdout.trim() === name) {
          await docker(["exec", name, "chmod", "-R", "a+rwX", "/fixtures"]).catch(() => {});
          await docker(["stop", "--time", "3", name]);
        }
        assert.equal((await docker(["ps", "--all", "--filter", `name=^/${name}$`, "--format", "{{.Names}}"])).stdout.trim(), "", "Own --rm container remains after cleanup");
        // No image VOLUME declarations and two explicit binds: this task owns no volumes.
        await docker(["volume", "ls", "--format", "{{.Name}}"]);
      } catch (error) {
        cleanupFailed = true; process.exitCode = 1;
        console.error(`Own OpenSSH fixture cleanup failed for ${name}: ${(error as Error).message.replaceAll(password, "[fixture-password]")}`);
      }
    }
    if (!cleanupFailed) await rm(directory, { recursive: true, force: true });
    else console.error(`Preserved own fixture directory for cleanup: ${directory}`);
  }
}

async function waitForTcp(port: number) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const ready = await new Promise<boolean>((resolve) => {
      const socket = connectTcp({ host: "127.0.0.1", port });
      const finish = (ok: boolean) => { socket.destroy(); resolve(ok); };
      socket.once("connect", () => finish(true)); socket.once("error", () => finish(false)); socket.setTimeout(1000, () => finish(false));
    });
    if (ready) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Own OpenSSH fixture did not become ready within20s");
}
async function hashRemote(io: FileIo, filename: string) {
  const hash = createHash("sha256"), entry = await io.lstat(filename);
  const destination = new Writable({ write(data, _encoding, callback) { hash.update(data); callback(); } });
  await io.readTo(filename, destination, { maxBytes: 1024 * 1024, expectedBytes: entry.size, timeoutMs: 10_000 });
  return hash.digest("hex");
}

void main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "OpenSSH smoke setup failed"); process.exitCode = 1; });
