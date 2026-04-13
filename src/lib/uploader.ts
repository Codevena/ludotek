import fs from "fs";
import { Client, SFTPWrapper } from "ssh2";

const ROM_BASE = "/run/media/deck/SD/Emulation/roms";
const EMU_VIRTUAL_BASE = "/home/deck/EmuVirtual/Emulation/roms";

// Saturn uses direct SD path; all other platforms use EmuVirtual
const DIRECT_SD_PLATFORMS = new Set(["saturn"]);

export interface TransferJob {
  localPath: string;
  remotePath: string;
  onProgress?: (bytesTransferred: number, totalBytes: number) => void;
}

/**
 * Returns the remote path on the Steam Deck for a given platform.
 * Multi-disc files go into a `-multidisc` subdirectory.
 */
export function getTransferPath(
  platform: string,
  isMultiDisc: boolean
): string {
  const suffix = isMultiDisc ? `-multidisc` : "";
  return `${ROM_BASE}/${platform}${suffix}/`;
}

/**
 * Generates M3U playlist content for multi-disc games.
 * Each line is the full path to a disc file on the Steam Deck.
 */
export function generateM3u(
  _title: string,
  platform: string,
  discFilenames: string[]
): string {
  const pathBase = DIRECT_SD_PLATFORMS.has(platform)
    ? `${ROM_BASE}/${platform}-multidisc`
    : `${EMU_VIRTUAL_BASE}/${platform}-multidisc`;

  return discFilenames.map((f) => `${pathBase}/${f}\n`).join("");
}

/**
 * Transfers files to the Steam Deck via SFTP.
 */
export async function transferFiles(
  host: string,
  user: string,
  password: string,
  jobs: TransferJob[]
): Promise<void> {
  const conn = new Client();

  return new Promise((resolve, reject) => {
    conn.on("ready", () => {
      conn.sftp((err, sftp) => {
        if (err) {
          conn.end();
          return reject(err);
        }

        (async () => {
          try {
            // Collect unique directories to create
            const dirSet = new Set(
              jobs.map((j) => {
                const parts = j.remotePath.split("/");
                parts.pop(); // remove filename
                return parts.join("/");
              })
            );
            const dirs = Array.from(dirSet);

            for (let i = 0; i < dirs.length; i++) {
              await mkdirSftp(sftp, dirs[i]);
            }

            for (const job of jobs) {
              await transferOne(sftp, job);
            }

            conn.end();
            resolve();
          } catch (transferErr) {
            conn.end();
            reject(transferErr);
          }
        })();
      });
    });

    conn.on("error", (connErr) => {
      reject(connErr);
    });

    conn.connect({ host, port: 22, username: user, password });
  });
}

/**
 * Writes an M3U playlist file directly to the Steam Deck via SFTP.
 */
export async function transferM3u(
  host: string,
  user: string,
  password: string,
  m3uFilename: string,
  m3uContent: string,
  platform: string
): Promise<void> {
  const conn = new Client();

  return new Promise((resolve, reject) => {
    conn.on("ready", () => {
      conn.sftp((err, sftp) => {
        if (err) {
          conn.end();
          return reject(err);
        }

        const remoteDir = `${ROM_BASE}/${platform}`;
        const remotePath = `${remoteDir}/${m3uFilename}`;

        (async () => {
          try {
            await mkdirSftp(sftp, remoteDir);

            const writeStream = sftp.createWriteStream(remotePath);
            writeStream.end(m3uContent, "utf8", () => {
              conn.end();
              resolve();
            });
            writeStream.on("error", (writeErr: Error) => {
              conn.end();
              reject(writeErr);
            });
          } catch (mkdirErr) {
            conn.end();
            reject(mkdirErr);
          }
        })();
      });
    });

    conn.on("error", (connErr) => {
      reject(connErr);
    });

    conn.connect({ host, port: 22, username: user, password });
  });
}

function mkdirSftp(
  sftp: SFTPWrapper,
  dirPath: string
): Promise<void> {
  return new Promise((resolve) => {
    sftp.mkdir(dirPath, (err: Error | null | undefined) => {
      // Ignore "already exists" errors (SFTP status code 4 / FAILURE)
      if (err && !err.message.includes("already exists") && !err.message.includes("Failure")) {
        console.warn(`Failed to create directory ${dirPath}:`, err.message);
      }
      resolve();
    });
  });
}

function transferOne(
  sftp: SFTPWrapper,
  job: TransferJob
): Promise<void> {
  return new Promise((resolve, reject) => {
    const stat = fs.statSync(job.localPath);
    const totalBytes = stat.size;
    let bytesTransferred = 0;

    const readStream = fs.createReadStream(job.localPath);
    const writeStream = sftp.createWriteStream(job.remotePath);

    readStream.on("data", (chunk: string | Buffer) => {
      bytesTransferred += typeof chunk === "string" ? Buffer.byteLength(chunk) : chunk.length;
      if (job.onProgress) {
        job.onProgress(bytesTransferred, totalBytes);
      }
    });

    writeStream.on("close", () => {
      resolve();
    });

    writeStream.on("error", (err: Error) => {
      reject(err);
    });

    readStream.on("error", (err: Error) => {
      reject(err);
    });

    readStream.pipe(writeStream);
  });
}
