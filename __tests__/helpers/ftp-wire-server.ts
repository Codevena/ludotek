import net, { type Socket } from "node:net";
import tls from "node:tls";
import { EventEmitter, once } from "node:events";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as fs from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";

const execute = promisify(execFile);
export interface FtpWireOptions {
  tls?: boolean;
  uniqueFacts?: boolean;
  /** Wire faults after the actual effect. Lost replies never mean no effect. */
  dropReply?: "STOR" | "RNTO" | "MKD" | "RMD";
  quotaBytes?: number;
  rejectCommand?: { command: string; argument?: string; code: number };
  beforeCommand?: (command: string, argument: string) => void | Promise<void>;
}

/** Owned loopback daemon; production basic-ftp speaks real control/data TCP/TLS. */
export async function ftpWireServer(options: FtpWireOptions = {}) {
  const sandbox = await fs.mkdtemp(path.join(tmpdir(), "ludotek-ftp-wire-"));
  const root = path.join(sandbox, "files");
  await fs.mkdir(root);
  await fs.mkdir(path.join(root, "roms"));
  let certificates: { key: Buffer; cert: Buffer; ca: Buffer } | undefined;
  if (options.tls) {
    await execute("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", "ca.key", "-out", "ca.crt", "-days", "1", "-subj", "/CN=Ludotek owned test CA"], { cwd: sandbox });
    await execute("openssl", ["req", "-new", "-newkey", "rsa:2048", "-nodes", "-keyout", "server.key", "-out", "server.csr", "-subj", "/CN=127.0.0.1"], { cwd: sandbox });
    await fs.writeFile(path.join(sandbox, "extensions.cnf"), "subjectAltName=IP:127.0.0.1\nbasicConstraints=CA:FALSE\nextendedKeyUsage=serverAuth\n");
    await execute("openssl", ["x509", "-req", "-in", "server.csr", "-CA", "ca.crt", "-CAkey", "ca.key", "-CAcreateserial", "-out", "server.crt", "-days", "1", "-extfile", "extensions.cnf"], { cwd: sandbox });
    certificates = { key: await fs.readFile(path.join(sandbox, "server.key")), cert: await fs.readFile(path.join(sandbox, "server.crt")), ca: await fs.readFile(path.join(sandbox, "ca.crt")) };
  }
  const sockets = new Set<Socket>();
  const passive = new Set<net.Server>();
  const tasks = new Set<Promise<unknown>>();
  const events = new EventEmitter();
  const commands: { command: string; argument: string }[] = [];
  const ownSocket = (socket: Socket) => {
    sockets.add(socket);
    socket.on("error", () => {});
    socket.once("close", () => { sockets.delete(socket); events.emit("closed"); });
    return socket;
  };
  const diskPath = (argument: string, cwd = "/") => {
    const relative = path.posix.resolve(cwd, argument || ".");
    return path.join(root, relative.slice(1));
  };
  const dateFact = (date: Date) => date.toISOString().replace(/[-:TZ]/g, "");
  const server = net.createServer((raw) => {
    let control: Socket = ownSocket(raw);
    let cwd = "/";
    let renameFrom: string | undefined;
    let protectedData = false;
    let dataServer: net.Server | undefined;
    let data: Promise<Socket> | undefined;
    let dataSocket: Socket | undefined;
    let input = "";
    let queue = Promise.resolve();
    const reply = (message: string) => { if (!control.destroyed) control.write(message + "\r\n"); };
    const finish = (command: string, message: string) => {
      events.emit("effect", command);
      if (options.dropReply === command) control.destroy();
      else reply(message);
    };
    const closePassive = () => {
      dataServer?.close();
      if (dataServer) passive.delete(dataServer);
      dataServer = undefined;
    };
    control.once("close", () => { dataSocket?.destroy(); closePassive(); });
    const transfer = async (command: string, operation: (socket: Socket) => Promise<void>) => {
      if (!data) { reply("425 Use EPSV first"); return; }
      reply("150 Opening data connection");
      const socket = await data;
      data = undefined;
      closePassive();
      try {
        await operation(socket);
        finish(command, "226 Transfer complete");
      } catch {
        socket.destroy();
        reply(command === "STOR" && options.quotaBytes !== undefined ? "552 Quota exceeded" : "426 Data connection closed");
      }
    };
    const dispatch = async (command: string, argument: string) => {
      commands.push({ command, argument });
      events.emit("command", command, argument);
      await options.beforeCommand?.(command, argument);
      if (options.rejectCommand?.command === command && (options.rejectCommand.argument === undefined || options.rejectCommand.argument === argument)) {
        reply(`${options.rejectCommand.code} Request refused by fixture policy`);
        return;
      }
      const target = diskPath(argument, cwd);
      try {
        switch (command) {
          case "USER": reply("331 Password required"); break;
          case "PASS": reply("230 Logged in"); break;
          case "FEAT": reply("211-Features\r\n MLST type*;size*;modify*;unique*;\r\n UTF8\r\n AUTH TLS\r\n EPSV\r\n211 End"); break;
          case "AUTH": {
            if (!certificates || argument !== "TLS") { reply("502 TLS unavailable"); break; }
            reply("234 Ready for TLS");
            control.removeListener("data", receive);
            control = ownSocket(new tls.TLSSocket(raw, { isServer: true, secureContext: tls.createSecureContext(certificates) }));
            control.on("data", receive);
            control.once("close", () => { dataSocket?.destroy(); closePassive(); });
            break;
          }
          case "PBSZ": reply("200 Buffer accepted"); break;
          case "PROT": protectedData = argument === "P"; reply("200 Protection accepted"); break;
          case "TYPE": case "STRU": case "OPTS": case "NOOP": reply("200 OK"); break;
          case "PWD": reply(`257 "${cwd}"`); break;
          case "CWD": {
            if (!(await fs.stat(target)).isDirectory()) throw new Error("Not a directory");
            cwd = path.posix.resolve(cwd, argument); reply("250 Directory changed"); break;
          }
          case "EPSV": {
            closePassive();
            data = new Promise<Socket>((resolve) => {
              const connected = (socket: Socket) => { dataSocket = ownSocket(socket); resolve(socket); };
              dataServer = protectedData && certificates ? tls.createServer(certificates, connected) : net.createServer(connected);
              dataServer.on("error", () => {});
              passive.add(dataServer);
            });
            dataServer!.listen(0, "127.0.0.1");
            await once(dataServer!, "listening");
            reply(`229 Extended passive mode (|||${(dataServer!.address() as net.AddressInfo).port}|)`);
            break;
          }
          case "MLSD": {
            const entries = await fs.readdir(target);
            const lines = await Promise.all(entries.map(async (name) => {
              const stat = await fs.lstat(path.join(target, name));
              const type = stat.isSymbolicLink() ? "OS.unix=symlink" : stat.isDirectory() ? "dir" : "file";
              return `type=${type};size=${stat.size};modify=${dateFact(stat.mtime)};${options.uniqueFacts === false ? "" : `unique=${stat.dev}-${stat.ino};`} ${name}\r\n`;
            }));
            await transfer(command, async (socket) => {
              await new Promise<void>((resolve, reject) => { socket.once("error", reject); socket.end(lines.join(""), resolve); });
            });
            break;
          }
          case "SIZE": {
            const stat = await fs.stat(target);
            if (!stat.isFile()) throw new Error("Not a regular file");
            reply(`213 ${stat.size}`); break;
          }
          case "MDTM": reply(`213 ${dateFact((await fs.stat(target)).mtime)}`); break;
          case "RETR": {
            if (!(await fs.stat(target)).isFile()) throw new Error("Not a file");
            await transfer(command, async (socket) => { await pipeline(createReadStream(target), socket); }); break;
          }
          case "STOR": {
            await transfer(command, async (socket) => {
              const destination = createWriteStream(target);
              let bytes = 0;
              socket.on("data", (chunk: Buffer) => {
                bytes += chunk.length;
                if (options.quotaBytes !== undefined && bytes > options.quotaBytes) destination.destroy(new Error("Quota exceeded"));
              });
              await pipeline(socket, destination);
            }); break;
          }
          case "RNFR": await fs.lstat(target); renameFrom = target; reply("350 Ready for target"); break;
          case "RNTO": {
            if (!renameFrom) { reply("503 RNFR required"); break; }
            await fs.rename(renameFrom, target); renameFrom = undefined; finish(command, "250 Rename complete"); break;
          }
          case "MKD": await fs.mkdir(target); finish(command, `257 "${argument}" created`); break;
          case "RMD": await fs.rmdir(target); finish(command, "250 Directory removed"); break;
          case "DELE": await fs.unlink(target); finish(command, "250 File deleted"); break;
          case "QUIT": reply("221 Goodbye"); control.end(); break;
          default: reply("502 Command unsupported");
        }
      } catch { reply("550 Path unavailable"); }
    };
    const receive = (chunk: Buffer) => {
      input += chunk.toString("utf8");
      while (input.includes("\r\n")) {
        const end = input.indexOf("\r\n");
        const line = input.slice(0, end); input = input.slice(end + 2);
        const split = line.indexOf(" ");
        const command = (split < 0 ? line : line.slice(0, split)).toUpperCase();
        const argument = split < 0 ? "" : line.slice(split + 1);
        const task = queue.then(() => dispatch(command, argument));
        tasks.add(task);
        task.finally(() => tasks.delete(task)).catch(() => {});
        queue = task.catch(() => { control.destroy(); });
      }
    };
    control.on("data", receive);
    reply("220 Ludotek owned loopback fixture");
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return {
    sandbox, root, options, commands, ca: certificates?.ca,
    port: (server.address() as net.AddressInfo).port,
    activeSockets: () => sockets.size,
    file: (filename: string) => diskPath(filename),
    async command(command: string, predicate: (argument: string) => boolean = () => true) {
      if (commands.some((item) => item.command === command && predicate(item.argument))) return;
      await new Promise<void>((resolve) => {
        const observed = (actual: string, argument: string) => {
          if (actual === command && predicate(argument)) { events.removeListener("command", observed); resolve(); }
        };
        events.on("command", observed);
      });
    },
    async drained() {
      while (sockets.size) await once(events, "closed");
      await Promise.allSettled([...tasks]);
    },
    async close() {
      for (const socket of sockets) socket.destroy();
      for (const listener of passive) listener.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await Promise.allSettled([...tasks]);
      await fs.rm(sandbox, { recursive: true, force: true });
    },
  };
}

export type FtpWireServer = Awaited<ReturnType<typeof ftpWireServer>>;
