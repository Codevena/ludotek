import { spawn } from "child_process";

export interface ConvertJob {
  inputPath: string;
  outputPath: string;
  format: "chd" | "rvz";
  onProgress?: (percent: number) => void;
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
    const { inputPath, outputPath, format, onProgress } = job;

    const command =
      format === "chd"
        ? { bin: "chdman", args: ["createcd", "-i", inputPath, "-o", outputPath] }
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

    let stderrBuf = "";

    child.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stderrBuf += text;

      // chdman uses \r to separate progress updates on a single line
      const lines = text.split("\r");
      for (const line of lines) {
        const percent = parseChdmanProgress(line);
        if (percent !== null && onProgress) {
          onProgress(percent);
        }
      }
    });

    child.on("error", (err: Error) => {
      reject(new Error(`Failed to start ${command.bin}: ${err.message}`));
    });

    child.on("close", (code: number | null) => {
      if (code !== 0) {
        const tail = stderrBuf.slice(-500);
        reject(
          new Error(
            `${command.bin} exited with code ${code}:\n${tail}`
          )
        );
        return;
      }
      resolve();
    });
  });
}
