import { NextRequest, NextResponse } from "next/server";

/**
 * Edge proxy (Next.js 16 replacement for middleware).
 *
 * This file exists primarily to shadow the parent project's proxy.ts
 * (at /home/z/my-project/proxy.ts) which imports `next-auth/jwt` — a
 * module not available in this subproject's node_modules. Without this
 * local shadow, Next.js discovers the parent's proxy.ts and the build
 * fails with "Module not found: Can't resolve 'next-auth/jwt'".
 *
 * Auth + RBAC for the Employee Panel is enforced server-side in:
 *   - app/employee/layout.tsx (page-level guard)
 *   - lib/auth/guards.ts (API-level guard)
 *   - Every service function embeds the caller's scope filter
 *
 * This proxy is a no-op pass-through. If edge-level redirects are
 * needed later (e.g. for i18n locale negotiation), add them here.
 */
export default async function proxy(_req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
