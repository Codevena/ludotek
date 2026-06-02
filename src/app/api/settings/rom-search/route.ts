import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  // Consistent with the rest of /api/settings. The wishlist page fetches this
  // client-side, so the admin_token cookie is sent automatically when set.
  const authError = requireAuth(request);
  if (authError) return authError;

  try {
    const settings = await prisma.settings.findFirst({
      where: { id: 1 },
      select: { romSearchUrl: true },
    });

    return NextResponse.json({
      romSearchUrl: settings?.romSearchUrl || "",
    });
  } catch (error) {
    console.error("Failed to get ROM search URL:", error);
    return NextResponse.json({ romSearchUrl: "" });
  }
}
