"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { signOut } from "next-auth/react";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/components/shared/sidebar-shell";
import { Button } from "@/components/ui";
import { Dialog, DialogContent, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/overlays";
import { Bell, ChevronsLeft, ChevronsRight, LogOut, Menu, PanelLeft, Search, Settings, User } from "lucide-react";

type SearchResult = { type: string; id: string; title: string; subtitle?: string; href: string };

export function AdminShell({
  items,
  userName,
  userEmail,
  children,
}: {
  items: NavItem[];
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

  const { data: notif } = useQuery({
    queryKey: ["notifications", "count"],
    queryFn: () => apiFetch<{ unreadCount: number }>("/api/notifications"),
    refetchInterval: 60_000,
  });

  const { data: results } = useQuery({
    queryKey: ["search", query],
    queryFn: () => apiFetch<{ data: SearchResult[] }>(`/api/search?q=${encodeURIComponent(query)}`),
    enabled: searchOpen && query.trim().length >= 2,
  });

  const crumbs = pathname.split("/").filter(Boolean);

  const nav = (
    <nav className="flex-1 space-y-0.5 overflow-y-auto p-2" aria-label="Admin navigation">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              collapsed && "justify-center px-2",
              active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" aria-hidden />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden shrink-0 flex-col border-r border-border bg-card transition-all md:flex",
          collapsed ? "w-16" : "w-60"
        )}
      >
        <div className={cn("flex h-14 items-center gap-2 border-b border-border px-4 font-semibold", collapsed && "justify-center px-2")}>
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary text-sm text-primary-foreground">SV</span>
          {!collapsed && <span className="truncate">SVMS Admin</span>}
        </div>
        {nav}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-2 border-t border-border p-3 text-xs font-medium text-muted-foreground hover:text-foreground"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronsRight className="h-4 w-4 mx-auto" /> : <><ChevronsLeft className="h-4 w-4" /> Collapse</>}
        </button>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 border-r border-border bg-card">
            <div className="flex h-14 items-center gap-2 border-b border-border px-4 font-semibold">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-primary text-sm text-primary-foreground">SV</span>
              SVMS Admin
            </div>
            {nav}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-card px-4">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation" aria-expanded={mobileOpen}>
            <Menu className="h-5 w-5" />
          </Button>

          {/* Breadcrumbs */}
          <nav aria-label="Breadcrumb" className="hidden min-w-0 text-xs text-muted-foreground sm:block">
            <ol className="flex items-center gap-1">
              {crumbs.map((c, i) => (
                <li key={i} className="flex items-center gap-1">
                  {i > 0 && <span aria-hidden>/</span>}
                  <span className={cn("capitalize", i === crumbs.length - 1 && "font-medium text-foreground")}>
                    {decodeURIComponent(c).replace(/-/g, " ")}
                  </span>
                </li>
              ))}
            </ol>
          </nav>

          <div className="ml-auto flex items-center gap-1.5">
            {/* Global search */}
            <Button variant="outline" size="sm" onClick={() => setSearchOpen(true)} className="gap-2">
              <Search className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Search…</span>
            </Button>

            {/* Notifications */}
            <Link
              href="/admin/notifications"
              className="relative grid h-9 w-9 place-items-center rounded-md hover:bg-muted"
              aria-label={`Notifications${notif?.unreadCount ? ` (${notif.unreadCount} unread)` : ""}`}
            >
              <Bell className="h-4 w-4" aria-hidden />
              {!!notif?.unreadCount && (
                <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
                  {notif.unreadCount > 9 ? "9+" : notif.unreadCount}
                </span>
              )}
            </Link>

            {/* User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted" aria-label="User menu">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                    {userName.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="hidden max-w-32 truncate text-sm font-medium lg:inline">{userName}</span>
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
                <DropdownMenuItem onSelect={() => signOut({ callbackUrl: "/login" })} className="text-destructive">
                  <LogOut className="h-4 w-4" aria-hidden /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6">
          <div className="mx-auto w-full max-w-7xl space-y-6">{children}</div>
        </main>
      </div>

      {/* Global search dialog */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent title="Global search" className="max-w-xl">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search students, applications, universities, leads, invoices…"
            className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
            aria-label="Search query"
          />
          <ul className="mt-3 max-h-80 divide-y divide-border overflow-y-auto rounded-md border border-border">
            {query.trim().length >= 2 &&
              (results?.data ?? []).map((r) => (
                <li key={`${r.type}-${r.id}`}>
                  <button
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
                    onClick={() => {
                      setSearchOpen(false);
                      router.push(r.href);
                    }}
                  >
                    <span>
                      <span className="font-medium">{r.title}</span>
                      {r.subtitle && <span className="text-muted-foreground"> · {r.subtitle}</span>}
                    </span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{r.type}</span>
                  </button>
                </li>
              ))}
            {query.trim().length >= 2 && (results?.data ?? []).length === 0 && (
              <li className="px-3 py-4 text-center text-sm text-muted-foreground">No results for “{query}”.</li>
            )}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export { PanelLeft, User };
