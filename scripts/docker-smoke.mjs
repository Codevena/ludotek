/** Tests only a disposable container and synthetic, explicitly mounted data. */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { chmod, mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const image = process.argv[2];
assert(image && /^[a-zA-Z0-9][a-zA-Z0-9._/:@-]+$/.test(image), "Provide the built smoke image");
const context = process.env.LUDOTEK_TEST_DOCKER_CONTEXT ?? "default";
const docker = (args) => run("docker", ["--context", context, ...args], { timeout: 90_000, maxBuffer: 1024 * 1024 });
const root = await mkdtemp(path.join(os.tmpdir(), "ludotek-docker-smoke-"));
const name = `ludotek-smoke-${randomUUID()}`;
const token = randomUUID();
let started = false;
try {
  for (const dir of ["db", "data", "fixtures", "fixtures/roms", "fixtures/roms/nes", "fixtures/saves"]) {
    await mkdir(path.join(root, dir), { mode: 0o777 });
    // These freshly created fixture directories must also work for container UID1000.
    await chmod(path.join(root, dir), 0o777);
  }
  await writeFile(path.join(root, "fixtures/roms/nes/Toy.nes"), "synthetic-rom");
  await writeFile(path.join(root, "fixtures/saves/Toy.srm"), "synthetic-save");
  const listener = createServer();
  await new Promise((resolve, reject) => { listener.once("error", reject); listener.listen(0, "127.0.0.1", resolve); });
  const port = listener.address().port;
  await new Promise((resolve, reject) => listener.close((error) => error ? reject(error) : resolve()));
  const origin = `http://127.0.0.1:${port}`;
  // Seed an actual pre-October migrated library using only image SQL and own DB.
  // Node24's built-in SQLite executes each complete migration, preserving SQL
  // strings/triggers; no schema emulation or user database is involved.
  const legacyInit = `
    const { DatabaseSync } = require('node:sqlite');
    const fs = require('node:fs'); const path = require('node:path');
    const { createHash, randomUUID } = require('node:crypto');
    const db = new DatabaseSync('/app/db/ludotek.db');
    db.exec('CREATE TABLE _prisma_migrations (id TEXT PRIMARY KEY, checksum TEXT NOT NULL, finished_at DATETIME, migration_name TEXT NOT NULL, logs TEXT, rolled_back_at DATETIME, started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, applied_steps_count INTEGER NOT NULL DEFAULT 0)');
    for (const name of fs.readdirSync('/app/prisma/migrations').filter(n => /^20/.test(n) && n < '202610').sort()) {
      const sql = fs.readFileSync(path.join('/app/prisma/migrations',name,'migration.sql'),'utf8'); db.exec(sql);
      db.prepare('INSERT INTO _prisma_migrations (id,checksum,finished_at,migration_name,applied_steps_count) VALUES (?,?,CURRENT_TIMESTAMP,?,1)').run(randomUUID(),createHash('sha256').update(sql).digest('hex'),name);
    }
    db.prepare('INSERT INTO Device (name,protocol,host,user,password,updatedAt) VALUES (?,?,?,?,?,CURRENT_TIMESTAMP)').run('Preserved legacy device','local','localhost','','');
    db.close();
  `;
  await docker(["run", "--rm", "--name", `${name}-legacy`, "--memory", "256m", "--cpus", "1", "--pids-limit", "64", "--mount", `type=bind,source=${path.join(root, "db")},target=/app/db`, "--entrypoint", "node", image, "-e", legacyInit]);
  const containerArgs = ["run", "--rm", "--detach", "--name", name, "--memory", "768m", "--cpus", "2", "--pids-limit", "128",
    "--publish", `127.0.0.1:${port}:3000`,
    ...["db", "data", "fixtures"].flatMap((dir) => ["--mount", `type=bind,source=${path.join(root, dir)},target=${dir === "fixtures" ? "/fixtures" : `/app/${dir}`}`]),
    "--env", `ADMIN_TOKEN=${token}`, "--env", `APP_ORIGIN=${origin}`, "--env", `ENCRYPTION_KEY=${"71".repeat(32)}`,
    "--env", "LOCAL_FILES_ROOT=/fixtures", image];
  await docker(containerArgs);
  started = true;
  const headers = { Authorization: `Bearer ${token}`, Origin: origin, "Content-Type": "application/json" };
  async function waitReady() {
    const until = Date.now() + 30_000;
    while (Date.now() < until) {
      try { if ((await fetch(`${origin}/api/devices`, { headers, signal: AbortSignal.timeout(1000) })).ok) return; } catch {}
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    throw new Error("Container did not become ready within30s");
  }
  await waitReady();
  assert.equal((await docker(["exec", name, "id", "-u"])).stdout.trim(), "1000");
  assert.equal((await fetch(`${origin}/logo.png`)).status, 200);
  assert.equal((await fetch(`${origin}/api/devices`)).status, 401);
  assert.equal((await fetch(`${origin}/api/devices`, { method: "POST", headers: { ...headers, Origin: "https://foreign.invalid" }, body: "{}" })).status, 403);
  async function json(url, method = "GET", body) {
    const response = await fetch(`${origin}${url}`, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(30_000) });
    const result = await response.json();
    assert(response.ok, `${url}: ${response.status} ${JSON.stringify(result)}`);
    return result;
  }
  assert((await json("/api/devices")).devices.some((entry) => entry.name === "Preserved legacy device"), "Upgrade lost legacy device");
  const device = await json("/api/devices", "POST", { name: "Own container fixture", protocol: "local" });
  const id = device.id;
  assert(Number.isInteger(id));
  await json(`/api/devices/${id}`, "PUT", { scanPaths: [{ path: "/fixtures/roms", type: "rom" }] });
  await json(`/api/devices/${id}/scan`, "POST");
  let inventory;
  for (let attempt = 0; attempt < 100; attempt++) {
    inventory = await json(`/api/devices/${id}/integrity`);
    if (inventory.inventoryComplete && inventory.totalFiles === 1) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.equal(inventory.totalFiles, 1);
  assert.equal(inventory.inventoryComplete, true);
  const denied = await fetch(`${origin}/api/devices/${id}/browse?path=/app`, { headers });
  assert.equal(denied.status, 403);
  await json(`/api/devices/${id}/profile`, "PUT", { template: "custom", romRoots: [{ path: "/fixtures/roms" }], saveRoots: [{ path: "/fixtures/saves" }], formats: [".nes"], reserveBytes: "0" });
  const backup = await fetch(`${origin}/api/devices/${id}/saves`, { method: "POST", headers, body: JSON.stringify({ filePath: "/fixtures/saves/Toy.srm" }), signal: AbortSignal.timeout(30_000) });
  assert(backup.ok);
  const events = await backup.text();
  assert(events.includes('"type":"done"'), `Save backup did not finish: ${events}`);
  const saves = await json(`/api/saves/versions?deviceId=${id}`);
  assert.equal(saves.versions.length, 1);
  assert.equal(await readFile(path.join(root, "fixtures/saves/Toy.srm"), "utf8"), "synthetic-save");
  assert((await stat(path.join(root, "db/ludotek.db"))).size > 0);
  await docker(["stop", "--time", "3", name]); started = false;
  await docker(containerArgs); started = true;
  await waitReady();
  assert.equal((await json(`/api/saves/versions?deviceId=${id}`)).versions[0].id, saves.versions[0].id);
  const restore = await json(`/api/saves/versions/${saves.versions[0].id}/restore`, "POST", { targetDeviceId: id, targetPath: "/fixtures/saves/Restored.srm" });
  assert.equal(restore.plan.status, "ready");
  assert.equal((await json(`/api/file-plans/${restore.plan.id}/apply`, "POST")).plan.status, "applied");
  // Native Linux keeps the app's private file owned by container UID1000.
  // Read as that same user instead of weakening permissions for the host runner.
  assert.equal((await docker(["exec", name, "node", "-e", "process.stdout.write(require('node:fs').readFileSync('/fixtures/saves/Restored.srm','utf8'))"])).stdout, "synthetic-save");
  assert.equal((await json(`/api/file-plans/${restore.plan.id}/undo`, "POST")).plan.status, "undone");
  await assert.rejects(stat(path.join(root, "fixtures/saves/Restored.srm")), { code: "ENOENT" });
  if (process.env.LUDOTEK_SMOKE_BROWSER_MODULE) {
    const { default: browserCheck } = await import(process.env.LUDOTEK_SMOKE_BROWSER_MODULE);
    await browserCheck({ origin, token, deviceId: id, fixtureRoot: path.join(root, "fixtures") });
  }
  console.log("PASS Docker: UID1000, legacy upgrade, auth/origin, LOCAL root guard, real scan/profile/save backup, persistent restart, restore/apply/undo.");
} catch (error) {
  console.error(error instanceof Error ? error.message.replaceAll(token, "[test-token]") : "Docker smoke failed");
  if (started) {
    try { console.error((await docker(["logs", "--tail", "60", name])).stdout.replaceAll(token, "[test-token]")); } catch {}
  }
  process.exitCode = 1;
} finally {
  if (started) await docker(["stop", "--time", "3", name]);
  // Only our own mkdtemp root is mounted. A disposable cleanup process can
  // remove private UID1000 artifacts even when the host runner has UID1001.
  await docker(["run", "--rm", "--name", `${name}-cleanup`, "--memory", "128m", "--cpus", "1", "--pids-limit", "64", "--user", "0",
    "--mount", `type=bind,source=${root},target=/cleanup`, "--entrypoint", "node", image, "-e",
    "const fs=require('node:fs');for(const dir of ['db','data','fixtures'])fs.rmSync('/cleanup/'+dir,{recursive:true,force:true});"]);
  await rm(root, { recursive: true, force: true });
}
