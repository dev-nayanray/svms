"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui";
import { Button } from "@/components/ui";
import { EmptyState } from "@/components/shared";
import { apiFetch } from "@/lib/api-client";
import { formatDate } from "@/lib/utils";
import {
  NOTIFICATION_READ_FILTERS,
  NOTIFICATION_READ_FILTER_LABELS,
  type NotificationReadFilter,
} from "@/lib/constants/notifications";
import { CheckCheck, Search, X } from "lucide-react";

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

type NotificationData = {
  data: Notification[];
  unreadCount: number;
  pagination?: { total: number; totalPages: number };
};

/**
 * Admin Notification Center — All/Unread/Read tabs with search and
 * mark-as-read functionality.
 */
export function NotificationsCenter() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<NotificationReadFilter>("all");
  const [search, setSearch] = useState("");

  const queryString = new URLSearchParams({
    filter,
    ...(search ? { search } : {}),
  }).toString();

  const { data, isPending } = useQuery({
    queryKey: ["/api/notifications", queryString],
    queryFn: () => apiFetch<NotificationData>(`/api/notifications?${queryString}`),
    staleTime: 10_000,
  });

  const notifications = data?.data ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  const markAllRead = async () => {
    await apiFetch("/api/notifications", { method: "PATCH", json: { all: true } });
    qc.invalidateQueries({ queryKey: ["/api/notifications"] });
  };

  const markAsRead = async (id: string) => {
    await apiFetch("/api/notifications", { method: "PATCH", json: { id } });
    qc.invalidateQueries({ queryKey: ["/api/notifications"] });
  };

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {NOTIFICATION_READ_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors " +
                (filter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/70")
              }
            >
              {NOTIFICATION_READ_FILTER_LABELS[f]}
              {f === "unread" && unreadCount > 0 && (
                <span className="grid h-4 min-w-4 place-items-center rounded-full bg-primary-foreground/20 px-1 text-[10px]">
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead}>
            <CheckCheck className="h-4 w-4" aria-hidden /> Mark all read
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search notifications…"
          className="h-9 w-full rounded-md border border-border bg-card pl-9 pr-9 text-sm"
          aria-label="Search notifications"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-2 top-1.5 rounded p-1 text-muted-foreground hover:bg-muted"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Notifications list */}
      {isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState
          title="No notifications"
          description={
            filter === "unread"
              ? "You're all caught up — no unread notifications."
              : filter === "read"
                ? "No read notifications."
                : "You have no notifications yet."
          }
        />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {notifications.map((n) => (
            <li
              key={n.id}
              className={
                "flex items-start justify-between gap-4 p-4 " +
                (n.readAt ? "" : "bg-primary/5")
              }
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{n.title}</p>
                  {!n.readAt && (
                    <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />
                  )}
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">{n.message}</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                    {n.type.replace(/_/g, " ")}
                  </span>
                  <span className="text-xs text-muted-foreground">{formatDate(n.createdAt)}</span>
                  {n.link && (
                    <a
                      href={n.link}
                      className="text-xs text-primary hover:underline"
                    >
                      View →
                    </a>
                  )}
                </div>
              </div>
              {!n.readAt && (
                <button
                  onClick={() => markAsRead(n.id)}
                  className="shrink-0 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
                >
                  Mark read
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
