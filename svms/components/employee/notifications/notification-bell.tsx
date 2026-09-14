"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Bell, Check, CheckCheck } from "lucide-react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
} from "@/components/ui/overlays";
import { cn, formatRelativeTime } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import type { NotificationRow } from "@/lib/services/notification-cases";

type Props = {
  initialUnreadCount: number;
  initialRecent: NotificationRow[];
};

const POLL_INTERVAL_MS = 60_000; // refresh the badge every minute

export function NotificationBell({ initialUnreadCount, initialRecent }: Props) {
  const { toast } = useToast();
  const [unread, setUnread] = useState(initialUnreadCount);
  const [recent, setRecent] = useState(initialRecent);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  // Poll for badge count
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch("/api/employee/notifications/unread-count", { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (res.ok && data?.success) {
          setUnread(data.data.total);
        }
      } catch {
        // silent
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  // Fetch recent list when dropdown opens
  async function loadRecent() {
    setLoading(true);
    try {
      const res = await fetch("/api/employee/notifications/recent?limit=5", { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        setRecent(data.data.rows);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) void loadRecent();
  }

  async function markRead(id: string) {
    // Optimistic
    setRecent((prev) => prev.map((r) => (r.id === id ? { ...r, readAt: new Date() } : r)));
    setUnread((u) => Math.max(0, u - 1));
    try {
      const res = await fetch(`/api/employee/notifications/${id}/read`, { method: "PATCH" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error?.message ?? `Failed (${res.status})`);
      }
    } catch (err) {
      // Roll back
      setRecent((prev) => prev.map((r) => (r.id === id ? { ...r, readAt: null } : r)));
      setUnread((u) => u + 1);
      toast({
        title: "Could not mark as read",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "error",
      });
    }
  }

  async function markAllRead() {
    if (unread === 0) return;
    const prevUnread = unread;
    setUnread(0);
    setRecent((prev) => prev.map((r) => ({ ...r, readAt: r.readAt ?? new Date() })));
    try {
      const res = await fetch("/api/employee/notifications/read-all", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error?.message ?? `Failed (${res.status})`);
      }
      toast({ title: `Marked ${data.data.updated} as read`, variant: "success" });
    } catch (err) {
      setUnread(prevUnread);
      setRecent((prev) => prev.map((r) => ({ ...r, readAt: null })));
      toast({
        title: "Could not mark all as read",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "error",
      });
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          ref={triggerRef}
          aria-label={`Notifications${unread > 0 ? ` — ${unread} unread` : ""}`}
          className="relative grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-muted"
        >
          <Bell className="h-4 w-4" aria-hidden />
          {unread > 0 && (
            <span
              className={cn(
                "absolute right-0.5 top-0.5 grid h-4 min-w-[16px] place-items-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground",
                unread > 99 && "px-0.5",
              )}
              aria-hidden
            >
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(95vw,400px)] p-0">
        {/* Header row */}
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <p className="text-sm font-semibold">
            Notifications
            {unread > 0 && <span className="ml-1.5 text-xs text-muted-foreground">· {unread} unread</span>}
          </p>
          <button
            type="button"
            onClick={markAllRead}
            disabled={unread === 0}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            <CheckCheck className="h-3 w-3" /> Mark all read
          </button>
        </div>

        {/* List */}
        <div className="max-h-[60vh] overflow-y-auto">
          {loading && recent.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">Loading…</p>
          ) : recent.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              You're all caught up.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {recent.map((n) => {
                const isUnread = !n.readAt;
                return (
                  <li
                    key={n.id}
                    className={cn(
                      "group relative flex items-start gap-2 px-3 py-2 transition-colors hover:bg-muted/40",
                      isUnread && "bg-info/5",
                    )}
                  >
                    {isUnread && (
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-info" aria-hidden />
                    )}
                    {!isUnread && <span className="mt-2 h-1.5 w-1.5 shrink-0" aria-hidden />}
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-xs font-medium", isUnread ? "text-foreground" : "text-muted-foreground")}>
                        {n.title}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                        {n.message}
                      </p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground/70">
                        {formatRelativeTime(n.createdAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {isUnread && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            markRead(n.id);
                          }}
                          aria-label="Mark as read"
                          className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    {n.link && (
                      <Link
                        href={n.link}
                        className="absolute inset-0"
                        aria-label={`Open: ${n.title}`}
                        onClick={() => {
                          setOpen(false);
                          // Mark read on navigation
                          if (isUnread) void markRead(n.id);
                        }}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer row */}
        <div className="border-t border-border px-3 py-2">
          <Link
            href="/employee/notifications"
            onClick={() => setOpen(false)}
            className="block text-center text-xs font-medium text-primary hover:underline"
          >
            View all notifications →
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
