import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { loadUploadSession, UploadInputError, validateUploadBody } from "@/lib/disc-inputs";

export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  try {
    const { sessionId, platform } = validateUploadBody(body, false);
    const { games } = await loadUploadSession(sessionId, platform);
    return NextResponse.json({ games });
  } catch (err) {
    if (err instanceof UploadInputError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("Detection failed:", err);
    return NextResponse.json(
      {
        error: `Detection failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      },
      { status: 500 }
    );
  }
}
