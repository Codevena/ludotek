import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { clearApiCache } from "@/lib/api-cache";

export async function DELETE(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  try {
    const deletedCount = await clearApiCache();
    return NextResponse.json({ success: true, deletedCount });
  } catch (error) {
    console.error("Clear API cache error:", error);
    return NextResponse.json(
      { error: "Failed to clear API cache" },
      { status: 500 },
    );
  }
}
