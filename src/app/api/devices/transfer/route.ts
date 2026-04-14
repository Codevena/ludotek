import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createConnection } from "@/lib/connection";
import type { ConnectionConfig, DeviceConnection } from "@/lib/connection";
import { validateRemotePath } from "@/lib/path-validation";
import {
  clearTransferProgress,
  getTransferProgress,
  setTransferProgress,
} from "@/lib/transfer-progress";

const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2 GB
const FILE_TIMEOUT = 10 * 60 * 1000; // 10 minutes

function configFromDevice(device: {
  protocol: string;
  host: string;
  port: number;
  user: string;
  password: string;
}): ConnectionConfig {
  return {
    protocol: device.protocol as "ssh" | "ftp",
    host: device.host,
    port: device.port,
    user: device.user,
    password: device.password,
  };
}

async function runTransfer(
  sourceConn: DeviceConnection,
  targetConn: DeviceConnection,
  files: string[],
  targetPath: string,
  mode: "copy" | "move",
): Promise<void> {
  for (let i = 0; i < files.length; i++) {
    const filePath = files[i];
    const fileName = filePath.split("/").pop() ?? filePath;
    setTransferProgress({
      currentFile: fileName,
      progress: 0,
      completedFiles: i,
    });

    try {
      const stats = await sourceConn.stat(filePath);
      if (stats.isDirectory) {
        setTransferProgress({
          error: `${fileName} is a directory — only files can be transferred`,
          transferring: false,
        });
        return;
      }
      if (stats.size > MAX_FILE_SIZE) {
        setTransferProgress({
          error: `${fileName} exceeds 2 GB limit`,
          transferring: false,
        });
        return;
      }

      // Read with timeout
      let readTimer: NodeJS.Timeout;
      const data = await Promise.race([
        sourceConn.readFile(filePath).finally(() => clearTimeout(readTimer)),
        new Promise<never>((_, reject) => {
          readTimer = setTimeout(
            () => reject(new Error(`Timeout reading ${fileName}`)),
            FILE_TIMEOUT,
          );
        }),
      ]);

      setTransferProgress({ progress: 50 });

      const destPath =
        targetPath.endsWith("/")
          ? `${targetPath}${fileName}`
          : `${targetPath}/${fileName}`;

      // Write with timeout
      let writeTimer: NodeJS.Timeout;
      await Promise.race([
        targetConn.writeFile(destPath, data).finally(() => clearTimeout(writeTimer)),
        new Promise<never>((_, reject) => {
          writeTimer = setTimeout(
            () => reject(new Error(`Timeout writing ${fileName}`)),
            FILE_TIMEOUT,
          );
        }),
      ]);

      setTransferProgress({ progress: 100, completedFiles: i + 1 });

      if (mode === "move") {
        await sourceConn.remove(filePath);
      }
    } catch (err) {
      setTransferProgress({
        error: `${fileName}: ${err instanceof Error ? err.message : "transfer failed"}`,
        transferring: false,
      });
      return;
    }
  }

  setTransferProgress({ transferring: false, progress: 100 });
}

export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const current = getTransferProgress();
  if (current.transferring) {
    return NextResponse.json(
      { error: "A transfer is already in progress" },
      { status: 409 },
    );
  }

  // Lock immediately to prevent TOCTOU race — before parsing body
  setTransferProgress({
    transferring: true,
    totalFiles: 0,
    completedFiles: 0,
    mode: "copy",
    currentFile: "",
    progress: 0,
    error: undefined,
  });

  const body = await request.json().catch(() => null);
  if (
    !body?.sourceDeviceId ||
    !body?.targetDeviceId ||
    !body?.targetPath ||
    !Array.isArray(body?.files) ||
    body.files.length === 0
  ) {
    clearTransferProgress();
    return NextResponse.json(
      {
        error:
          "sourceDeviceId, targetDeviceId, targetPath, and files[] are required",
      },
      { status: 400 },
    );
  }

  if (!Number.isInteger(body.sourceDeviceId) || body.sourceDeviceId <= 0 ||
      !Number.isInteger(body.targetDeviceId) || body.targetDeviceId <= 0) {
    clearTransferProgress();
    return NextResponse.json(
      { error: "sourceDeviceId and targetDeviceId must be positive integers" },
      { status: 400 },
    );
  }

  const mode: "copy" | "move" =
    body.mode === "move" ? "move" : "copy";

  // Prevent self-move (same device, target dir contains source file)
  if (mode === "move" && body.sourceDeviceId === body.targetDeviceId) {
    const targetDir = body.targetPath.endsWith("/")
      ? body.targetPath
      : body.targetPath + "/";
    for (const f of body.files) {
      const fileName = f.split("/").pop() ?? f;
      const destPath = targetDir + fileName;
      if (f === destPath) {
        clearTransferProgress();
        return NextResponse.json(
          { error: `Cannot move ${fileName} to the same location` },
          { status: 400 },
        );
      }
    }
  }

  // Update lock with actual transfer details
  setTransferProgress({
    totalFiles: body.files.length,
    mode,
  });
  for (const f of body.files) {
    const pathError = validateRemotePath(f);
    if (pathError) {
      clearTransferProgress();
      return pathError;
    }
  }
  const targetPathError = validateRemotePath(body.targetPath, true);
  if (targetPathError) {
    clearTransferProgress();
    return targetPathError;
  }

  const [sourceDevice, targetDevice] = await Promise.all([
    prisma.device.findUnique({ where: { id: body.sourceDeviceId } }),
    prisma.device.findUnique({ where: { id: body.targetDeviceId } }),
  ]);

  if (!sourceDevice) {
    clearTransferProgress();
    return NextResponse.json(
      { error: "Source device not found" },
      { status: 404 },
    );
  }
  if (!targetDevice) {
    clearTransferProgress();
    return NextResponse.json(
      { error: "Target device not found" },
      { status: 404 },
    );
  }

  let sourceConn: DeviceConnection | undefined;
  let targetConn: DeviceConnection | undefined;

  try {
    sourceConn = await createConnection(configFromDevice(sourceDevice));
    targetConn = await createConnection(configFromDevice(targetDevice));
  } catch (error) {
    sourceConn?.disconnect();
    targetConn?.disconnect();
    clearTransferProgress();
    const message =
      error instanceof Error ? error.message : "Connection failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const sc = sourceConn;
  const tc = targetConn;
  runTransfer(sc, tc, body.files, body.targetPath, mode)
    .catch((err) => {
      console.error("Transfer failed:", err);
      setTransferProgress({
        transferring: false,
        error: err instanceof Error ? err.message : "Transfer failed",
      });
    })
    .finally(() => {
      sc.disconnect();
      tc.disconnect();
    });

  return NextResponse.json({ ok: true, message: "Transfer started" });
}
