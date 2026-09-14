import { NextRequest, NextResponse } from "next/server";
import { handlers } from "@/lib/auth";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";

// Wrap the NextAuth handlers with a rate limit on POST /callback/credentials
// to protect against credential-stuffing / brute-force login attacks.
// The limit is per-IP, burst of 5 attempts with a refill of 1/min.
//
// Note: this is a coarse, IP-based limiter. For multi-instance deployments
// it MUST be replaced with a Redis-backed limiter (see
// lib/security/rate-limit.ts).
const origGet = handlers.GET;
const origPost = handlers.POST;

async function rateLimitedGet(req: NextRequest) {
  return origGet(req);
}

async function rateLimitedPost(req: NextRequest) {
  // The NextAuth credential callback endpoint path looks like
  // /api/auth/callback/credentials — only rate-limit that one to
  // avoid throttling sign-out, session-refresh, etc.
  const url = req.nextUrl ?? new URL(req.url);
  if (url.pathname.endsWith("/callback/credentials")) {
    const limited = rateLimit(req, RATE_LIMIT_PRESETS.login, "login");
    if (limited) {
      return new NextResponse(limited.body, {
        status: limited.status,
        headers: limited.headers,
      });
    }
  }
  return origPost(req);
}

export const GET = rateLimitedGet;
export const POST = rateLimitedPost;
