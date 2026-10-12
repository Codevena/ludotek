import type { NextRequest } from "next/server";
import { posix } from "node:path";
import { requireAuth } from "@/lib/auth";
import { createFilePlan } from "@/lib/file-plans";
import { readBoundedJson } from "@/lib/request-body";
import { filePlanFailure } from "@/lib/file-plan-api";

// The legacy transfer entry point now produces the same reviewable dry run;
// applying it is an explicit request to the durable common journal.
export async function POST(request: NextRequest) {
  const denied = requireAuth(request); if (denied) return denied;
  try {
    const body = await readBoundedJson(request) as { sourceDeviceId?: number; targetDeviceId?: number; files?: unknown; targetPath?: unknown; mode?: unknown };
    if (!Number.isSafeInteger(body?.sourceDeviceId) || body.sourceDeviceId! < 1 || !Number.isSafeInteger(body?.targetDeviceId) || body.targetDeviceId! < 1 ||
        typeof body?.targetPath !== "string" || !Array.isArray(body.files) || body.files.length < 1 || body.files.length > 100 || body.files.some((path) => typeof path !== "string") ||
        (body.mode !== "copy" && body.mode !== "move")) return Response.json({ error: "Valid source/target, 1–100 files and copy/move mode are required" }, { status: 400 });
    const plan = await createFilePlan({ kind: body.mode, operations: body.files.map((filePath) => ({
      deviceId: body.sourceDeviceId!, filePath, targetDeviceId: body.targetDeviceId!, newPath: posix.join(body.targetPath as string, posix.basename(filePath)),
    })) }, request);
    return Response.json({ plan, planId: plan.id, preview: true }, { status: 201 });
  } catch (error) { return filePlanFailure(error); }
}
