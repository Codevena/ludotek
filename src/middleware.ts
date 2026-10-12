import { NextRequest, NextResponse } from "next/server";
import { allowsLocalAuthority, getAuthPolicy } from "@/lib/auth-policy";

export function middleware(request: NextRequest) {
  const policy = getAuthPolicy();
  // Includes HTML, RSC and API requests: a dev page is not an alternative read path.
  if (!policy.configured || (policy.mode === "local" && !allowsLocalAuthority(request, policy))) {
    return NextResponse.json(
      { error: policy.configured ? "Forbidden authority" : "Local access is not configured" },
      { status: policy.configured ? 403 : 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.next();
}
