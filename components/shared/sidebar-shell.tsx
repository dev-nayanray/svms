"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui";

export type NavItem = { href: string; label: string; icon: React.ElementType };
export type NavGroup = { label: string; items: NavItem[] };

export function SidebarShell({
  items,
  title,
  role,
  userName,
  children,
}: {
  items: NavItem[];
  title: string;
  role: string;
  userName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-card md:flex">
        <div className="flex h-14 items-center gap-2 border-b border-border px-4 font-semibold">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-primary text-sm text-primary-foreground">
            SV
          </span>
          {title}
        </div>
        <nav className="flex-1 space-y-0.5 p-2" aria-label="Main navigation">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border p-3 text-xs text-muted-foreground">
          {userName} · {role}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4">
          <div className="flex items-center gap-3 md:hidden">
            <MobileNav items={items} />
            <span className="font-semibold">{title}</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await signOut({ redirect: false });
                router.push("/login");
              }}
            >
              Sign out
            </Button>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">
          <div className="mx-auto w-full max-w-7xl space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

function MobileNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Mobile navigation" className="flex items-center gap-1 overflow-x-auto">
      {items.slice(0, 6).map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-label={item.label}
            className={cn(
              "grid h-8 w-8 place-items-center rounded-md",
              active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
            )}
          >
            <item.icon className="h-4 w-4" aria-hidden />
          </Link>
        );
      })}
    </nav>
  );
}

function ThemeToggle() {
  const setTheme = (theme: "light" | "dark" | "system") => {
    localStorage.setItem("svms-theme", theme);
    const dark =
      theme === "dark" ||
      (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
  };
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle dark mode"
      onClick={() =>
        setTheme(document.documentElement.classList.contains("dark") ? "light" : "dark")
      }
    >
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    </Button>
  );
}
