import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { loginSchema } from "@/lib/validations/auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      branchId?: string | null;
    } & DefaultSession["user"];
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 }, // 8 hours — forces re-validation
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
          include: { student: true, employee: true },
        });
        if (!user || user.deletedAt) return null;
        if (user.status !== "ACTIVE") return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.roleName,
          branchId: user.branchId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Initial sign-in — store role + branchId + timestamp for refresh
        token.role = (user as { role: string }).role;
        token.branchId = (user as { branchId?: string | null }).branchId ?? null;
        token.lastChecked = Date.now();
      } else if (token.lastChecked) {
        // Periodic re-validation: every 5 minutes, re-fetch the user
        // from the DB to check if they've been suspended, soft-deleted,
        // or had their role changed. This closes the stale-JWT hole (C2).
        const now = Date.now();
        const fiveMinutes = 5 * 60 * 1000;
        if (now - (token.lastChecked as number) > fiveMinutes) {
          try {
            const dbUser = await prisma.user.findUnique({
              where: { id: token.sub as string },
              select: { roleName: true, status: true, deletedAt: true, branchId: true },
            });
            if (!dbUser || dbUser.deletedAt || dbUser.status !== "ACTIVE") {
              // User has been suspended/deleted since sign-in — invalidate token
              return { ...token, role: "INVALID" };
            }
            token.role = dbUser.roleName;
            token.branchId = dbUser.branchId ?? null;
            token.lastChecked = now;
          } catch {
            // DB error — keep the existing token (fail open for availability)
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.role = (token.role as string) ?? "STUDENT";
        session.user.branchId = (token.branchId as string | null) ?? null;
      }
      return session;
    },
  },
});
