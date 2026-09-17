"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { pushRoleHome } from "@/app/(auth)/login/login-form";

/**
 * /auth/callback — post-OAuth landing page.
 *
 * Google (and other provider) sign-ins that don't go through the
 * credentials form can't read the role before redirecting, so they
 * land here. This page waits for the session cookie to settle, then
 * routes the user to their role's home (admin → /admin, employee →
 * /employee, student → /student).
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const pushed = useRef(false);

  useEffect(() => {
    if (pushed.current) return;
    pushed.current = true;
    pushRoleHome(router);
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
      <p className="text-sm text-muted-foreground">Signing you in…</p>
    </div>
  );
}
