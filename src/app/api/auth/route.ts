import { NextRequest, NextResponse } from "next/server";
import { authError, requireAuth, requireAuthConfiguration, safeEqual } from "@/lib/auth";
import { allowsOrigin, getAuthPolicy } from "@/lib/auth-policy";
import { admissionResponse, assertAdmissionStore, reserveLoginFailure } from "@/lib/job-admission";

export const dynamic = "force-dynamic";

class LoginInputError extends Error {
  constructor(readonly status: 400 | 408) {
    super(status === 408 ? "Login request timed out or was cancelled" : "Invalid login body");
  }
}

async function readLoginToken(request: NextRequest): Promise<string> {
  if (!request.body) throw new LoginInputError(400);
  if (request.signal.aborted) throw new LoginInputError(408);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  let rejectDeadline!: (error: LoginInputError) => void;
  const deadline = new Promise<never>((_, reject) => { rejectDeadline = reject; });
  const cancel = () => {
    rejectDeadline(new LoginInputError(408));
    void reader.cancel().catch(() => {});
  };
  const timer = setTimeout(cancel, 10_000);
  request.signal.addEventListener("abort", cancel, { once: true });
  try {
    while (true) {
      const result = await Promise.race([reader.read(), deadline]);
      if (result.done) break;
      bytes += result.value.byteLength;
      if (bytes > 4096) {
        void reader.cancel().catch(() => {});
        throw new LoginInputError(400);
      }
      chunks.push(result.value);
    }
    const token = JSON.parse(Buffer.concat(chunks).toString("utf8"))?.token;
    if (typeof token !== "string" || token.length > 2048) throw new LoginInputError(400);
    return token;
  } catch (error) {
    if (error instanceof LoginInputError) throw error;
    throw new LoginInputError(400);
  } finally {
    clearTimeout(timer);
    request.signal.removeEventListener("abort", cancel);
    reader.releaseLock();
  }
}

export async function POST(request: NextRequest) {
  const configurationError = requireAuthConfiguration(request);
  if (configurationError) return configurationError;
  const policy = getAuthPolicy();
  // This endpoint issues a browser cookie, so every login needs the configured Origin.
  if (!allowsOrigin(request.headers.get("origin"), policy)) return authError("Forbidden origin", 403);
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken) {
    return NextResponse.json({ success: true, authDisabled: true }, { headers: { "Cache-Control": "no-store" } });
  }

  let token: string;
  try {
    token = await readLoginToken(request);
  } catch (error) {
    return authError(error instanceof LoginInputError ? error.message : "Invalid login body", error instanceof LoginInputError ? error.status : 400);
  }

  if (typeof token !== "string" || !safeEqual(token, adminToken)) {
    try {
      await reserveLoginFailure();
    } catch (error) {
      return admissionResponse(error);
    }
    return authError("Invalid token", 401);
  }

  // Correct credentials remain usable after the failure budget is exhausted.
  try {
    await assertAdmissionStore();
  } catch (error) {
    return admissionResponse(error);
  }

  const response = NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set("admin_token", token, {
    httpOnly: true,
    secure: policy.origin?.protocol === "https:",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return response;
}

export async function GET(request: NextRequest) {
  const policy = getAuthPolicy();
  const configurationError = requireAuthConfiguration(request);
  return NextResponse.json({
    authRequired: policy.mode !== "local",
    mode: policy.mode,
    configured: policy.configured,
    authenticated: configurationError === null && requireAuth(request) === null,
    ...(configurationError ? { error: policy.configured ? "Forbidden authority" : "Configure ADMIN_TOKEN, or use pnpm dev on loopback" } : {}),
  }, {
    status: configurationError?.status || 200,
    headers: { "Cache-Control": "no-store" },
  });
}
