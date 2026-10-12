import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getFilePlan } from "@/lib/file-plans";
import { filePlanFailure, validPlanId } from "@/lib/file-plan-api";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireAuth(request); if (denied) return denied;
  const { id } = await params;
  if (!validPlanId(id)) return Response.json({ error: "Invalid plan ID" }, { status: 400 });
  try { return Response.json({ plan: await getFilePlan(id) }, { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return filePlanFailure(error); }
}
