import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFilePlan } from "@/lib/file-plans";
import { filePlanFailure } from "@/lib/file-plan-api";

export async function GET(request: NextRequest) {
  const denied = requireAuth(request); if (denied) return denied;
  try {
    const active = await prisma.filePlan.findFirst({ where: { kind: { in: ["copy", "move"] }, status: { in: ["applying", "undoing"] } }, orderBy: { updatedAt: "desc" }, select: { id: true } });
    const latest = active ?? await prisma.filePlan.findFirst({ where: { kind: { in: ["copy", "move"] } }, orderBy: { updatedAt: "desc" }, select: { id: true } });
    if (!latest) return NextResponse.json({ status: "idle", current: "", progress: 0, completed: 0, total: 0, mode: "copy" });
    const plan = await getFilePlan(latest.id);
    const completed = plan.operations.filter((operation) => operation.phase === "complete").length;
    const running = ["applying", "undoing"].includes(plan.status);
    const succeeded = plan.status === "applied" && completed === plan.operations.length;
    const failed = ["recovery_needed", "recovery_conflict", "failed", "cancelled", "undo_conflict"].includes(plan.status) || (plan.status === "applied" && !succeeded);
    return NextResponse.json({
      status: running ? "in_progress" : succeeded ? "complete" : failed ? "error" : plan.status === "ready" ? "ready" : plan.status === "undone" ? "undone" : "idle",
      planId: plan.id, planStatus: plan.status, current: plan.operations.find((operation) => operation.phase !== "complete")?.sourcePath ?? "",
      progress: plan.operations.length ? Math.floor(completed / plan.operations.length * 100) : 0,
      completed, total: plan.operations.length, mode: plan.kind === "move" ? "move" : "copy",
      error: failed ? plan.error || "Dateiplan benötigt eine geprüfte Wiederherstellung." : undefined,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return filePlanFailure(error); }
}
