import { NextRequest, NextResponse } from "next/server";

export function requireAuth(request: NextRequest): NextResponse | null {
  // In Heimnetz, use a simple token from env
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken) return null; // No token configured = no auth required (dev mode)

  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${adminToken}`) return null;

  // Also check cookie for browser-based admin
  const cookie = request.cookies.get("admin_token");
  if (cookie?.value === adminToken) return null;

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
