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

export interface DeviceConnection {
  listDir(path: string): Promise<DirEntry[]>;
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

  async listDir(path: string): Promise<DirEntry[]> {
    const cmd = `ls -1p "${path}" 2>/dev/null | head -${MAX_ENTRIES}`;
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

    const entries: DirEntry[] = items.slice(0, MAX_ENTRIES).map((item) => ({
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
