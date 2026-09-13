import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

/**
 * Auth.js v5 configuration.
 *
 * Uses the credentials provider with bcrypt-hashed passwords stored on
 * the User model. Sessions are JWT (stateless) so we don't need a session
 * table — the role + status + id ride along in the token.
 *
 * Only ACTIVE users may sign in. SUSPENDED / INACTIVE users get a 401
 * with a friendly message so they know why they were rejected.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
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
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = (user as { role?: string }).role ?? "STUDENT";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { role?: string }).role = (token.role as string) ?? "STUDENT";
      }
      return session;
    },
  },
});
