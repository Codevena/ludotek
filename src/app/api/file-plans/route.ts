import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createFilePlan, type FilePlanInput } from "@/lib/file-plans";
import { readBoundedJson } from "@/lib/request-body";
import { filePlanFailure, validPlanId } from "@/lib/file-plan-api";

export async function GET(request: NextRequest) {
  const denied = requireAuth(request); if (denied) return denied;
  const before = new URL(request.url).searchParams.get("before");
  if (before && !validPlanId(before)) return Response.json({ error: "Invalid plan cursor" }, { status: 400 });
  try {
    if (before && !await prisma.filePlan.findUnique({ where: { id: before }, select: { id: true } })) return Response.json({ error: "Plan cursor not found" }, { status: 404 });
    const plans = await prisma.filePlan.findMany({ orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 51, ...(before ? { cursor: { id: before }, skip: 1 } : {}),
      select: { id: true, kind: true, status: true, totalBytes: true, createdAt: true, updatedAt: true, error: true } });
    return Response.json({ plans: plans.slice(0, 50).map((plan) => ({ ...plan, totalBytes: plan.totalBytes.toString() })), nextCursor: plans.length > 50 ? plans[49].id : null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return filePlanFailure(error); }
}

export async function POST(request: NextRequest) {
  const denied = requireAuth(request); if (denied) return denied;
  try {
    const input = await readBoundedJson(request);
    const plan = await createFilePlan(input as FilePlanInput, request);
    return Response.json({ plan }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return filePlanFailure(error); }
}
