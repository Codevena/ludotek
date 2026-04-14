import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getCacheStats } from "@/lib/image-cache";
import { getApiCacheStats } from "@/lib/api-cache";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  try {
    const [images, apiCache] = await Promise.all([
      getCacheStats(),
      getApiCacheStats(),
    ]);

    return NextResponse.json({ images, apiCache });
  } catch (error) {
    console.error("Cache stats error:", error);
    return NextResponse.json(
      { error: "Failed to load cache stats" },
      { status: 500 },
    );
  }
}
