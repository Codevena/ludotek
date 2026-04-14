import { Client as SshClient } from "ssh2";
import { Client as FtpClient } from "basic-ftp";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const CONNECTION_TIMEOUT = 10_000;
const SSH_COMMAND_TIMEOUT = 15_000;
const MAX_ENTRIES = 500;

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------
export interface DirEntry {
  name: string;
  type: "dir" | "file";
}

export interface BrowseResult {
  path: string;
  parent: string | null;
  entries: DirEntry[];
}

export interface DetailedDirEntry {
  name: string;
  type: "dir" | "file";
  size: number;
  modifiedAt?: string;
}

export interface FileStat {
  size: number;
  modifiedAt?: string;
  isDirectory: boolean;
}

export interface DeviceConnection {
  listDir(path: string): Promise<DirEntry[]>;
  listDirDetailed(path: string): Promise<DetailedDirEntry[]>;
  mkdir(path: string): Promise<void>;
  rename(oldPath: string, newPath: string): Promise<void>;
  remove(path: string): Promise<void>;
  readFile(path: string, maxBytes?: number): Promise<Buffer>;
  writeFile(remotePath: string, data: Buffer): Promise<void>;
  stat(path: string): Promise<FileStat>;
  disconnect(): void;
}

export interface ConnectionConfig {
  protocol: "ssh" | "ftp";
  host: string;
  port: number;
  user: string;
  password: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Compute the parent directory, or null for root. */
export function buildBrowseResult(path: string, entries: DirEntry[]): BrowseResult {
  const normalized = path === "" ? "/" : path;
  let parent: string | null = null;

  if (normalized !== "/") {
    const idx = normalized.lastIndexOf("/");
    parent = idx <= 0 ? "/" : normalized.slice(0, idx);
  }

  return { path: normalized, parent, entries };
}

/** Sort entries: directories first, then alphabetically (case-insensitive). */
function sortEntries(entries: DirEntry[]): DirEntry[] {
  return entries.sort((a, b) => {
    if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}

// ---------------------------------------------------------------------------
// SSH helpers
// ---------------------------------------------------------------------------

/** Execute a command over an SSH connection and collect stdout. */
export function sshExec(conn: SshClient, command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`SSH command timed out after ${SSH_COMMAND_TIMEOUT}ms`));
    }, SSH_COMMAND_TIMEOUT);

    conn.exec(command, (err, stream) => {
      if (err) {
        clearTimeout(timer);
        return reject(err);
      }

      let stdout = "";
      let stderr = "";

      stream.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      stream.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      stream.on("close", () => {
        clearTimeout(timer);
        if (stderr) {
          console.warn(`[ssh stderr] ${stderr.trim()}`);
        }
        resolve(stdout);
      });
    });
  });
}

// ---------------------------------------------------------------------------
// SSH Connection
// ---------------------------------------------------------------------------

class SshConnection implements DeviceConnection {
  constructor(private conn: SshClient) {}

  private getSftp(): Promise<import("ssh2").SFTPWrapper> {
    return new Promise((resolve, reject) => {
      this.conn.sftp((err, sftp) => {
        if (err) return reject(err);
        resolve(sftp);
      });
    });
  }

  async listDir(path: string): Promise<DirEntry[]> {
    // Sanitize path to prevent shell injection
    const safePath = path.replace(/[`$\\;"'|&<>(){}!\n\r]/g, "");
    const cmd = `ls -1p -- "${safePath}" 2>/dev/null | head -${MAX_ENTRIES}`;
    const output = await sshExec(this.conn, cmd);

    const entries: DirEntry[] = output
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line): DirEntry => {
        if (line.endsWith("/")) {
          return { name: line.slice(0, -1), type: "dir" };
        }
        return { name: line, type: "file" };
      });

    return sortEntries(entries);
  }

  async listDirDetailed(path: string): Promise<DetailedDirEntry[]> {
    const sftp = await this.getSftp();
    const items = await new Promise<import("ssh2").FileEntry[]>(
      (resolve, reject) => {
        sftp.readdir(path, (err, list) => {
          if (err) return reject(err);
          resolve(list);
        });
      },
    );

    const entries: DetailedDirEntry[] = items
      .filter((item) => item.filename !== "." && item.filename !== "..")
      .slice(0, MAX_ENTRIES)
      .map((item) => ({
        name: item.filename,
        type: (item.attrs.isDirectory() ? "dir" : "file") as "dir" | "file",
        size: item.attrs.size,
        modifiedAt: item.attrs.mtime
          ? new Date(item.attrs.mtime * 1000).toISOString()
          : undefined,
      }));

    return sortEntries(entries as unknown as DirEntry[]) as unknown as DetailedDirEntry[];
  }

  async mkdir(path: string): Promise<void> {
    const sftp = await this.getSftp();
    return new Promise((resolve, reject) => {
      sftp.mkdir(path, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    const sftp = await this.getSftp();
    return new Promise((resolve, reject) => {
      sftp.rename(oldPath, newPath, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  async remove(path: string): Promise<void> {
    const info = await this.stat(path);
    if (info.isDirectory) {
      const safePath = path.replace(/[`$\\;"'|&<>(){}!\n\r]/g, "");
      await sshExec(this.conn, `rm -rf "${safePath}"`);
    } else {
      const sftp = await this.getSftp();
      return new Promise((resolve, reject) => {
        sftp.unlink(path, (err) => {
          if (err) return reject(err);
          resolve();
        });
      });
    }
  }

  async readFile(path: string, maxBytes?: number): Promise<Buffer> {
    const sftp = await this.getSftp();
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let totalRead = 0;

      const stream = sftp.createReadStream(path);

      stream.on("data", (chunk: Buffer) => {
        if (maxBytes !== undefined) {
          const remaining = maxBytes - totalRead;
          if (remaining <= 0) {
            stream.destroy();
            return;
          }
          const slice = chunk.length > remaining ? chunk.subarray(0, remaining) : chunk;
          chunks.push(slice);
          totalRead += slice.length;
          if (totalRead >= maxBytes) {
            stream.destroy();
          }
        } else {
          chunks.push(chunk);
        }
      });

      stream.on("end", () => resolve(Buffer.concat(chunks)));
      stream.on("close", () => resolve(Buffer.concat(chunks)));
      stream.on("error", reject);
    });
  }

  async writeFile(remotePath: string, data: Buffer): Promise<void> {
    const sftp = await this.getSftp();
    return new Promise((resolve, reject) => {
      const stream = sftp.createWriteStream(remotePath);
      stream.on("error", reject);
      stream.on("close", () => resolve());
      stream.end(data);
    });
  }

  async stat(path: string): Promise<FileStat> {
    const sftp = await this.getSftp();
    return new Promise((resolve, reject) => {
      sftp.stat(path, (err, stats) => {
        if (err) return reject(err);
        resolve({
          size: stats.size,
          modifiedAt: stats.mtime
            ? new Date(stats.mtime * 1000).toISOString()
            : undefined,
          isDirectory: stats.isDirectory(),
        });
      });
    });
  }

  disconnect(): void {
    this.conn.end();
  }
}

// ---------------------------------------------------------------------------
// FTP Connection
// ---------------------------------------------------------------------------

class FtpConnection implements DeviceConnection {
  constructor(private client: FtpClient) {}

  async listDir(path: string): Promise<DirEntry[]> {
    const items = await this.client.list(path);

    const entries: DirEntry[] = items
      .filter((item) => item.name && item.name !== "." && item.name !== "..")
      .slice(0, MAX_ENTRIES)
      .map((item) => ({
        name: item.name,
        type: item.isDirectory ? "dir" : "file",
      }));

    return sortEntries(entries);
  }

  disconnect(): void {
    this.client.close();
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

function connectSsh(config: ConnectionConfig): Promise<DeviceConnection> {
  return new Promise((resolve, reject) => {
    const conn = new SshClient();

    const timer = setTimeout(() => {
      conn.end();
      reject(new Error(`SSH connection timed out after ${CONNECTION_TIMEOUT}ms`));
    }, CONNECTION_TIMEOUT);

    conn.on("ready", () => {
      clearTimeout(timer);
      resolve(new SshConnection(conn));
    });

    conn.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    conn.connect({
      host: config.host,
      port: config.port,
      username: config.user,
      password: config.password,
      readyTimeout: CONNECTION_TIMEOUT,
    });
  });
}

async function connectFtp(config: ConnectionConfig): Promise<DeviceConnection> {
  const client = new FtpClient(CONNECTION_TIMEOUT);
  client.ftp.verbose = false;

  await client.access({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    secure: false,
  });

  return new FtpConnection(client);
}

/** Create a DeviceConnection based on the protocol in config. */
export async function createConnection(
  config: ConnectionConfig,
): Promise<DeviceConnection> {
  if (config.protocol === "ssh") {
    return connectSsh(config);
  }
  if (config.protocol === "ftp") {
    return connectFtp(config);
  }
  throw new Error(`Unsupported protocol: ${String(config.protocol)}`);
}
