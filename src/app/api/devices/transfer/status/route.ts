import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getTransferProgress } from "@/lib/transfer-progress";

export async function GET(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const p = getTransferProgress();
  return NextResponse.json({
    status: p.transferring ? "in_progress" : p.error ? "error" : "idle",
    current: p.currentFile,
    progress: p.progress,
    completed: p.completedFiles,
    total: p.totalFiles,
    mode: p.mode,
    error: p.error,
  });
}
