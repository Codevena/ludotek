import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { clearCache, getCacheStats } from "@/lib/image-cache";

export async function DELETE(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  try {
    const statsBefore = await getCacheStats();
    await clearCache();
    return NextResponse.json({
      success: true,
      deletedFiles: statsBefore.total.count,
      freedBytes: statsBefore.total.size,
    });
  } catch (error) {
    console.error("Clear image cache error:", error);
    return NextResponse.json(
      { error: "Failed to clear image cache" },
      { status: 500 },
    );
  }
}
