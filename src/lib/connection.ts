import { Client as SshClient } from "ssh2";
import { Client as FtpClient } from "basic-ftp";
import { Readable, Writable } from "stream";

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
  entries: DetailedDirEntry[];
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
  protocol: "ssh" | "ftp" | "local";
  host: string;
  port: number;
  user: string;
  password: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Compute the parent directory, or null for root. */
export function buildBrowseResult(path: string, entries: DetailedDirEntry[]): BrowseResult {
  const normalized = path === "" ? "/" : path;
  let parent: string | null = null;

  if (normalized !== "/") {
    const idx = normalized.lastIndexOf("/");
    parent = idx <= 0 ? "/" : normalized.slice(0, idx);
  }

  return { path: normalized, parent, entries };
}

/** Sort entries: directories first, then alphabetically (case-insensitive). */
function sortEntries<T extends DirEntry>(entries: T[]): T[] {
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
  private sftpSession: import("ssh2").SFTPWrapper | null = null;

  constructor(private conn: SshClient) {}

  private async getSftp(): Promise<import("ssh2").SFTPWrapper> {
    if (this.sftpSession) return this.sftpSession;
    return new Promise((resolve, reject) => {
      this.conn.sftp((err, sftp) => {
        if (err) return reject(err);
        this.sftpSession = sftp;
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
    const items = await new Promise<import("ssh2").FileEntryWithStats[]>(
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

    return sortEntries(entries);
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
      await sshExec(this.conn, `rm -rf -- "${safePath}"`);
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
      let resolved = false;

      function finish() {
        if (resolved) return;
        resolved = true;
        resolve(Buffer.concat(chunks));
      }

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

      stream.on("end", finish);
      stream.on("close", finish);
      stream.on("error", (err: Error) => {
        if (resolved) return;
        resolved = true;
        reject(err);
      });
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

  async listDirDetailed(path: string): Promise<DetailedDirEntry[]> {
    const items = await this.client.list(path);

    const entries: DetailedDirEntry[] = items
      .filter((item) => item.name && item.name !== "." && item.name !== "..")
      .slice(0, MAX_ENTRIES)
      .map((item) => ({
        name: item.name,
        type: (item.isDirectory ? "dir" : "file") as "dir" | "file",
        size: item.size,
        modifiedAt: item.rawModifiedAt
          ? new Date(item.rawModifiedAt).toISOString()
          : undefined,
      }));

    return sortEntries(entries);
  }

  async mkdir(path: string): Promise<void> {
    await this.client.ensureDir(path);
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    await this.client.rename(oldPath, newPath);
  }

  async remove(path: string): Promise<void> {
    try {
      await this.client.remove(path);
    } catch (fileErr) {
      try {
        await this.client.removeDir(path);
      } catch {
        // Directory removal also failed — throw the original file error
        throw fileErr;
      }
    }
  }

  async readFile(path: string, maxBytes?: number): Promise<Buffer> {
    const chunks: Buffer[] = [];
    let totalRead = 0;

    const writable = new Writable({
      write(chunk: Buffer, _encoding, callback) {
        if (maxBytes !== undefined) {
          const remaining = maxBytes - totalRead;
          if (remaining <= 0) {
            callback();
            return;
          }
          const slice = chunk.length > remaining ? chunk.subarray(0, remaining) : chunk;
          chunks.push(slice);
          totalRead += slice.length;
        } else {
          chunks.push(chunk);
        }
        callback();
      },
    });

    await this.client.downloadTo(writable, path);
    return Buffer.concat(chunks);
  }

  async writeFile(remotePath: string, data: Buffer): Promise<void> {
    const readable = Readable.from(data);
    await this.client.uploadFrom(readable, remotePath);
  }

  async stat(path: string): Promise<FileStat> {
    let size = 0;
    let isDirectory = false;
    try {
      size = await this.client.size(path);
    } catch (sizeErr) {
      // size() throws on directories, but also on missing files
      // Verify it's actually a directory by attempting to list it
      try {
        await this.client.list(path);
        isDirectory = true;
      } catch {
        // Neither a file nor a directory — re-throw original error
        throw sizeErr;
      }
    }
    let modifiedAt: string | undefined;
    if (!isDirectory) {
      try {
        const lastMod = await this.client.lastMod(path);
        modifiedAt = lastMod.toISOString();
      } catch {
        // lastMod not supported by all FTP servers
      }
    }
    return { size, modifiedAt, isDirectory };
  }

  disconnect(): void {
    this.client.close();
  }
}

// ---------------------------------------------------------------------------
// Local Connection (filesystem on the server)
// ---------------------------------------------------------------------------

class LocalConnection implements DeviceConnection {
  async listDir(path: string): Promise<DirEntry[]> {
    const fs = await import("fs/promises");
    const items = await fs.readdir(path, { withFileTypes: true });
    const entries: DirEntry[] = items
      .filter((item) => item.name !== "." && item.name !== "..")
      .slice(0, MAX_ENTRIES)
      .map((item) => ({
        name: item.name,
        type: item.isDirectory() ? "dir" as const : "file" as const,
      }));
    return sortEntries(entries);
  }

  async listDirDetailed(path: string): Promise<DetailedDirEntry[]> {
    const fs = await import("fs/promises");
    const nodePath = await import("path");
    const items = await fs.readdir(path, { withFileTypes: true });
    const entries: DetailedDirEntry[] = [];

    for (const item of items.slice(0, MAX_ENTRIES)) {
      if (item.name === "." || item.name === "..") continue;
      let size = 0;
      let modifiedAt: string | undefined;
      try {
        const stats = await fs.stat(nodePath.join(path, item.name));
        size = stats.isDirectory() ? 0 : stats.size;
        modifiedAt = stats.mtime.toISOString();
      } catch {
        // stat can fail for permission-denied items
      }
      entries.push({
        name: item.name,
        type: item.isDirectory() ? "dir" : "file",
        size,
        modifiedAt,
      });
    }

    return sortEntries(entries as unknown as DirEntry[]) as unknown as DetailedDirEntry[];
  }

  async mkdir(path: string): Promise<void> {
    const fs = await import("fs/promises");
    await fs.mkdir(path, { recursive: false });
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    const fs = await import("fs/promises");
    await fs.rename(oldPath, newPath);
  }

  async remove(path: string): Promise<void> {
    const fs = await import("fs/promises");
    await fs.rm(path, { recursive: true, force: true });
  }

  async readFile(path: string, maxBytes?: number): Promise<Buffer> {
    const fs = await import("fs/promises");
    if (maxBytes !== undefined) {
      const fh = await fs.open(path, "r");
      try {
        const buf = Buffer.alloc(maxBytes);
        const { bytesRead } = await fh.read(buf, 0, maxBytes, 0);
        return buf.subarray(0, bytesRead);
      } finally {
        await fh.close();
      }
    }
    return fs.readFile(path);
  }

  async writeFile(remotePath: string, data: Buffer): Promise<void> {
    const fs = await import("fs/promises");
    await fs.writeFile(remotePath, data);
  }

  async stat(path: string): Promise<FileStat> {
    const fs = await import("fs/promises");
    const stats = await fs.stat(path);
    return {
      size: stats.size,
      modifiedAt: stats.mtime.toISOString(),
      isDirectory: stats.isDirectory(),
    };
  }

  disconnect(): void {
    // No-op for local connections
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
  if (config.protocol === "local") {
    return new LocalConnection();
  }
  throw new Error(`Unsupported protocol: ${String(config.protocol)}`);
}
