"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { signOut } from "next-auth/react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowLeft, Bell, ChevronRight, LogOut, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";
import { APP_NAME } from "@/lib/constants/app";
import { STUDENT_TABS, STUDENT_MORE, isActivePath } from "@/config/student-nav";
import { StudentNavIcon, NotificationBadge } from "@/components/student/ui";
import { OfflineBanner } from "@/components/pwa/offline-banner";
import { LiveIndicator } from "@/components/student/realtime-provider";

const TAB_ICONS: Record<string, string> = Object.fromEntries(STUDENT_TABS.map((t) => [t.href, t.icon]));
const MORE_ICONS: Record<string, string> = Object.fromEntries(STUDENT_MORE.map((t) => [t.href, t.icon]));

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
    // Real-time updates arrive via SSE (StudentRealtimeProvider).
    // 120s fallback polling in case SSE has a prolonged disconnect.
    refetchInterval: 120_000,
  });
  return data?.unreadCount ?? 0;
}

export function StudentAppShell({
  userName,
  children,
}: {
  userName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const unread = useUnreadCount();
  const [moreOpen, setMoreOpen] = useState(false);
  const isHome = pathname === "/student" || pathname.startsWith("/student/dashboard");

  const initials = userName
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <OfflineBanner />

      {/* Mobile header */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div
          className="flex h-14 items-center gap-2 px-3 pt-[env(safe-area-inset-top)]"
          style={{ paddingTop: "max(env(safe-area-inset-top), 0px)" }}
        >
          {!isHome ? (
            <button
              onClick={() => router.back()}
              aria-label="Go back"
              className="grid h-11 w-11 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          ) : (
            <Link href="/student" aria-label="Home" className="grid h-11 w-11 place-items-center rounded-md md:hidden">
              <span className="relative h-8 w-8 overflow-hidden rounded-full">
                <Image
                  src="/euroscope-mark.png"
                  alt="Euroscope"
                  fill
                  className="object-cover object-top"
                />
              </span>
            </Link>
          )}

          <h1 className="min-w-0 flex-1 truncate text-center text-base font-semibold md:text-left">
            {isHome ? <span className="hidden md:inline">{APP_NAME}</span> : pageTitle(pathname)}
            <span className="md:hidden">{isHome ? APP_NAME : pageTitle(pathname)}</span>
          </h1>

          {/* Live indicator — shows real-time connection status (desktop only) */}
          <LiveIndicator />

          <Link
            href="/student/notifications"
            aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
            className="relative grid h-11 w-11 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
          >
            <Bell className="h-5 w-5" />
            <NotificationBadge count={unread} />
          </Link>
          <Link
            href="/student/profile"
            aria-label="Profile"
            className="grid h-11 w-11 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
              {initials || "S"}
            </span>
          </Link>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Desktop compact sidebar */}
        <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-56 shrink-0 flex-col border-r border-border bg-card p-2 md:flex">
          <DesktopNav pathname={pathname} unread={unread} onSignOut={() => signOut({ callbackUrl: "/login" })} />
        </aside>

        <main id="main-content" className="app-page-enter min-w-0 flex-1 px-4 py-4 md:p-6">{children}</main>
      </div>

      {/* Mobile bottom navigation */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur md:hidden"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0px)" }}
      >
        <ul className="flex items-stretch justify-around">
          {STUDENT_TABS.map((tab) => {
            const active = isActivePath(pathname, tab.href);
            return (
              <li key={tab.href} className="flex-1">
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex min-h-[56px] flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[11px] font-medium focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary",
                    active ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  <span className="relative">
                    <StudentNavIcon name={TAB_ICONS[tab.href]} className="h-5 w-5" />
                  </span>
                  {tab.label}
                  {active && <span aria-hidden className="absolute top-0 h-0.5 w-8 rounded-full bg-primary" />}
                </Link>
              </li>
            );
          })}
          <li className="flex-1">
            <button
              onClick={() => setMoreOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              className={cn(
                "flex min-h-[56px] w-full flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[11px] font-medium focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary",
                STUDENT_MORE.some((m) => isActivePath(pathname, m.href)) ? "text-primary" : "text-muted-foreground"
              )}
            >
              <MoreHorizontal className="h-5 w-5" aria-hidden />
              More
            </button>
          </li>
        </ul>
      </nav>

      {/* More bottom sheet */}
      <DialogPrimitive.Root open={moreOpen} onOpenChange={setMoreOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/50" />
          <DialogPrimitive.Content
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-border bg-card pb-[max(env(safe-area-inset-bottom),0.75rem)] shadow-xl focus:outline-none"
            style={{ maxHeight: "80dvh" }}
          >
            <div aria-hidden className="mx-auto mt-2 h-1 w-10 rounded-full bg-muted" />
            <DialogPrimitive.Title className="px-4 pb-2 pt-3 text-base font-semibold">More</DialogPrimitive.Title>
            <div className="max-h-[60dvh] overflow-y-auto px-2 pb-2">
              <ul>
                {STUDENT_MORE.filter((m) => m.href !== "/student/notifications").map((item) => {
                  const active = isActivePath(pathname, item.href);
                  return (
                    <li key={item.href}>
                      <DialogPrimitive.Close asChild>
                        <Link
                          href={item.href}
                          className={cn(
                            "flex min-h-[48px] items-center gap-3 rounded-lg px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-primary",
                            active ? "bg-primary/10 text-primary" : "hover:bg-muted"
                          )}
                        >
                          <StudentNavIcon name={MORE_ICONS[item.href]} className="h-5 w-5" />
                          <span className="flex-1">{item.label}</span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
                        </Link>
                      </DialogPrimitive.Close>
                    </li>
                  );
                })}
                <li className="mt-1 border-t border-border pt-1">
                  <button
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    className="flex min-h-[48px] w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-destructive hover:bg-destructive/10 focus-visible:outline-2 focus-visible:outline-destructive"
                  >
                    <LogOut className="h-5 w-5" aria-hidden />
                    Log out
                  </button>
                </li>
              </ul>
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
  onSignOut,
}: {
  pathname: string;
  unread: number;
  onSignOut: () => void;
}) {
  const items = [
    ...STUDENT_TABS.map((t) => ({ href: t.href, label: t.label, icon: t.icon })),
    ...STUDENT_MORE.map((t) => ({ href: t.href, label: t.label, icon: t.icon })),
  ];
  return (
    <nav aria-label="Student navigation" className="flex-1 space-y-0.5 overflow-y-auto">
      {items.map((item) => {
        const active = isActivePath(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-[40px] items-center gap-2.5 rounded-md px-3 text-sm font-medium",
              active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <span className="relative">
              <StudentNavIcon name={item.icon} className="h-4 w-4" />
              {item.href === "/student/notifications" && <NotificationBadge count={unread} />}
            </span>
            {item.label}
          </Link>
        );
      })}
      <button
        onClick={onSignOut}
        className="mt-2 flex min-h-[40px] w-full items-center gap-2.5 rounded-md px-3 text-sm font-medium text-destructive hover:bg-destructive/10"
      >
        <LogOut className="h-4 w-4" aria-hidden /> Log out
      </button>
    </nav>
  );
}
