import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createFilePlan } from "@/lib/file-plans";
import { readBoundedJson } from "@/lib/request-body";
import { filePlanFailure } from "@/lib/file-plan-api";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireAuth(request); if (denied) return denied;
  const { id } = await params;
  if (!/^[1-9]\d{0,9}$/.test(id)) return Response.json({ error: "Invalid device ID" }, { status: 400 });
  try {
    const body = await readBoundedJson(request) as { paths?: unknown };
    if (!Array.isArray(body?.paths) || body.paths.length < 1 || body.paths.length > 100 || body.paths.some((path) => typeof path !== "string")) return Response.json({ error: "1–100 file paths are required" }, { status: 400 });
    const plan = await createFilePlan({ kind: "delete", operations: body.paths.map((filePath) => ({ deviceId: Number(id), filePath })) }, request);
    return Response.json({ plan, planId: plan.id, preview: true }, { status: 201 });
  } catch (error) { return filePlanFailure(error); }
}
