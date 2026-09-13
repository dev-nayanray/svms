"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { signOut } from "next-auth/react";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { NavItem, NavGroup } from "@/components/shared/sidebar-shell";
import { NavIcon } from "@/components/shared/nav-icons";
import { Button } from "@/components/ui";
import {
  Dialog,
  DialogContent,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/overlays";
import {
  Bell,
  ChevronsLeft,
  ChevronsRight,
  ExternalLink,
  LogOut,
  Menu,
  Search,
  Settings,
  Sun,
  Moon,
} from "lucide-react";

type SearchResult = {
  type: string;
  id: string;
  title: string;
  subtitle?: string;
  href: string;
};

export function AdminShell({
  items,
  navGroups,
  userName,
  userEmail,
  children,
}: {
  items: NavItem[];
  navGroups?: NavGroup[];
  userName: string;
  userEmail: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  // Detect theme on mount — use useState initializer to avoid the
  // set-state-in-effect lint rule.
  const [isDark, setIsDark] = useState(false);

  // ⌘K / Ctrl+K shortcut for global search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const { data: notif } = useQuery({
    queryKey: ["notifications", "count"],
    queryFn: () => apiFetch<{ unreadCount: number }>("/api/notifications"),
    refetchInterval: 60_000,
  });

  const { data: results } = useQuery({
    queryKey: ["search", query],
    queryFn: () =>
      apiFetch<{ data: SearchResult[] }>(`/api/search?q=${encodeURIComponent(query)}`),
    enabled: searchOpen && query.trim().length >= 2,
  });

  const crumbs = pathname.split("/").filter(Boolean);

  const toggleTheme = () => {
    const newDark = !isDark;
    setIsDark(newDark);
    document.documentElement.classList.toggle("dark", newDark);
    localStorage.setItem("svms-theme", newDark ? "dark" : "light");
  };

  const renderItem = (item: NavItem) => {
    const active = pathname === item.href || pathname.startsWith(item.href + "/");
    return (
      <Link
        key={item.href}
        href={item.href}
        title={collapsed ? item.label : undefined}
        onClick={() => setMobileOpen(false)}
        className={cn(
          "group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
          collapsed && "justify-center",
          active
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <NavIcon
          name={item.icon}
          className={cn(
            "h-4 w-4 shrink-0 transition-colors",
            active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
          )}
        />
        {!collapsed && <span className="truncate">{item.label}</span>}
      </Link>
    );
  };

  const renderNav = () => {
    // If grouped nav is provided, render with section labels
    if (navGroups && !collapsed) {
      return (
        <nav className="flex-1 overflow-y-auto px-2 py-2" aria-label="Admin navigation">
          {navGroups.map((group) => (
            <div key={group.label} className="mb-3">
              <p className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                {group.label}
              </p>
              <div className="space-y-0.5">{group.items.map(renderItem)}</div>
            </div>
          ))}
        </nav>
      );
    }
    // Flat nav (for collapsed mode or employee/student shells)
    return (
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2" aria-label="Admin navigation">
        {items.map(renderItem)}
      </nav>
    );
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-card transition-all md:flex",
          collapsed ? "w-16" : "w-56",
        )}
      >
        {/* Logo */}
        <div
          className={cn(
            "flex h-14 items-center gap-2.5 border-b border-border px-3",
            collapsed && "justify-center px-0",
          )}
        >
          <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full">
            <Image
              src="/euroscope-mark.png"
              alt="Euroscope"
              fill
              className="object-cover object-top"
            />
          </span>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-bold tracking-tight">Euroscope</p>
              <p className="truncate text-[10px] text-muted-foreground">Admin Console</p>
            </div>
          )}
        </div>

        {renderNav()}

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-2 border-t border-border px-3 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronsRight className="h-4 w-4 mx-auto" />
          ) : (
            <>
              <ChevronsLeft className="h-4 w-4" />
              Collapse
            </>
          )}
        </button>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-64 border-r border-border bg-card">
            <div className="flex h-14 items-center gap-2.5 border-b border-border px-3">
              <span className="relative h-8 w-8 overflow-hidden rounded-full">
                <Image
                  src="/euroscope-mark.png"
                  alt="Euroscope"
                  fill
                  className="object-cover object-top"
                />
              </span>
              <div>
                <p className="text-sm font-bold">Euroscope</p>
                <p className="text-[10px] text-muted-foreground">Admin Console</p>
              </div>
            </div>
            {renderNav()}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/80 px-4 backdrop-blur-md">
          {/* Mobile menu */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            aria-expanded={mobileOpen}
          >
            <Menu className="h-5 w-5" />
          </Button>

          {/* Breadcrumbs */}
          <nav
            aria-label="Breadcrumb"
            className="hidden min-w-0 items-center gap-1.5 text-xs text-muted-foreground sm:flex"
          >
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-muted-foreground/40">/</span>}
                <span
                  className={cn(
                    "capitalize",
                    i === crumbs.length - 1 && "font-medium text-foreground",
                  )}
                >
                  {decodeURIComponent(c).replace(/-/g, " ")}
                </span>
              </span>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1">
            {/* Global search trigger */}
            <button
              onClick={() => setSearchOpen(true)}
              className="flex h-9 items-center gap-2 rounded-md border border-border bg-muted/50 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Search"
            >
              <Search className="h-3.5 w-3.5" aria-hidden />
              <span className="hidden md:inline">Search…</span>
              <kbd className="hidden items-center gap-0.5 rounded border border-border bg-card px-1 py-0.5 text-[10px] font-medium md:flex">
                ⌘K
              </kbd>
            </button>

            {/* View marketing site — opens the public Euroscope
                marketing site in a new tab. The ?preview=1 param
                bypasses the authenticated-user redirect so admins
                can see the full marketing homepage with the hero. */}
            <Link
              href="/?preview=1"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted sm:flex"
              aria-label="View marketing site (opens in new tab)"
              title="View marketing site"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              <span className="hidden lg:inline">View Site</span>
            </Link>

            {/* Theme toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              aria-label="Toggle dark mode"
              className="text-muted-foreground hover:text-foreground"
            >
              {isDark ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
            </Button>

            {/* Notifications */}
            <Link
              href="/admin/notifications"
              className="relative grid h-9 w-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label={`Notifications${notif?.unreadCount ? ` (${notif.unreadCount} unread)` : ""}`}
            >
              <Bell className="h-4 w-4" aria-hidden />
              {!!notif?.unreadCount && (
                <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                  {notif.unreadCount > 9 ? "9+" : notif.unreadCount}
                </span>
              )}
            </Link>

            {/* User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-muted"
                  aria-label="User menu"
                >
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {userName.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="hidden max-w-32 truncate text-sm font-medium lg:inline">
                    {userName}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <div className="border-b border-border px-2 py-1.5">
                  <p className="truncate text-sm font-medium">{userName}</p>
                  <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
                </div>
                <DropdownMenuItem onSelect={() => router.push("/admin/settings")}>
                  <Settings className="h-4 w-4" aria-hidden /> Settings
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => window.open("/?preview=1", "_blank", "noopener,noreferrer")}
                >
                  <ExternalLink className="h-4 w-4" aria-hidden /> View Marketing Site
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => signOut({ callbackUrl: "/login" })}
                  className="text-destructive"
                >
                  <LogOut className="h-4 w-4" aria-hidden /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 p-4 md:p-6">
          <div className="mx-auto w-full max-w-[1400px] space-y-6">{children}</div>
        </main>
      </div>

      {/* Global search dialog */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent title="" className="max-w-xl p-0">
          {/* Search input */}
          <div className="border-b border-border">
            <div className="flex items-center gap-2 px-4 py-3">
              <Search className="h-4 w-4 text-muted-foreground" aria-hidden />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search students, applications, universities, leads, invoices…"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
                aria-label="Search query"
              />
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                ESC
              </kbd>
            </div>
          </div>

          {/* Results */}
          <div className="max-h-96 overflow-y-auto">
            {query.trim().length < 2 && (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                Type at least 2 characters to search.
              </p>
            )}
            {query.trim().length >= 2 &&
              (results?.data ?? []).map((r) => (
                <button
                  key={`${r.type}-${r.id}`}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-muted"
                  onClick={() => {
                    setSearchOpen(false);
                    router.push(r.href);
                  }}
                >
                  <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {r.type}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{r.title}</span>
                    {r.subtitle && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {r.subtitle}
                      </span>
                    )}
                  </span>
                </button>
              ))}
            {query.trim().length >= 2 && (results?.data ?? []).length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                No results for &ldquo;{query}&rdquo;.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
