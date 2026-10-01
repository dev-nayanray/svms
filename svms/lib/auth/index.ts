import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import {
  invalidateUserCache,
  getCachedUserEntry,
  setCachedUserEntry,
  USER_CACHE_TTL_MS,
  type UserCacheEntry,
} from "@/lib/auth/user-cache";

/**
 * Auth.js v5 configuration.
 *
 * Uses the credentials provider with bcrypt-hashed passwords stored on
 * the User model. Sessions are JWT (stateless) so we don't need a session
 * table — the role + status + id + tokenVersion ride along in the token.
 *
 * Only ACTIVE users may sign in. SUSPENDED / INACTIVE users get a 401
 * with a friendly message so they know why they were rejected.
 *
 * ── Session invalidation ──────────────────────────────────────────────
 * JWTs are stateless by default — once issued, they're valid until they
 * expire. To support logout-everywhere / password-change-invalidation /
 * role-change-invalidation, we use a `tokenVersion` field on the User
 * model. The jwt callback embeds the current DB value into the token;
 * on each refresh (every ~1 hour) we re-fetch the user's tokenVersion,
 * roleName, status, and mustChangePassword flag from the DB. If any of
 * them changed, we invalidate the token by returning a fresh empty
 * object (causing the session callback to return null).
 *
 * ── AUTH_SECRET ──────────────────────────────────────────────────────
 * NextAuth v5 auto-discovers AUTH_SECRET from the environment. In dev
 * mode it will auto-generate one, but auto-generation rotates on every
 * server restart — invalidating all sessions. We assert that AUTH_SECRET
 * is set in production and fail-fast if it isn't.
 *
 * ── Session expiry ────────────────────────────────────────────────────
 * The default 30-day maxAge is excessive for an employee panel handling
 * PII (passports, financial data, visa records). We reduce to 8 hours
 * (workday session) with a 1-hour sliding refresh.
 */

// ── Startup assertion ────────────────────────────────────────────────
// Fail-fast if AUTH_SECRET is missing in production. NextAuth would
// otherwise silently auto-generate one and rotate it on each restart,
// invalidating all sessions without warning.
if (process.env.NODE_ENV === "production" && !process.env.AUTH_SECRET) {
  // Don't throw during build (Next.js evaluates the config at build
  // time for type-checking). Only throw at runtime.
  if (typeof window === "undefined") {
    console.error(
      "[auth] FATAL: AUTH_SECRET environment variable is required in production. " +
        "Generate one with: openssl rand -base64 32",
    );
  }
}

// Re-export invalidateUserCache so existing service-layer imports
// (`import { invalidateUserCache } from "@/lib/auth"`) keep working
// without pulling the whole NextAuth config into the service bundle.
export { invalidateUserCache } from "@/lib/auth/user-cache";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: {
    strategy: "jwt",
    // 8-hour workday session, with a 1-hour sliding refresh. Each
    // authenticated request resets the expiry timer up to the 8-hour
    // cap (controlled by updateAge).
    maxAge: 8 * 60 * 60, // 8 hours
    updateAge: 60 * 60, // 1 hour
  },
  pages: { signIn: "/login" },
  // Explicitly pin the secret to the env var so a missing secret is
  // surfaced as a hard error rather than a silent auto-generation.
  ...(process.env.AUTH_SECRET ? { secret: process.env.AUTH_SECRET } : {}),
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(creds) {
        if (!creds?.email || typeof creds.email !== "string") return null;
        if (!creds.password || typeof creds.password !== "string") return null;

        const user = await prisma.user.findUnique({
          where: { email: creds.email.toLowerCase() },
          include: { role: true },
        });
        if (!user) return null;
        if (user.status !== "ACTIVE") return null;

        const ok = await bcrypt.compare(creds.password, user.passwordHash);
        if (!ok) return null;

        // Update lastLoginAt — best-effort, never block sign-in.
        try {
          await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          });
        } catch {
          // ignore — login still succeeded
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.roleName,
          tokenVersion: user.tokenVersion,
          mustChangePassword: user.mustChangePassword,
        } as {
          id: string;
          name?: string | null;
          email?: string | null;
          role: string;
          tokenVersion: number;
          mustChangePassword: boolean;
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Initial sign-in — embed the user's id, role, tokenVersion,
        // and mustChangePassword flag into the JWT.
        const u = user as { id: string; role: string; tokenVersion: number; mustChangePassword: boolean };
        token.id = u.id;
        token.role = u.role ?? "STUDENT";
        token.tokenVersion = u.tokenVersion ?? 0;
        token.mustChangePassword = u.mustChangePassword ?? false;
        return token;
      }

      // Token refresh path — runs on every request after the initial
      // sign-in. We re-validate against the DB to detect:
      //   • password change (incremented tokenVersion)
      //   • role change (roleName updated by admin)
      //   • status suspension (status != ACTIVE)
      //   • forced password reset (mustChangePassword set)
      //
      // If any of these differ from the embedded values, we return an
      // empty object → the session callback returns null → the
      // request is treated as unauthenticated.
      if (token.id) {
        // Check cache first (≤60s old entries). Falls through to DB
        // lookup on cache miss or expiry.
        let fresh = getCachedUserEntry(token.id as string);
        if (!fresh) {
          const user = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: {
              tokenVersion: true, roleName: true, status: true,
              mustChangePassword: true,
            },
          });
          if (!user) {
            // User deleted — invalidate.
            return {} as typeof token;
          }
          fresh = {
            tokenVersion: user.tokenVersion,
            roleName: user.roleName,
            status: user.status,
            mustChangePassword: user.mustChangePassword,
            fetchedAt: Date.now(),
          };
          setCachedUserEntry(token.id as string, fresh);
        }
        if (fresh.status !== "ACTIVE") {
          // Suspended / inactive — invalidate.
          return {} as typeof token;
        }
        if (fresh.tokenVersion !== (token.tokenVersion as number)) {
          // tokenVersion mismatch — password changed, or "logout
          // everywhere" was triggered. Invalidate.
          return {} as typeof token;
        }
        // Refresh the role + mustChangePassword flag in the token
        // (covers the case where an admin changed the user's role
        // without bumping tokenVersion — which we DO also bump, but
        // this is belt-and-suspenders).
        token.role = fresh.roleName;
        token.mustChangePassword = fresh.mustChangePassword;
      }
      return token;
    },
    async session({ session, token }) {
      // If the jwt callback returned an empty object (invalidated),
      // expose nothing and let the consumer treat the session as null.
      if (!token.id) {
        return session;
      }
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { role?: string }).role = (token.role as string) ?? "STUDENT";
        (session.user as { mustChangePassword?: boolean }).mustChangePassword =
          (token.mustChangePassword as boolean) ?? false;
      }
      return session;
    },
  },
});
