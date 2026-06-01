import { NextRequest, NextResponse } from "next/server";
import { safeEqual } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken) {
    // No token configured — auth disabled
    return NextResponse.json({ success: true, authDisabled: true });
  }

  const body = await request.json().catch(() => ({}));
  const token = body.token;

  if (typeof token !== "string" || !safeEqual(token, adminToken)) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set("admin_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return response;
}

export async function GET() {
  const adminToken = process.env.ADMIN_TOKEN;
  return NextResponse.json({ authRequired: !!adminToken });
}
