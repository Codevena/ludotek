import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

/**
 * Constant-time string comparison to avoid leaking the admin token via
 * response-timing differences. Returns false on any length mismatch.
 */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function requireAuth(request: NextRequest): NextResponse | null {
  // In Heimnetz, use a simple token from env
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken) return null; // No token configured = no auth required (dev mode)

  const authHeader = request.headers.get("authorization");
  if (authHeader && safeEqual(authHeader, `Bearer ${adminToken}`)) return null;

  // Also check cookie for browser-based admin
  const cookie = request.cookies.get("admin_token");
  if (cookie?.value && safeEqual(cookie.value, adminToken)) return null;

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
