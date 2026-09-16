"use client";

import { SessionProvider } from "next-auth/react";

/**
 * MarketingSessionProvider — wraps the marketing site in a NextAuth
 * SessionProvider so the navbar can use useSession() to show
 * Login vs Dashboard/Logout.
 *
 * This is a client component — it's imported by the server-side
 * marketing layout.
 */
export function MarketingSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SessionProvider>{children}</SessionProvider>;
}
