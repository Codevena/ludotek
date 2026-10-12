import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { receiveUpload, removeOwnedUploadSession, UPLOAD_BASE } from "@/lib/upload-journal";
import { UploadInputError } from "@/lib/disc-inputs";
import { deviceProfileFailure } from "@/lib/device-profiles";
import { acquireDeviceFiles } from "@/lib/device-jobs";
import { readdir, lstat } from "node:fs/promises";
import path from "node:path";
let lastCleanup = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function cleanupOldSessions() {
  let jobs: Awaited<ReturnType<typeof acquireDeviceFiles>> | undefined;
  try {
    jobs = await acquireDeviceFiles([], new Request("http://localhost/api/upload"));
    for (const name of await readdir(UPLOAD_BASE).catch(() => [])) {
      if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(name)) continue;
      const metadata = await lstat(path.join(UPLOAD_BASE, name)).catch(() => null);
      if (metadata?.isDirectory() && !metadata.isSymbolicLink() && Date.now() - metadata.mtimeMs > 86400000) await removeOwnedUploadSession(name, jobs);
    }
  } catch { /* Busy or uncertain state retains cached sources. */ }
  finally { try { await jobs?.close(); } catch { /* Store failure is not a deletion license. */ } }
}
export async function POST(request: NextRequest) {
  const authError = requireAuth(request); if (authError) return authError;
  try {
    const result = await receiveUpload(request);
    if (Date.now() - lastCleanup > 3600000) { lastCleanup = Date.now(); void cleanupOldSessions(); }
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof UploadInputError) return Response.json({ error: error.message }, { status: error.status });
    return deviceProfileFailure(error);
  }
}
