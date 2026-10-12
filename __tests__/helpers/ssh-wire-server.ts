import { generateKeyPairSync } from "node:crypto";
import * as fs from "node:fs/promises";
import { constants } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Server, type Connection, type Attributes } from "ssh2";

export interface SshWireOptions {
  extensions?: string[];
  failDirectoryFsync?: boolean;
  stallWrite?: boolean;
  nativeRoot?: string;
  nativeStatOutput?: string;
  refuseExec?: boolean;
  canonicalizeMissing?: boolean;
  loseHardlinkReply?: boolean;
  afterFsync?: (filename: string) => Promise<void>;
}
export interface WireEvent { op: string; filename?: string; flags?: number }

function stringPacket(value: string | Buffer) {
  const data = Buffer.isBuffer(value) ? value : Buffer.from(value);
  const result = Buffer.alloc(4 + data.length);
  result.writeUInt32BE(data.length); data.copy(result, 4); return result;
}
function extensionStrings(data: Buffer): Buffer[] {
  const values: Buffer[] = [];
  for (let index = 0; index < data.length;) {
    if (index + 4 > data.length) throw new Error("Malformed extension string");
    const length = data.readUInt32BE(index); index += 4;
    if (index + length > data.length) throw new Error("Malformed extension string");
    values.push(data.subarray(index, index + length)); index += length;
  }
  return values;
}
function shellLiteral(encoded: string): string {
  if (!/^'(?:[^']|'"'"')*'$/.test(encoded)) throw new Error("Only one quoted path is permitted");
  return encoded.slice(1, -1).replace(/'"'"'/g, "'");
}
function attrs(stats: Awaited<ReturnType<typeof fs.lstat>>): Attributes {
  return { mode: Number(stats.mode), uid: Number(stats.uid), gid: Number(stats.gid), size: Number(stats.size), atime: Math.floor(Number(stats.atimeMs) / 1000), mtime: Math.floor(Number(stats.mtimeMs) / 1000) };
}

/** Real ssh2 client/server wire, scoped exclusively to this fixture's temp tree. */
export async function startSshWireServer(options: SshWireOptions = {}) {
  const sandbox = await fs.mkdtemp(path.join(tmpdir(), "ludotek-ssh-wire-"));
  const root = path.join(sandbox, "roms"); await fs.mkdir(root);
  const outside = path.join(sandbox, "outside"); await fs.mkdir(outside);
  const events: WireEvent[] = [];
  const commands: string[] = [];
  const connections = new Set<Connection>();
  const handles = new Map<string, { file: fs.FileHandle; filename: string }>();
  const listed = new Set<string>();
  let nextHandle = 1;
  const key = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey.export({ type: "pkcs1", format: "pem" });
  const allowed = (filename: string) => {
    if (!path.isAbsolute(filename) || !(filename === sandbox || filename.startsWith(`${sandbox}/`))) throw new Error("Fixture path outside sandbox");
    return filename;
  };
  const extensions = options.extensions ?? ["hardlink@openssh.com", "fsync@openssh.com", "statvfs@openssh.com"];
  const server = new Server({ hostKeys: [key] }, (connection) => {
    connections.add(connection); connection.on("close", () => connections.delete(connection)); connection.on("error", () => {});
    connection.on("authentication", (context) => context.accept());
    connection.on("ready", () => connection.on("session", (accept) => {
      const session = accept();
      session.on("exec", (acceptExec, _reject, info) => {
        const channel = acceptExec(); commands.push(info.command);
        void (async () => {
          if (options.refuseExec) throw new Error("Fixture permits SFTP only");
          const statPrefix = "stat -c '%d:%i:%s:%f:%Y' -- ";
          const realPrefix = "realpath -e -- ";
          let value: string;
          if (info.command.startsWith(statPrefix)) {
            const filename = allowed(shellLiteral(info.command.slice(statPrefix.length)));
            const stats = await fs.lstat(filename, { bigint: true });
            value = options.nativeStatOutput ?? `${stats.dev}:${stats.ino}:${stats.size}:${stats.mode.toString(16)}:${stats.mtimeNs / BigInt(1_000_000_000)}\n`;
          } else if (info.command.startsWith(realPrefix)) {
            const filename = allowed(shellLiteral(info.command.slice(realPrefix.length)));
            value = `${options.nativeRoot ? path.join(options.nativeRoot, path.relative(root, filename)) : await fs.realpath(filename)}\n`;
          } else throw new Error("Fixture refuses arbitrary shell execution");
          channel.write(value); channel.exit(0); channel.end();
        })().catch(() => { channel.exit(1); channel.end(); });
      });
      session.on("sftp", (acceptSftp) => {
        const sftp = acceptSftp();
        // ssh2 1.17 server emits an empty VERSION and has no advertisement API.
        // Extend only that outgoing VERSION packet; the real client parses it.
        const internal = sftp as unknown as { _protocol: { channelData(id: number, data: Buffer): void }; outgoing: { id: number } };
        const protocol = internal._protocol, send = protocol.channelData;
        protocol.channelData = function(id, data) {
          if (id === internal.outgoing.id && data.length === 9 && data[4] === 2) {
            const pairs = extensions.flatMap((name) => [stringPacket(name), stringPacket(name === "statvfs@openssh.com" ? "2" : "1")]);
            const expanded = Buffer.concat([data, ...pairs]); expanded.writeUInt32BE(expanded.length - 4);
            return send.call(protocol, id, expanded);
          }
          return send.call(protocol, id, data);
        };
        sftp.on("error", () => {});
        const respond = (request: number, operation: () => Promise<void>) => {
          void operation().catch((error: NodeJS.ErrnoException) => sftp.status(request, error.code === "ENOENT" ? 2 : error.code === "EACCES" ? 3 : 4, error.code ?? error.message));
        };
        const get = (handle: Buffer) => { const entry = handles.get(handle.toString("hex")); if (!entry) throw new Error("Unknown fixture handle"); return entry; };
        sftp.on("OPEN", (request, filename, flags) => respond(request, async () => {
          allowed(filename); events.push({ op: "OPEN", filename, flags });
          const nativeFlags = ((flags & 2) ? constants.O_WRONLY : constants.O_RDONLY) | ((flags & 8) ? constants.O_CREAT : 0) | ((flags & 16) ? constants.O_TRUNC : 0) | ((flags & 32) ? constants.O_EXCL : 0);
          const file = await fs.open(filename, nativeFlags, 0o600);
          const handle = Buffer.alloc(4); handle.writeUInt32BE(nextHandle++);
          handles.set(handle.toString("hex"), { file, filename }); sftp.handle(request, handle);
        }));
        sftp.on("CLOSE", (request, handle) => respond(request, async () => {
          const entry = get(handle); events.push({ op: "CLOSE", filename: entry.filename });
          await entry.file.close(); handles.delete(handle.toString("hex")); sftp.status(request, 0);
        }));
        sftp.on("FSTAT", (request, handle) => respond(request, async () => {
          const entry = get(handle); events.push({ op: "FSTAT", filename: entry.filename }); sftp.attrs(request, attrs(await entry.file.stat()));
        }));
        for (const operation of ["LSTAT", "STAT"] as const) sftp.on(operation, (request: number, filename: string) => respond(request, async () => {
          allowed(filename); events.push({ op: operation, filename }); sftp.attrs(request, attrs(await (operation === "LSTAT" ? fs.lstat(filename) : fs.stat(filename))));
        }));
        sftp.on("REALPATH", (request, filename) => respond(request, async () => {
          allowed(filename); events.push({ op: "REALPATH", filename });
          let resolved: string, metadata: Attributes;
          try { resolved = await fs.realpath(filename); metadata = attrs(await fs.stat(resolved)); }
          catch (error) {
            if (!options.canonicalizeMissing || (error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
            // Actual OpenSSH v3 canonicalizes an absent final entry in REALPATH.
            resolved = path.join(await fs.realpath(path.dirname(filename)), path.basename(filename));
            metadata = { mode: 0, uid: 0, gid: 0, size: 0, atime: 0, mtime: 0 };
          }
          sftp.name(request, [{ filename: resolved, longname: resolved, attrs: metadata }]);
        }));
        sftp.on("OPENDIR", (request, filename) => respond(request, async () => {
          allowed(filename); events.push({ op: "OPENDIR", filename }); const file = await fs.open(filename, "r");
          const handle = Buffer.alloc(4); handle.writeUInt32BE(nextHandle++); handles.set(handle.toString("hex"), { file, filename }); sftp.handle(request, handle);
        }));
        sftp.on("READDIR", (request, handle) => respond(request, async () => {
          const entry = get(handle), key = handle.toString("hex"); events.push({ op: "READDIR", filename: entry.filename });
          if (listed.has(key)) { sftp.status(request, 1); return; } listed.add(key);
          const names = await fs.readdir(entry.filename);
          if (!names.length) { sftp.status(request, 1); return; }
          sftp.name(request, await Promise.all(names.map(async (filename) => ({ filename, longname: filename, attrs: attrs(await fs.lstat(path.join(entry.filename, filename))) }))));
        }));
        sftp.on("READLINK", (request, filename) => respond(request, async () => {
          allowed(filename); const target = await fs.readlink(filename); sftp.name(request, [{ filename: target, longname: target, attrs: attrs(await fs.lstat(filename)) }]);
        }));
        sftp.on("WRITE", (request, handle, offset, data) => respond(request, async () => {
          const entry = get(handle); events.push({ op: "WRITE", filename: entry.filename });
          if (options.stallWrite) return;
          await entry.file.write(data, 0, data.length, offset); sftp.status(request, 0);
        }));
        sftp.on("READ", (request, handle, offset, length) => respond(request, async () => {
          const entry = get(handle); events.push({ op: "READ", filename: entry.filename }); const buffer = Buffer.alloc(length);
          const { bytesRead } = await entry.file.read(buffer, 0, length, offset);
          if (!bytesRead) sftp.status(request, 1); else sftp.data(request, buffer.subarray(0, bytesRead));
        }));
        sftp.on("REMOVE", (request, filename) => respond(request, async () => { allowed(filename); events.push({ op: "REMOVE", filename }); await fs.unlink(filename); sftp.status(request, 0); }));
        sftp.on("MKDIR", (request, filename) => respond(request, async () => { allowed(filename); events.push({ op: "MKDIR", filename }); await fs.mkdir(filename, { recursive: false, mode: 0o700 }); sftp.status(request, 0); }));
        sftp.on("RMDIR", (request, filename) => respond(request, async () => { allowed(filename); events.push({ op: "RMDIR", filename }); await fs.rmdir(filename); sftp.status(request, 0); }));
        sftp.on("EXTENDED", (request, name, data) => respond(request, async () => {
          if (!extensions.includes(name)) { sftp.status(request, 8); return; }
          const values = extensionStrings(data);
          if (name === "hardlink@openssh.com") {
            const source = allowed(values[0].toString()), target = allowed(values[1].toString()); events.push({ op: "HARDLINK", filename: target });
            await fs.link(source, target);
            if (options.loseHardlinkReply) { connection.end(); return; }
            sftp.status(request, 0);
          } else if (name === "fsync@openssh.com") {
            const entry = get(values[0]); events.push({ op: "FSYNC", filename: entry.filename });
            if (options.failDirectoryFsync && (await entry.file.stat()).isDirectory()) throw new Error("Directory fsync unavailable");
            await entry.file.sync(); await options.afterFsync?.(entry.filename); sftp.status(request, 0);
          } else if (name === "statvfs@openssh.com") {
            const filename = allowed(values[0].toString()); const stats = await fs.statfs(filename, { bigint: true });
            events.push({ op: "STATVFS", filename }); const packet = Buffer.alloc(9 + 11 * 8);
            packet.writeUInt32BE(packet.length - 4); packet[4] = 201; packet.writeUInt32BE(request, 5);
            [stats.bsize, stats.bsize, stats.blocks, stats.bfree, stats.bavail, stats.files, stats.ffree, stats.ffree, BigInt(0), BigInt(0), BigInt(255)].forEach((value, index) => packet.writeBigUInt64BE(value, 9 + index * 8));
            send.call(protocol, internal.outgoing.id, packet);
          } else sftp.status(request, 8);
        }));
      });
    }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  return {
    sandbox, root, outside, events, commands, options,
    config: { protocol: "ssh" as const, host: "127.0.0.1", port, user: "fixture", password: "fixture" },
    activeConnections: () => connections.size,
    async close() {
      for (const connection of connections) connection.end();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      for (const entry of handles.values()) await entry.file.close().catch(() => {});
      handles.clear(); await fs.rm(sandbox, { recursive: true, force: true });
    },
  };
}
