"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { signOut } from "next-auth/react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowLeft, Bell, ChevronRight, Grid3x3, LogOut, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";
import { APP_NAME } from "@/lib/constants/app";
import { STUDENT_TABS, STUDENT_MORE, isActivePath } from "@/config/student-nav";
import { StudentNavIcon, NotificationBadge } from "@/components/student/ui";
import { OfflineBanner } from "@/components/pwa/offline-banner";
import { LiveIndicator, useRealtime } from "@/components/student/realtime-provider";
import { GlobalSearchOverlay } from "@/components/student/search/global-search-overlay";

const TAB_ICONS: Record<string, string> = Object.fromEntries(STUDENT_TABS.map((t) => [t.href, t.icon]));
const MORE_ICONS: Record<string, string> = Object.fromEntries(STUDENT_MORE.map((t) => [t.href, t.icon]));

/**
 * Helper for the "/" keyboard shortcut — returns true if the user is
 * currently focused on an input, textarea, or contenteditable element.
 * When true, we DON'T trigger the search overlay (because the user is
 * probably typing something else, and intercepting "/" would delete
 * their typed character).
 */
function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if (el.isContentEditable) return true;
  return false;
}

const PAGE_TITLES: Record<string, string> = {
  "/student/profile": "Profile",
  "/student/applications": "My Application",
  "/student/documents": "Documents",
  "/student/universities": "Universities",
  "/student/courses": "Courses",
  "/student/visa": "Visa",
  "/student/tasks": "Tasks",
  "/student/payments": "Payments",
  "/student/invoices": "Invoices",
  "/student/messages": "Messages",
  "/student/notifications": "Notifications",
  "/student/appointments": "Appointments",
  "/student/support": "Support",
  "/student/settings": "Settings",
};

function pageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (pathname.startsWith("/student/applications")) return "My Application";
  if (pathname.startsWith("/student/documents")) return "Documents";
  if (pathname.startsWith("/student/")) {
    const seg = pathname.split("/")[2] ?? "";
    return seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, " ");
  }
  return APP_NAME;
}

function useUnreadCount() {
  const { data } = useQuery({
    queryKey: ["student-notifications", "unread"],
    queryFn: () => apiFetch<{ unreadCount: number }>("/api/notifications"),
    refetchInterval: 120_000,
  });
  return data?.unreadCount ?? 0;
}

export function StudentAppShell({
  userName,
  profilePhotoUrl,
  children,
}: {
  userName: string;
  profilePhotoUrl?: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const unread = useUnreadCount();
  const { status: realtimeStatus } = useRealtime();
  const [moreOpen, setMoreOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const isHome = pathname === "/student" || pathname.startsWith("/student/dashboard");
  const isMoreActive = STUDENT_MORE.some((m) => isActivePath(pathname, m.href));

  // Keyboard shortcut: Cmd/Ctrl+K opens the global search overlay.
  // Esc is handled by Radix Dialog automatically. We only register
  // the listener once on mount and check for the modifier key on each
  // keydown to avoid the cost of adding + removing listeners per render.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Cmd/Ctrl+K — open search
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
        return;
      }
      // Forward-slash opens search when not focused in an input —
      // the GitHub / Linear / Notion pattern. Catches users mid-flow.
      if (e.key === "/" && !isInputFocused()) {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const initials = userName
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // Online status for the avatar dot — green when SSE is live,
  // amber when reconnecting, hidden when offline.
  const isOnline = realtimeStatus === "live";
  const isReconnecting = realtimeStatus === "connecting" || realtimeStatus === "reconnecting";

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <OfflineBanner />

      {/* ── Global search overlay ── */}
      <GlobalSearchOverlay open={searchOpen} onOpenChange={setSearchOpen} />

      {/* ── Mobile header — premium glassmorphism + gradient brand ── */}
      <header
        className={cn(
          "sticky top-0 z-30 border-b backdrop-blur-xl supports-[backdrop-filter]:bg-card/80",
          isHome
            ? "border-border/60 bg-gradient-to-r from-primary/5 via-card/80 to-info/5"
            : "border-border/60 bg-card/80",
        )}
      >
        {/* Top accent line — subtle gradient strip that catches the eye */}
        <div
          aria-hidden
          className={cn(
            "absolute inset-x-0 top-0 h-px bg-gradient-to-r opacity-60",
            isHome
              ? "from-primary via-info to-primary"
              : "from-transparent via-border to-transparent",
          )}
        />
        <div
          className="flex h-14 items-center gap-2 px-3"
          style={{ paddingTop: "max(env(safe-area-inset-top), 0px)" }}
        >
          {!isHome ? (
            <button
              onClick={() => router.back()}
              aria-label="Go back"
              className="group grid h-10 w-10 place-items-center rounded-xl text-muted-foreground transition-all hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary active:scale-95"
            >
              <ArrowLeft className="h-5 w-5 transition-transform group-hover:-translate-x-0.5" />
            </button>
          ) : (
            <Link
              href="/student"
              aria-label="Home"
              className="group flex items-center gap-2.5 rounded-xl transition-all focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.98]"
            >
              <span className="relative grid h-9 w-9 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-primary to-info shadow-sm ring-1 ring-primary/20 transition-transform group-hover:scale-105">
                <Image
                  src="/euroscope-mark.png"
                  alt="Euroscope"
                  fill
                  className="object-cover object-top p-1.5"
                />
              </span>
              <span className="flex flex-col leading-none">
                <span className="bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-sm font-bold tracking-tight text-transparent">
                  {APP_NAME}
                </span>
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Student
                </span>
              </span>
            </Link>
          )}

          <h1 className="min-w-0 flex-1 truncate text-center text-base font-bold tracking-tight md:text-left">
            {isHome ? (
              <span className="sr-only">{APP_NAME}</span>
            ) : (
              <span className="truncate">{pageTitle(pathname)}</span>
            )}
          </h1>

          {/* ── Search button — opens the global search overlay ── */}
          <button
            onClick={() => setSearchOpen(true)}
            aria-label="Search (Cmd+K)"
            className="group grid h-10 w-10 place-items-center rounded-xl text-muted-foreground transition-all hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary active:scale-95"
          >
            <Search className="h-5 w-5 transition-transform group-hover:scale-110" />
          </button>

          {/* Live indicator — premium pill, hidden on very narrow screens */}
          <span className="hidden sm:inline-flex">
            <LiveIndicator />
          </span>

          {/* Notifications bell with hover lift + ring */}
          <Link
            href="/student/notifications"
            aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
            className="group relative grid h-10 w-10 place-items-center rounded-xl text-muted-foreground transition-all hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary active:scale-95"
          >
            <Bell className="h-5 w-5 transition-transform group-hover:rotate-6 group-hover:scale-105" />
            <NotificationBadge count={unread} />
          </Link>

          {/* Profile avatar with online status dot */}
          <Link
            href="/student/profile"
            aria-label="Profile"
            className="group relative grid h-10 w-10 place-items-center rounded-full transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-95"
          >
            {profilePhotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profilePhotoUrl}
                alt={userName}
                className="h-8 w-8 rounded-full object-cover ring-2 ring-card transition-shadow group-hover:ring-primary/40"
              />
            ) : (
              <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-primary/20 to-info/20 text-xs font-bold text-primary ring-2 ring-card transition-shadow group-hover:ring-primary/40">
                {initials || "S"}
              </span>
            )}
            {/* Online status dot — emerald when SSE is live, amber when
                reconnecting, hidden when offline. */}
            {(isOnline || isReconnecting) && (
              <span
                aria-hidden
                className={cn(
                  "absolute -bottom-0.5 -right-0.5 grid h-3 w-3 place-items-center rounded-full ring-2 ring-card",
                  isOnline ? "bg-emerald-500" : "bg-amber-500",
                )}
              >
                {/* Subtle ping when reconnecting to indicate "working on it" */}
                {isReconnecting && (
                  <span className="absolute inset-0 animate-ping rounded-full bg-amber-500 opacity-75 motion-reduce:hidden" />
                )}
                <span className={cn("h-1.5 w-1.5 rounded-full", isOnline ? "bg-emerald-300" : "bg-amber-300")} />
              </span>
            )}
          </Link>
        </div>
      </header>

      <div className="flex flex-1">
        {/* ── Desktop sidebar ── */}
        <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-60 shrink-0 flex-col border-r border-border/60 bg-card/50 backdrop-blur-sm md:flex">
          <DesktopNav
            pathname={pathname}
            unread={unread}
            userName={userName}
            profilePhotoUrl={profilePhotoUrl}
            onSignOut={() => signOut({ callbackUrl: "/login" })}
          />
        </aside>

        <main id="main-content" className="app-page-enter min-w-0 flex-1 px-4 py-4 md:p-6">{children}</main>
      </div>

      {/* ── Mobile bottom navigation ── */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur-lg supports-[backdrop-filter]:bg-card/90 md:hidden"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0px)" }}
      >
        <ul className="mx-auto flex max-w-md items-stretch justify-around">
          {STUDENT_TABS.map((tab) => {
            const active = isActivePath(pathname, tab.href);
            return (
              <li key={tab.href} className="flex-1">
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex min-h-[58px] flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-semibold transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <span className={cn(
                    "grid h-8 w-8 place-items-center rounded-xl transition-all duration-200",
                    active ? "bg-primary/15 scale-105" : "",
                  )}>
                    <StudentNavIcon name={TAB_ICONS[tab.href]} className="h-5 w-5" />
                  </span>
                  {tab.label}
                </Link>
              </li>
            );
          })}
          {/* More button — consistent with other tabs */}
          <li className="flex-1">
            <button
              onClick={() => setMoreOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              className={cn(
                "relative flex min-h-[58px] w-full flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-semibold transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary",
                isMoreActive ? "text-primary" : "text-muted-foreground",
              )}
            >
              <span className={cn(
                "grid h-8 w-8 place-items-center rounded-xl transition-all duration-200",
                isMoreActive ? "bg-primary/15 scale-105" : "",
              )}>
                <Grid3x3 className="h-5 w-5" aria-hidden />
              </span>
              More
            </button>
          </li>
        </ul>
      </nav>

      {/* ── More bottom sheet ── */}
      <DialogPrimitive.Root open={moreOpen} onOpenChange={setMoreOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />
          <DialogPrimitive.Content
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t border-border bg-card pb-[max(env(safe-area-inset-bottom),0.75rem)] shadow-2xl focus:outline-none"
            style={{ maxHeight: "80dvh" }}
          >
            {/* Drag handle */}
            <div aria-hidden className="mx-auto mt-3 h-1 w-10 rounded-full bg-muted-foreground/30" />

            <DialogPrimitive.Title className="px-4 pb-1 pt-3 text-lg font-bold tracking-tight">More</DialogPrimitive.Title>

            <div className="max-h-[60dvh] overflow-y-auto px-3 pb-3">
              {/* Grid of navigation items */}
              <div className="grid grid-cols-3 gap-2 py-2">
                {STUDENT_MORE.filter((m) => m.href !== "/student/notifications").map((item) => {
                  const active = isActivePath(pathname, item.href);
                  return (
                    <DialogPrimitive.Close asChild key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex flex-col items-center gap-2 rounded-2xl border p-3 text-center transition-all hover:-translate-y-0.5 hover:shadow-sm",
                          active
                            ? "border-primary/30 bg-primary/5 text-primary"
                            : "border-border bg-muted/30 text-foreground hover:bg-muted/50",
                        )}
                      >
                        <span className={cn(
                          "grid h-10 w-10 place-items-center rounded-xl",
                          active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                        )}>
                          <StudentNavIcon name={MORE_ICONS[item.href]} className="h-5 w-5" />
                        </span>
                        <span className="text-xs font-semibold leading-tight">{item.label}</span>
                      </Link>
                    </DialogPrimitive.Close>
                  );
                })}
              </div>

              {/* Logout */}
              <div className="mt-2 border-t border-border pt-2">
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-destructive hover:bg-destructive/10 focus-visible:outline-2 focus-visible:outline-destructive"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-destructive/10">
                    <LogOut className="h-4 w-4" aria-hidden />
                  </span>
                  Log out
                </button>
              </div>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </div>
  );
}

function DesktopNav({
  pathname,
  unread,
  userName,
  profilePhotoUrl,
  onSignOut,
}: {
  pathname: string;
  unread: number;
  userName: string;
  profilePhotoUrl?: string | null;
  onSignOut: () => void;
}) {
  const { status: realtimeStatus } = useRealtime();
  const isOnline = realtimeStatus === "live";
  const isReconnecting = realtimeStatus === "connecting" || realtimeStatus === "reconnecting";

  const initials = userName
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const items = [
    ...STUDENT_TABS.map((t) => ({ href: t.href, label: t.label, icon: t.icon })),
    ...STUDENT_MORE.map((t) => ({ href: t.href, label: t.label, icon: t.icon })),
  ];

  return (
    <div className="flex h-full flex-col">
      {/* ── Premium top section — brand + avatar + name ── */}
      <div className="border-b border-border/60 p-3">
        <Link
          href="/student"
          aria-label="Home"
          className="group mb-3 flex items-center gap-2.5 rounded-xl transition-all hover:bg-muted/50 active:scale-[0.98]"
        >
          <span className="relative grid h-9 w-9 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-primary to-info shadow-sm ring-1 ring-primary/20 transition-transform group-hover:scale-105">
            <Image
              src="/euroscope-mark.png"
              alt="Euroscope"
              fill
              className="object-cover object-top p-1.5"
            />
          </span>
          <span className="flex flex-col leading-none">
            <span className="bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-sm font-bold tracking-tight text-transparent">
              {APP_NAME}
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Student Portal
            </span>
          </span>
        </Link>

        {/* User card — avatar + name + live indicator */}
        <Link
          href="/student/profile"
          className="group flex items-center gap-2.5 rounded-xl border border-border/60 bg-card/60 p-2 transition-all hover:border-primary/30 hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-primary"
        >
          <span className="relative">
            {profilePhotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profilePhotoUrl}
                alt={userName}
                className="h-9 w-9 rounded-full object-cover ring-2 ring-card transition-shadow group-hover:ring-primary/40"
              />
            ) : (
              <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-primary/20 to-info/20 text-xs font-bold text-primary ring-2 ring-card transition-shadow group-hover:ring-primary/40">
                {initials || "S"}
              </span>
            )}
            {/* Online status dot */}
            {(isOnline || isReconnecting) && (
              <span
                aria-hidden
                className={cn(
                  "absolute -bottom-0.5 -right-0.5 grid h-3 w-3 place-items-center rounded-full ring-2 ring-card",
                  isOnline ? "bg-emerald-500" : "bg-amber-500",
                )}
              >
                {isReconnecting && (
                  <span className="absolute inset-0 animate-ping rounded-full bg-amber-500 opacity-75 motion-reduce:hidden" />
                )}
                <span className={cn("h-1.5 w-1.5 rounded-full", isOnline ? "bg-emerald-300" : "bg-amber-300")} />
              </span>
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-tight">{userName}</p>
            <div className="mt-0.5 flex items-center gap-1.5">
              <LiveIndicator showLabel={false} />
              <span className="text-[10px] text-muted-foreground">
                {isOnline ? "Online" : isReconnecting ? "Reconnecting…" : "Offline"}
              </span>
            </div>
          </div>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      {/* ── Nav items with gradient active state ── */}
      <nav aria-label="Student navigation" className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {items.map((item) => {
          const active = isActivePath(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex min-h-[40px] items-center gap-2.5 rounded-lg px-3 text-sm font-medium transition-all",
                active
                  ? "bg-gradient-to-r from-primary/15 to-info/10 font-semibold text-primary"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              {/* Active accent bar on the left */}
              {active && (
                <span
                  aria-hidden
                  className="absolute -left-2 top-1/2 h-6 w-1 -translate-y-1/2 rounded-full bg-gradient-to-b from-primary to-info"
                />
              )}
              <span className="relative shrink-0">
                <StudentNavIcon
                  name={item.icon}
                  className={cn(
                    "h-4 w-4 transition-transform",
                    active ? "scale-110" : "group-hover:scale-105",
                  )}
                />
                {item.href === "/student/notifications" && <NotificationBadge count={unread} />}
              </span>
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* ── Footer with live indicator + sign out ── */}
      <div className="border-t border-border/60 p-2">
        <div className="mb-1 hidden items-center justify-between px-2 text-[10px] uppercase tracking-wider text-muted-foreground">
          <span>Account</span>
        </div>
        <button
          onClick={onSignOut}
          className="flex min-h-[40px] w-full items-center gap-2.5 rounded-lg px-3 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-2 focus-visible:outline-destructive"
        >
          <LogOut className="h-4 w-4" aria-hidden />
          Log out
        </button>
      </div>
    </div>
  );
}
