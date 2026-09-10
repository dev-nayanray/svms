import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const PROTECTED_PREFIXES = ["/admin", "/employee", "/student", "/dashboard"];

/** Coarse per-role home so users never land in another panel's prefix. */
export function roleHome(role: string | undefined): string {
  if (role === "ADMIN") return "/admin";
  if (role === "EMPLOYEE") return "/employee";
  return "/student";
}

/**
 * Edge proxy (Next.js 16 replacement for middleware):
 * - unauthenticated users hitting protected routes → /login?callbackUrl=…
 * - authenticated users are kept inside their own role's prefix
 * Role checks here are a fast edge gate only — full authorization is still
 * enforced server-side in layouts and API guards (never only here).
 */
export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const token = await getToken({ req, secret: process.env.AUTH_SECRET });
  if (!token) {
    const url = new URL("/login", req.url);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  const home = roleHome(token.role as string | undefined);
  if (home !== pathname && !pathname.startsWith(home + "/") && pathname !== "/403") {
    return NextResponse.redirect(new URL(home, req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/employee/:path*", "/student/:path*", "/dashboard/:path*"],
};
