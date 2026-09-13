"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui";
import { EmptyState } from "@/components/shared";
import { apiFetch } from "@/lib/api-client";
import { formatDate, cn } from "@/lib/utils";
import {
  NOTIFICATION_READ_FILTERS,
  NOTIFICATION_READ_FILTER_LABELS,
  type NotificationReadFilter,
} from "@/lib/constants/notifications";
import {
  CheckCheck, Search, X, Bell, FileText, Stamp, CreditCard,
  CheckSquare, MessageSquare, FolderKanban, Calendar,
  RefreshCw, Loader2,
} from "lucide-react";
import Link from "next/link";

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

// Type-based icon mapping
const TYPE_ICONS: Record<string, typeof Bell> = {
  DOCUMENT_UPLOADED: FileText,
  DOCUMENT_APPROVED: FileText,
  DOCUMENT_REJECTED: FileText,
  DOCUMENT_EXPIRED: FileText,
  APPLICATION_STAGE_CHANGED: FolderKanban,
  APPLICATION_STATUS_CHANGED: FolderKanban,
  VISA_STATUS_CHANGED: Stamp,
  VISA_APPROVED: Stamp,
  VISA_REFUSED: Stamp,
  PAYMENT_RECEIVED: CreditCard,
  INVOICE_ISSUED: CreditCard,
  INVOICE_OVERDUE: CreditCard,
  TASK_ASSIGNED: CheckSquare,
  TASK_COMPLETED: CheckSquare,
  DEADLINE_APPROACHING: Calendar,
  TASK_OVERDUE: Calendar,
  NEW_MESSAGE: MessageSquare,
  APPOINTMENT_CONFIRMED: Calendar,
  APPOINTMENT_CANCELLED: Calendar,
  APPOINTMENT_REMINDER: Calendar,
  COUNSELING_REQUEST: MessageSquare,
};

export function NotificationsCenter() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<NotificationReadFilter>("all");
  const [search, setSearch] = useState("");
  const [markingAll, setMarkingAll] = useState(false);

  const queryString = new URLSearchParams({
    filter,
    ...(search ? { search } : {}),
  }).toString();

  const { data, isPending, refetch } = useQuery({
    queryKey: ["/api/notifications", queryString],
    queryFn: () => apiFetch<NotificationData>(`/api/notifications?${queryString}`),
    staleTime: 5_000,
  });

  const notifications = data?.data ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  const markAllRead = async () => {
    setMarkingAll(true);
    try {
      await apiFetch("/api/notifications", { method: "PATCH", json: { all: true } });
      qc.invalidateQueries({ queryKey: ["/api/notifications"] });
    } finally {
      setMarkingAll(false);
    }
  };

  const markAsRead = async (id: string) => {
    await apiFetch("/api/notifications", { method: "PATCH", json: { id } });
    qc.invalidateQueries({ queryKey: ["/api/notifications"] });
  };

  return (
    <div className="space-y-4">
      {/* Filter tabs + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {NOTIFICATION_READ_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                filter === f
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-muted/70",
              )}
            >
              {NOTIFICATION_READ_FILTER_LABELS[f]}
              {f === "unread" && unreadCount > 0 && (
                <span className="grid h-4 min-w-4 place-items-center rounded-full bg-primary-foreground/20 px-1 text-[10px] font-bold">
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllRead} disabled={markingAll}>
              {markingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
              Mark all read
            </Button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search notifications…"
          className="h-9 w-full rounded-lg border border-border bg-card pl-9 pr-9 text-sm focus:border-primary focus:outline-none"
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
            <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
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
        <ul className="space-y-2">
          {notifications.map((n) => {
            const Icon = TYPE_ICONS[n.type] ?? Bell;
            return (
              <li
                key={n.id}
                className={cn(
                  "group flex items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:shadow-md",
                  !n.readAt && "border-primary/20 bg-primary/5",
                )}
              >
                {/* Icon */}
                <span className={cn(
                  "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
                  n.readAt ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary",
                )}>
                  <Icon className="h-5 w-5" aria-hidden />
                </span>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{n.title}</p>
                    {!n.readAt && (
                      <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">{n.message}</p>
                  <div className="mt-2 flex items-center gap-3">
                    <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
                      {n.type.replace(/_/g, " ")}
                    </span>
                    <span className="text-xs text-muted-foreground">{formatDate(n.createdAt)}</span>
                    {n.link && (
                      <Link href={n.link} className="text-xs font-semibold text-primary hover:underline">
                        View →
                      </Link>
                    )}
                  </div>
                </div>

                {/* Mark read button */}
                {!n.readAt && (
                  <button
                    onClick={() => markAsRead(n.id)}
                    className="shrink-0 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
                  >
                    Mark read
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Summary */}
      {notifications.length > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          {notifications.length} notification{notifications.length === 1 ? "" : "s"}
          {unreadCount > 0 && ` · ${unreadCount} unread`}
        </p>
      )}
    </div>
  );
}
