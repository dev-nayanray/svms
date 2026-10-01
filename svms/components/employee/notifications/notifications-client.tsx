"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FolderKanban, FileText, CheckSquare, CreditCard, Stamp, MessageSquare,
  CalendarClock, Receipt, Bell, Check, CheckCheck, AlertCircle, X,
} from "lucide-react";
import { Button, Card, CardContent, Badge } from "@/components/ui";
import { cn, formatRelativeTime } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import {
  NOTIFICATION_CATEGORIES,
  CATEGORY_META,
  type NotificationCategory,
  type NotificationRow,
  type UnreadCountResult,
} from "@/lib/services/notification-cases";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  FolderKanban, FileText, CheckSquare, CreditCard, Stamp, MessageSquare,
  CalendarClock, Receipt, Bell,
};

type Props = {
  initialRows: NotificationRow[];
  initialTotal: number;
  initialUnread: number;
  initialPage: number;
  initialPageSize: number;
  initialTotalPages: number;
  initialUnreadBreakdown: UnreadCountResult;
  initialFilterCategory?: NotificationCategory;
  initialFilterUnreadOnly: boolean;
};

export function NotificationsClient({
  initialRows,
  initialTotal,
  initialUnread,
  initialPage,
  initialPageSize,
  initialTotalPages,
  initialUnreadBreakdown,
  initialFilterCategory,
  initialFilterUnreadOnly,
}: Props) {
  const { toast } = useToast();
  const [rows, setRows] = useState(initialRows);
  const [total, setTotal] = useState(initialTotal);
  const [unread, setUnread] = useState(initialUnread);
  const [page, setPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [breakdown, setBreakdown] = useState(initialUnreadBreakdown);

  const [filterCategory, setFilterCategory] = useState<NotificationCategory | undefined>(initialFilterCategory);
  const [unreadOnly, setUnreadOnly] = useState(initialFilterUnreadOnly);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  // ── Fetch with current filters ──────────────────────────────────────
  async function refresh(targetPage = page, silent = false) {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (unreadOnly) params.set("unreadOnly", "true");
      if (filterCategory) params.set("category", filterCategory);
      params.set("page", String(targetPage));
      params.set("pageSize", String(initialPageSize));
      const res = await fetch(`/api/employee/notifications?${params.toString()}`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error?.message ?? `Failed (${res.status})`);
      }
      setRows(data.data.rows);
      setTotal(data.data.total);
      setUnread(data.data.unread);
      setTotalPages(data.data.totalPages);
      setPage(data.data.page);
      // Also refresh the breakdown silently
      void refreshBreakdown();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error — please retry.");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function refreshBreakdown() {
    try {
      const res = await fetch("/api/employee/notifications/unread-count", { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        setBreakdown(data.data);
      }
    } catch {
      // silent
    }
  }

  // Re-fetch when filters change (debounced)
  useEffect(() => {
    const h = setTimeout(() => void refresh(1), 250);
    return () => clearTimeout(h);
    // depends on (filterCategory, unreadOnly) only
  }, [filterCategory, unreadOnly]);

  // ── Mark single read ────────────────────────────────────────────────
  async function markRead(id: string) {
    // Optimistic update
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, readAt: new Date() } : r)));
    setUnread((u) => Math.max(0, u - 1));
    try {
      const res = await fetch(`/api/employee/notifications/${id}/read`, { method: "PATCH" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error?.message ?? `Failed (${res.status})`);
      }
      void refreshBreakdown();
    } catch (err) {
      // Roll back
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, readAt: null } : r)));
      setUnread((u) => u + 1);
      toast({
        title: "Could not mark as read",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "error",
      });
    }
  }

  // ── Mark all read ───────────────────────────────────────────────────
  async function markAllRead() {
    if (unread === 0) return;
    setMarkingAll(true);
    const prevRows = rows;
    const prevUnread = unread;
    const prevBreakdown = breakdown;
    // Optimistic
    setRows((prev) => prev.map((r) => ({ ...r, readAt: r.readAt ?? new Date() })));
    setUnread(0);
    setBreakdown({
      total: 0,
      byCategory: Object.fromEntries(NOTIFICATION_CATEGORIES.map((c) => [c, 0])) as Record<NotificationCategory, number>,
    });
    try {
      const params = new URLSearchParams();
      if (filterCategory) params.set("category", filterCategory);
      const res = await fetch(`/api/employee/notifications/read-all?${params.toString()}`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error?.message ?? `Failed (${res.status})`);
      }
      toast({
        title: `Marked ${data.data.updated} as read`,
        variant: "success",
      });
      void refreshBreakdown();
    } catch (err) {
      // Roll back
      setRows(prevRows);
      setUnread(prevUnread);
      setBreakdown(prevBreakdown);
      toast({
        title: "Could not mark all as read",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "error",
      });
    } finally {
      setMarkingAll(false);
    }
  }

  // ── Group rows by category for display ──────────────────────────────
  const grouped = groupByCategory(rows);
  const hasFilters = Boolean(filterCategory) || unreadOnly;

  return (
    <div>
      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <FilterChip
            active={!filterCategory && !unreadOnly}
            onClick={() => {
              setFilterCategory(undefined);
              setUnreadOnly(false);
            }}
            label="All"
            count={total}
          />
          <FilterChip
            active={unreadOnly && !filterCategory}
            onClick={() => {
              setFilterCategory(undefined);
              setUnreadOnly(true);
            }}
            label="Unread"
            count={unread}
            tone="info"
          />
          {NOTIFICATION_CATEGORIES.filter((c) => breakdown.byCategory[c] > 0 || c === filterCategory).map((cat) => (
            <FilterChip
              key={cat}
              active={filterCategory === cat}
              onClick={() => {
                setFilterCategory(cat);
                setUnreadOnly(false);
              }}
              label={CATEGORY_META[cat].label}
              icon={ICONS[CATEGORY_META[cat].icon]}
              count={breakdown.byCategory[cat]}
            />
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFilterCategory(undefined);
                setUnreadOnly(false);
              }}
            >
              <X className="h-3.5 w-3.5" /> Clear
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={markAllRead}
            disabled={markingAll || unread === 0}
          >
            <CheckCheck className="h-3.5 w-3.5" />
            {markingAll ? "Marking…" : "Mark all read"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <Button variant="ghost" size="sm" onClick={() => void refresh(page)}>
            Retry
          </Button>
        </div>
      )}

      {/* Grouped notification list */}
      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <EmptyState hasFilters={hasFilters} />
          ) : (
            <div className="divide-y divide-border">
              {grouped.map(({ category, items }) => (
                <CategorySection
                  key={category}
                  category={category}
                  items={items}
                  onMarkRead={markRead}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <nav aria-label="Pagination" className="mt-4 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Showing {(page - 1) * initialPageSize + 1}–{Math.min(total, page * initialPageSize)} of {total}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => void refresh(page - 1)}
            >
              Previous
            </Button>
            <span className="text-sm font-medium">Page {page} / {totalPages}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || loading}
              onClick={() => void refresh(page + 1)}
            >
              Next
            </Button>
          </div>
        </nav>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────

function groupByCategory(rows: NotificationRow[]): { category: NotificationCategory; items: NotificationRow[] }[] {
  const map = new Map<NotificationCategory, NotificationRow[]>();
  for (const r of rows) {
    if (!map.has(r.category)) map.set(r.category, []);
    map.get(r.category)!.push(r);
  }
  // Preserve the order NOTIFICATION_CATEGORIES defines
  return NOTIFICATION_CATEGORIES.filter((c) => map.has(c)).map((c) => ({
    category: c,
    items: map.get(c)!,
  }));
}

function FilterChip({
  active,
  onClick,
  label,
  count,
  icon: Icon,
  tone = "default",
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: "default" | "info";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors",
        active
          ? tone === "info"
            ? "border-info bg-info/10 text-info"
            : "border-primary bg-primary/10 text-primary"
          : "border-border bg-background text-muted-foreground hover:text-foreground",
      )}
    >
      {Icon && <Icon className="h-3 w-3" />}
      {label}
      {count !== undefined && count > 0 && (
        <span className={cn(
          "ml-0.5 rounded-full px-1 text-[10px] font-semibold",
          active ? "bg-current/20" : "bg-muted",
        )}>
          {count}
        </span>
      )}
    </button>
  );
}

function CategorySection({
  category,
  items,
  onMarkRead,
}: {
  category: NotificationCategory;
  items: NotificationRow[];
  onMarkRead: (id: string) => void;
}) {
  const meta = CATEGORY_META[category];
  const Icon = ICONS[meta.icon];
  const sectionUnread = items.filter((n) => !n.readAt).length;

  return (
    <div>
      <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-4 py-2">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {meta.label}
        </span>
        {sectionUnread > 0 && (
          <Badge tone="info" className="text-[10px]">{sectionUnread} new</Badge>
        )}
      </div>
      <ul className="divide-y divide-border">
        {items.map((n) => (
          <NotificationItem key={n.id} notification={n} onMarkRead={onMarkRead} />
        ))}
      </ul>
    </div>
  );
}

function NotificationItem({
  notification,
  onMarkRead,
}: {
  notification: NotificationRow;
  onMarkRead: (id: string) => void;
}) {
  const isUnread = !notification.readAt;
  return (
    <li className={cn("flex items-start gap-3 p-4 transition-colors", isUnread && "bg-info/5")}>
      {/* Unread dot */}
      <span
        className={cn(
          "mt-1.5 h-2 w-2 shrink-0 rounded-full",
          isUnread ? "bg-info" : "bg-transparent",
        )}
        aria-hidden
      />
      {/* Body */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className={cn("text-sm", isUnread ? "font-medium" : "text-foreground")}>
            {notification.title}
          </p>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{notification.message}</p>
        <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
          <time dateTime={notification.createdAt.toISOString()}>
            {formatRelativeTime(notification.createdAt)}
          </time>
          {notification.entityType && (
            <>
              <span aria-hidden>·</span>
              <span className="uppercase tracking-wide">{notification.entityType}</span>
            </>
          )}
        </div>
      </div>
      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1">
        {isUnread && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => onMarkRead(notification.id)}
            aria-label="Mark as read"
          >
            <Check className="h-3 w-3" />
          </Button>
        )}
        {notification.link && (
          <Link
            href={notification.link}
            className="inline-flex h-7 items-center rounded-md border border-border px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Open
          </Link>
        )}
      </div>
    </li>
  );
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 p-12 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-muted">
        <Bell className="h-5 w-5 text-muted-foreground" aria-hidden />
      </span>
      <div>
        <p className="text-sm font-medium">
          {hasFilters ? "No notifications match these filters." : "You're all caught up"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {hasFilters
            ? "Try clearing the filter or switching to 'All'."
            : "New activity on your cases will appear here."}
        </p>
      </div>
    </div>
  );
}
