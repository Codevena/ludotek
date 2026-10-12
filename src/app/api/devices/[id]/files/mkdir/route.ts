import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createFilePlan } from "@/lib/file-plans";
import { readBoundedJson } from "@/lib/request-body";
import { filePlanFailure } from "@/lib/file-plan-api";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireAuth(request); if (denied) return denied;
  const { id } = await params;
  if (!/^[1-9]\d{0,9}$/.test(id)) return Response.json({ error: "Invalid device ID" }, { status: 400 });
  try {
    const body = await readBoundedJson(request) as { path?: unknown };
    if (typeof body?.path !== "string") return Response.json({ error: "Directory path is required" }, { status: 400 });
    const plan = await createFilePlan({ kind: "mkdir", operations: [{ deviceId: Number(id), filePath: body.path }] }, request);
    return Response.json({ plan, planId: plan.id, preview: true }, { status: 201 });
  } catch (error) { return filePlanFailure(error); }
}
