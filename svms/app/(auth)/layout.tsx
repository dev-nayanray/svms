import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ROLE_HOME } from "@/lib/permissions";

export const metadata: Metadata = {
  title: "Login",
  description: "Sign in to Euroscope — student, employee, or administrator.",
};

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  // Authenticated users bouncing off /login go straight to their role home.
  const session = await auth();
  if (session?.user) {
    const role = (session.user as { role?: string }).role ?? "STUDENT";
    redirect(ROLE_HOME[role as keyof typeof ROLE_HOME] ?? "/student");
  }
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <aside className="relative hidden flex-col justify-between bg-brand-gradient p-10 text-primary-foreground lg:flex">
        <div className="text-sm font-semibold tracking-tight">Euroscope</div>
        <div>
          <p className="text-3xl font-semibold tracking-tight text-balance">
            Study in Europe. Start Your Future.
          </p>
          <p className="mt-3 max-w-md text-primary-foreground/80 text-pretty">
            Sign in to access your student dashboard, employee workspace, or admin platform.
          </p>
        </div>
        <p className="text-xs text-primary-foreground/60">© {new Date().getFullYear()} Euroscope</p>
      </aside>
      <main className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
