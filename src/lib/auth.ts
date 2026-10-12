import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { allowsLocalAuthority, allowsOrigin, getAuthPolicy, isMutation } from "@/lib/auth-policy";

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
  const configurationError = requireAuthConfiguration(request);
  if (configurationError) return configurationError;
  const policy = getAuthPolicy();
  if (policy.mode === "local") {
    return isMutation(request.method) && !allowsOrigin(request.headers.get("origin"), policy)
      ? authError("Forbidden origin", 403) : null;
  }
  const adminToken = process.env.ADMIN_TOKEN;
  const authHeader = request.headers.get("authorization");
  if (authHeader && safeEqual(authHeader, `Bearer ${adminToken}`)) {
    const origin = request.headers.get("origin");
    return isMutation(request.method) && origin !== null && !allowsOrigin(origin, policy)
      ? authError("Forbidden origin", 403) : null;
  }

  // Also check cookie for browser-based admin
  const cookie = request.cookies.get("admin_token");
  if (cookie?.value && adminToken && safeEqual(cookie.value, adminToken)) {
    return isMutation(request.method) && !allowsOrigin(request.headers.get("origin"), policy)
      ? authError("Forbidden origin", 403) : null;
  }

  return authError("Unauthorized", 401);
}

export function authError(error: string, status: number): NextResponse {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

/** Checks startup configuration and the tokenless authority, without requiring a login. */
export function requireAuthConfiguration(request: NextRequest): NextResponse | null {
  const policy = getAuthPolicy();
  if (!policy.configured) return authError("Configure ADMIN_TOKEN, or use the loopback development launcher", 503);
  if (policy.mode === "local" && !allowsLocalAuthority(request, policy)) return authError("Forbidden authority", 403);
  return null;
}
