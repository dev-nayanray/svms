import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const PROTECTED_PREFIXES = ["/admin", "/employee", "/student", "/dashboard"];

/** Coarse per-role home for post-login redirect. */
export function roleHome(role: string | undefined): string {
  if (role === "ADMIN") return "/admin";
  if (role === "EMPLOYEE") return "/employee";
  return "/student";
}

/**
 * Edge proxy (Next.js 16 replacement for middleware):
 * - Unauthenticated users hitting protected routes → /login?callbackUrl=…
 * - STUDENT role is blocked from /admin and /employee (server-side layouts
 *   also enforce this, but the proxy catches it early at the edge)
 * - ADMIN and EMPLOYEE can access BOTH /admin and /employee (server-side
 *   layouts + RBAC decide what they can actually see/do)
 */
export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  // NextAuth v5 may issue the session cookie as "authjs.session-token" or
  // "__Secure-authjs.session-token" depending on how it detected the scheme.
  // Behind Vercel's proxy the issuer and this middleware can disagree, so
  // accept either name — otherwise logged-in users get bounced to /login.
  const secret = process.env.AUTH_SECRET;
  const token =
    (await getToken({ req, secret })) ??
    (await getToken({ req, secret, cookieName: "__Secure-authjs.session-token" })) ??
    (await getToken({ req, secret, cookieName: "authjs.session-token" }));
  if (!token) {
    const url = new URL("/login", req.url);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  const role = token.role as string | undefined;

  // STUDENT can only access /student — redirect away from /admin and /employee
  if (role === "STUDENT") {
    if (!pathname.startsWith("/student") && pathname !== "/403") {
      return NextResponse.redirect(new URL("/student", req.url));
    }
    return NextResponse.next();
  }

  // ADMIN and EMPLOYEE can access both /admin and /employee.
  // Full authorization is enforced server-side in layouts + RBAC.
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin",
    "/admin/:path*",
    "/employee",
    "/employee/:path*",
    "/student",
    "/student/:path*",
    "/dashboard",
    "/dashboard/:path*",
  ],
};
