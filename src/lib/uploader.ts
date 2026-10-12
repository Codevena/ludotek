import path from "node:path";
import { assertUploadFilename, assertUploadPlatform, UploadInputError } from "@/lib/disc-inputs";

/** Formatting only; callers supply their verified profile root. */
export function getTransferPath(platform: string, _isMultiDisc: boolean, targetRoot?: string): string {
  assertUploadPlatform(platform);
  if (!targetRoot || !targetRoot.startsWith("/") || targetRoot === "/" || path.posix.normalize(targetRoot) !== targetRoot || /[\x00-\x1f\x7f]/.test(targetRoot)) throw new UploadInputError("A verified device-profile target root is required");
  return `${targetRoot}/`;
}
/** Relative names, independent of device and mount paths. */
export function generateM3u(_title: string, platform: string, discFilenames: string[]): string {
  assertUploadPlatform(platform);
  if (!discFilenames.length || discFilenames.length > 100) throw new UploadInputError("A playlist needs 1–100 actual disc files");
  for (const filename of discFilenames) assertUploadFilename(filename);
  return discFilenames.map((filename) => `${filename}\n`).join("");
}
/** Retired direct entry points fail before opening a transport. */
export async function transferFiles(_host: string, _user: string, _password: string, _jobs: unknown[], _port?: number): Promise<never> {
  void _host; void _user; void _password; void _jobs; void _port;
  throw new UploadInputError("Direct transfers are retired; use the verified upload file journal", 422);
}
export async function transferM3u(_host: string, _user: string, _password: string, filename: string, _contents: string, platform: string, _port?: number): Promise<never> {
  void _port;
  assertUploadPlatform(platform); assertUploadFilename(filename);
  throw new UploadInputError("Direct playlist writes are retired; use the verified upload file journal", 422);
}
