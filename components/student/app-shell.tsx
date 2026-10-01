"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { signOut } from "next-auth/react";
import { ArrowLeft, ChevronRight, Search, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";
import { APP_NAME } from "@/lib/constants/app";
import { STUDENT_TABS, isActivePath } from "@/config/student-nav";
import { StudentNavIcon, NotificationBadge } from "@/components/student/ui";
import { OfflineBanner } from "@/components/pwa/offline-banner";
import { LiveIndicator, useRealtime } from "@/components/student/realtime-provider";
import { GlobalSearchOverlay } from "@/components/student/search/global-search-overlay";

const TAB_ICONS: Record<string, string> = Object.fromEntries(STUDENT_TABS.map((t) => [t.href, t.icon]));

/**
 * Helper for the "/" keyboard shortcut — returns true if the user is
 * currently focused on an input, textarea, or contenteditable element.
 */
function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if ((el as HTMLElement).isContentEditable) return true;
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
  "/student/design-preview": "Design System",
  "/student/assistant": "AI Assistant",
};

function pageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (pathname.startsWith("/student/applications")) return "My Application";
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchInstance, setSearchInstance] = useState(0);
  const isHome = pathname === "/student" || pathname.startsWith("/student/dashboard");

  // Keyboard shortcut: Cmd/Ctrl+K opens the global search overlay.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        openSearch();
        return;
      }
      if (e.key === "/" && !isInputFocused()) {
        e.preventDefault();
        openSearch();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function openSearch() {
    setSearchInstance((n) => n + 1);
    setSearchOpen(true);
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <OfflineBanner />

      {/* ── Global search overlay ── */}
      <GlobalSearchOverlay key={searchInstance} open={searchOpen} onOpenChange={setSearchOpen} />

      {/* ── Mobile header — clean, minimal ── */}
      <header
        className={cn(
          "sticky top-0 z-30 border-b border-border/60 bg-card/80 backdrop-blur-xl supports-[backdrop-filter]:bg-card/80",
        )}
      >
        <div
          className="flex h-14 items-center gap-2 px-3"
          style={{ paddingTop: "max(env(safe-area-inset-top), 0px)" }}
        >
          {!isHome ? (
            <button
              onClick={() => router.back()}
              aria-label="Go back"
              className="grid h-10 w-10 place-items-center rounded-xl text-muted-foreground transition-all hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary active:scale-95"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          ) : (
            <Link
              href="/student"
              aria-label="Home"
              className="group flex items-center gap-2.5 rounded-xl transition-all focus-visible:outline-2 focus-visible:outline-primary"
            >
              <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg">
                <Image
                  src="/euroscope-mark.png"
                  alt="Euroscope"
                  fill
                  sizes="36px"
                  className="object-contain"
                />
              </span>
              <span className="flex flex-col leading-none">
                <span className="text-sm font-bold tracking-tight">{APP_NAME}</span>
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

          {/* Search button — desktop only on mobile header, icon on desktop */}
          <button
            onClick={openSearch}
            aria-label="Search (Cmd+K)"
            className="grid h-10 w-10 place-items-center rounded-xl text-muted-foreground transition-all hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary active:scale-95"
          >
            <Search className="h-5 w-5" />
          </button>
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
            onSearchOpen={openSearch}
            onSignOut={() => signOut({ callbackUrl: "/login" })}
          />
        </aside>

        <main id="main-content" className="app-page-enter min-w-0 flex-1 px-4 py-4 md:p-6 pb-24 md:pb-6">{children}</main>
      </div>

      {/* ── Mobile bottom navigation — 5 tabs, no "More" button ── */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur-lg supports-[backdrop-filter]:bg-card/90 md:hidden"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0px)" }}
      >
        <ul className="mx-auto flex max-w-md items-stretch justify-around">
          {STUDENT_TABS.map((tab) => {
            const active = isActivePath(pathname, tab.href);
            const showBadge = tab.href === "/student/notifications" && unread > 0;
            return (
              <li key={tab.href} className="flex-1">
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  aria-label={tab.label}
                  className={cn(
                    "relative flex min-h-[56px] flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-semibold transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <span className={cn(
                    "relative grid h-8 w-8 place-items-center rounded-xl transition-all duration-200",
                    active ? "bg-primary/15 scale-105" : "",
                  )}>
                    <StudentNavIcon name={TAB_ICONS[tab.href]} className="h-5 w-5" />
                    {showBadge && (
                      <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
                        {unread > 9 ? "9+" : unread}
                      </span>
                    )}
                  </span>
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

function DesktopNav({
  pathname,
  unread,
  userName,
  profilePhotoUrl,
  onSearchOpen,
  onSignOut,
}: {
  pathname: string;
  unread: number;
  userName: string;
  profilePhotoUrl?: string | null;
  onSearchOpen: () => void;
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

  // Group nav items into logical sections so the sidebar is scannable
  // instead of a flat 15-item list. Each group has a small uppercase label.
  const navGroups: { label: string; items: { href: string; label: string; icon: string }[] }[] = [
    {
      label: "Main",
      items: [
        { href: "/student", label: "Home", icon: "House" },
        { href: "/student/universities", label: "Universities", icon: "Building2" },
        { href: "/student/courses", label: "Courses", icon: "BookOpen" },
      ],
    },
    {
      label: "Application",
      items: [
        { href: "/student/applications", label: "My Application", icon: "FolderKanban" },
        { href: "/student/documents", label: "Documents", icon: "FileText" },
        { href: "/student/visa", label: "Visa", icon: "Stamp" },
        { href: "/student/tasks", label: "Tasks", icon: "CheckSquare" },
        { href: "/student/appointments", label: "Appointments", icon: "CalendarClock" },
      ],
    },
    {
      label: "Communication",
      items: [
        { href: "/student/messages", label: "Messages", icon: "MessageSquare" },
        { href: "/student/notifications", label: "Notifications", icon: "Bell" },
        { href: "/student/support", label: "Support", icon: "LifeBuoy" },
      ],
    },
    {
      label: "Account",
      items: [
        { href: "/student/payments", label: "Payments", icon: "CreditCard" },
        { href: "/student/invoices", label: "Invoices", icon: "Receipt" },
        { href: "/student/profile", label: "Profile", icon: "UserRound" },
        { href: "/student/settings", label: "Settings", icon: "Settings" },
      ],
    },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* ── Top section — search + user card ── */}
      <div className="border-b border-border/60 p-3">
        <button
          type="button"
          onClick={onSearchOpen}
          className="group mb-2 flex h-9 w-full items-center gap-2 rounded-lg border border-border bg-card/60 px-2.5 text-sm text-muted-foreground transition-all hover:border-primary/30 hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-primary"
          aria-label="Search (Cmd+K)"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate text-left text-xs font-medium">
            Search…
          </span>
          <kbd className="hidden shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground lg:inline">
            ⌘K
          </kbd>
        </button>

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

      {/* ── Nav items — grouped by category ── */}
      <nav aria-label="Student navigation" className="flex-1 overflow-y-auto px-2 py-2">
        {navGroups.map((group, gi) => (
          <div key={group.label} className={gi > 0 ? "mt-4" : ""}>
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActivePath(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group relative flex min-h-[36px] items-center gap-2.5 rounded-lg px-3 text-sm font-medium transition-all",
                      active
                        ? "bg-primary/10 font-semibold text-primary"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    )}
                  >
                    {active && (
                      <span
                        aria-hidden
                        className="absolute -left-2 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-primary"
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
            </div>
          </div>
        ))}
      </nav>

      {/* ── Footer — sign out ── */}
      <div className="border-t border-border/60 p-2">
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
