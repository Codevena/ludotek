import { spawn, execFileSync } from "child_process";
import { stat } from "node:fs/promises";

export interface ConvertJob {
  inputPath: string;
  outputPath: string;
  format: "chd" | "rvz";
  /**
   * For CHD: "dvd" uses `chdman createdvd` (required for PS2 — its raw DVD/CD
   * ISOs are rejected by createcd); default "cd" uses `chdman createcd` for the
   * CD-based platforms (psx, dreamcast, saturn, segacd).
   */
  chdType?: "cd" | "dvd";
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
  timeoutMs?: number;
  maxOutputBytes?: number;
}

/** Check if a CLI tool is available on the system */
function isToolAvailable(cmd: string): boolean {
  try {
    execFileSync("which", [cmd], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Extracts a percentage from chdman stderr progress output.
 * Pattern: "Compressing, 45.2% complete..."
 * Returns null for non-progress lines.
 */
export function parseChdmanProgress(line: string): number | null {
  const match = line.match(/(\d+(?:\.\d+)?)% complete/);
  if (!match) return null;
  return parseFloat(match[1]);
}

/**
 * Runs the appropriate CLI tool (chdman or DolphinTool) to convert a ROM file.
 * Parses stderr for progress updates and rejects on non-zero exit codes.
 */
export function convert(job: ConvertJob): Promise<void> {
  return new Promise((resolve, reject) => {
    const { inputPath, outputPath, format, chdType, onProgress } = job;
    const timeoutMs = job.timeoutMs ?? 20 * 60 * 1000;
    const maxOutputBytes = job.maxOutputBytes ?? 16 * 1024 ** 3;
    if (![timeoutMs, maxOutputBytes].every((value) => Number.isSafeInteger(value) && value > 0) || timeoutMs > 60 * 60 * 1000 || maxOutputBytes > 16 * 1024 ** 3) return reject(new Error("Invalid conversion limits"));
    if (job.signal?.aborted) return reject(job.signal.reason);

    // Check tool availability before spawning
    const toolName = format === "chd" ? "chdman" : "DolphinTool";
    if (!isToolAvailable(toolName)) {
      return reject(new Error(
        `${toolName} is not installed. ${format === "rvz"
          ? "Place a DolphinTool binary in the Docker image to enable GameCube RVZ conversion."
          : "Install mame-tools to enable CHD conversion."}`
      ));
    }

    const command =
      format === "chd"
        ? {
            bin: "chdman",
            args: [
              chdType === "dvd" ? "createdvd" : "createcd",
              "-i", inputPath,
              "-o", outputPath,
            ],
          }
        : {
            bin: "DolphinTool",
            args: [
              "convert",
              "-i", inputPath,
              "-o", outputPath,
              "-f", "rvz",
              "-b", "131072",
              "-c", "zstd",
              "-l", "5",
            ],
          };

    const child = spawn(command.bin, command.args);
    let stderrBuf = ""; let outputBytes = 0; let failure: Error | undefined; let killTimer: ReturnType<typeof setTimeout> | undefined; let closed = false;
    const stop = (error: Error) => {
      if (failure || closed) return; failure = error;
      child.kill("SIGTERM");
      killTimer = setTimeout(() => { child.kill("SIGKILL"); }, 2000);
    };
    const abort = () => stop(new Error("Conversion cancelled"));
    const deadline = setTimeout(() => stop(new Error("Conversion deadline exceeded")), timeoutMs);
    job.signal?.addEventListener("abort", abort, { once: true });
    if (job.signal?.aborted) abort();
    let checking = false;
    const outputMonitor = setInterval(() => {
      if (checking || failure) return; checking = true;
      void stat(outputPath).then((info) => { if (info.size > maxOutputBytes) stop(new Error("Conversion output exceeds its byte budget")); }).catch((error) => { if (error.code !== "ENOENT") stop(new Error("Conversion output cannot be checked")); }).finally(() => { checking = false; });
    }, 250);
    const meterOutput = (chunk: Buffer) => { outputBytes += chunk.length; if (outputBytes > 1024 * 1024) stop(new Error("Conversion diagnostic output exceeds its limit")); };
    child.stdout.on("data", meterOutput);

    child.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      meterOutput(chunk); stderrBuf = (stderrBuf + text).slice(-32768);

      // chdman uses \r to separate progress updates on a single line
      const lines = text.split("\r");
      for (const line of lines) {
        const percent = parseChdmanProgress(line);
        if (percent !== null && onProgress) {
          try { onProgress(Math.min(100, Math.max(0, percent))); } catch { stop(new Error("Conversion progress callback failed")); }
        }
      }
    });

    child.on("error", (err: Error) => {
      failure = new Error(`Failed to start ${command.bin}: ${err.message}`);
    });

    child.on("close", async (code: number | null) => {
      closed = true;
      clearTimeout(deadline); clearInterval(outputMonitor); if (killTimer) clearTimeout(killTimer); job.signal?.removeEventListener("abort", abort);
      if (failure) { reject(failure); return; }
      if (code !== 0) {
        const tail = stderrBuf.slice(-500);
        reject(
          new Error(
            `${command.bin} exited with code ${code}:\n${tail}`
          )
        );
        return;
      }
      try {
        const output = await stat(outputPath);
        if (!output.isFile() || !Number.isSafeInteger(output.size) || output.size < 0 || output.size > maxOutputBytes) throw new Error("Conversion output exceeds its verified byte budget");
        if (job.signal?.aborted) throw new Error("Conversion cancelled");
        resolve();
      } catch (error) { reject(error instanceof Error ? error : new Error("Conversion output is unavailable")); }
    });
  });
}
