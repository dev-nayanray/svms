"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Menu, X, Search, Sun, Moon, Monitor, ChevronDown, LogOut, UserRound,
  Settings, HelpCircle, Compass,
} from "lucide-react";
import { cn, initials } from "@/lib/utils";
import { Badge } from "@/components/ui";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/overlays";
import { PAGE_TITLES, type NavGroup } from "@/config/employee-nav";
import { NotificationBell } from "@/components/employee/notifications/notification-bell";
import type { NotificationRow } from "@/lib/services/notification-cases";
import type { Theme } from "@/lib/services/settings-cases";

export function EmployeeAppShell({
  userName,
  userEmail,
  userRole,
  employeeTitle,
  navGroups,
  initialUnreadCount,
  initialRecentNotifications,
  initialTheme,
  children,
}: {
  userName: string;
  userEmail: string;
  userRole: string;
  employeeId: string | null;
  employeeTitle: string | null;
  navGroups: NavGroup[];
  initialUnreadCount: number;
  initialRecentNotifications: NotificationRow[];
  initialTheme: Theme;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(initialTheme);

  // Apply theme on mount + whenever it changes.
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Listen for OS theme changes when in "system" mode.
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  // Listen for cross-tab preference changes (settings page → shell sync).
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === "euroscope:theme" && e.newValue) {
        try {
          const next = JSON.parse(e.newValue) as Theme;
          if (["system", "light", "dark"].includes(next)) {
            setTheme(next);
          }
        } catch {
          // ignore malformed value
        }
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const cycleTheme = () => {
    // system → light → dark → system
    const order: Theme[] = ["system", "light", "dark"];
    const next = order[(order.indexOf(theme) + 1) % order.length];
    setTheme(next);
    // Persist via API + storage event so other tabs pick it up.
    try {
      localStorage.setItem("euroscope:theme", JSON.stringify(next));
    } catch {
      // ignore — read-only storage
    }
    void fetch("/api/employee/settings/theme", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: next }),
    }).catch(() => {
      // best-effort — the local state already reflects the change
    });
  };

  const pageTitle = derivePageTitle(pathname);

  return (
    <div className="flex min-h-dvh bg-background">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-card md:flex">
        <SidebarContent navGroups={navGroups} pathname={pathname} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} aria-hidden />
          <aside className="absolute left-0 top-0 h-dvh w-72 bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-border p-4">
              <BrandMark />
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation"
                className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-muted"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <SidebarContent navGroups={navGroups} pathname={pathname} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top header */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-card/95 px-4 backdrop-blur md:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-muted md:hidden"
          >
            <Menu className="h-5 w-5" aria-hidden />
          </button>

          {/* Breadcrumbs */}
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
            <Link href="/employee" className="text-muted-foreground hover:text-foreground">
              Employee
            </Link>
            <span className="text-muted-foreground/40">/</span>
            <span className="truncate font-medium text-foreground">{pageTitle}</span>
          </nav>

          <div className="ml-auto flex items-center gap-1.5">
            <GlobalSearch />

            <button
              onClick={cycleTheme}
              aria-label={`Toggle theme (currently ${theme})`}
              className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-muted"
            >
              {theme === "light" ? <Sun className="h-4 w-4" /> : theme === "dark" ? <Moon className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
            </button>

            <NotificationBell
              initialUnreadCount={initialUnreadCount}
              initialRecent={initialRecentNotifications}
            />

            <Link
              href="/employee/settings"
              aria-label="Help"
              className="hidden h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-muted sm:grid"
            >
              <HelpCircle className="h-4 w-4" aria-hidden />
            </Link>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-md p-1 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                    {initials(userName) || "E"}
                  </span>
                  <span className="hidden text-sm font-medium sm:inline">{userName}</span>
                  <ChevronDown className="hidden h-4 w-4 text-muted-foreground sm:inline" aria-hidden />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <div className="border-b border-border px-2 py-1.5 text-xs text-muted-foreground">
                  Signed in as <span className="font-medium text-foreground">{userEmail}</span>
                  <br />
                  <Badge tone="info" className="mt-1">{userRole}</Badge>
                  {employeeTitle && <span className="ml-2 text-xs">{employeeTitle}</span>}
                </div>
                <DropdownMenuItem asChild>
                  <Link href="/employee/profile">
                    <UserRound className="h-4 w-4" aria-hidden /> Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/employee/settings">
                    <Settings className="h-4 w-4" aria-hidden /> Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })} className="text-destructive focus:bg-destructive/10">
                  <LogOut className="h-4 w-4" aria-hidden /> Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="min-w-0 flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

function BrandMark() {
  return (
    <Link href="/employee" className="flex items-center gap-2 font-semibold" aria-label="Euroscope employee home">
      <span className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
        <Compass className="h-4 w-4" aria-hidden />
      </span>
      <span className="text-sm tracking-tight">Euroscope</span>
    </Link>
  );
}

function SidebarContent({
  navGroups,
  pathname,
  onNavigate,
}: {
  navGroups: NavGroup[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="hidden items-center justify-between border-b border-border p-4 md:flex">
        <BrandMark />
      </div>
      <nav aria-label="Employee navigation" className="flex-1 overflow-y-auto px-2 py-3">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-4">
            <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex min-h-[40px] items-center gap-2.5 rounded-md px-2.5 text-sm font-medium transition-colors",
                        active
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </div>
  );
}

function GlobalSearch() {
  const router = useRouter();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const q = (new FormData(e.currentTarget).get("q") as string)?.trim();
        if (q) router.push(`/employee/students?search=${encodeURIComponent(q)}`);
      }}
      className="hidden items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 md:flex"
    >
      <Search className="h-4 w-4 text-muted-foreground" aria-hidden />
      <input
        name="q"
        type="search"
        placeholder="Search students…"
        aria-label="Search students"
        className="w-44 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
      />
    </form>
  );
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/employee") return pathname === "/employee";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function derivePageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  // /employee/students/[id] → "Students"
  const seg = pathname.split("/")[2] ?? "";
  if (!seg) return "Dashboard";
  return seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, " ");
}

/**
 * Apply the theme to the document root. "system" follows the OS
 * prefers-color-scheme; "light" and "dark" are explicit.
 *
 * Exported separately so the settings page can reuse it for the
 * immediate-visual-feedback path before the API round-trip completes.
 */
export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else if (theme === "light") {
    root.classList.remove("dark");
  } else {
    // system — respect prefers-color-scheme
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.toggle("dark", prefersDark);
  }
}
