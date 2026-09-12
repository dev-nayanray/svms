"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  CheckCircle2,
  CheckSquare,
  ChevronRight,
  Clock,
  CreditCard,
  DollarSign,
  FileText,
  FolderKanban,
  Mail,
  MessageCircle,
  MessageSquare,
  RefreshCw,
  RotateCcw,
  Stamp,
  UserRound,
  WifiOff,
  XCircle,
} from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { Button, Badge } from "@/components/ui";
import { MobilePage, MobileCard } from "@/components/student/ui";
import { Skeleton } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { format, parseISO, differenceInMinutes, differenceInHours, differenceInDays } from "date-fns";

// ── Types ──────────────────────────────────────────────────────────

type NotificationItem = {
  id: string;
  type: string;
  typeLabel: string;
  icon: string;
  title: string;
  message: string;
  link: string | null;
  readAt: string | null;
  isRead: boolean;
  category: string;
  createdAt: string;
};

type NotificationResponse = {
  items: NotificationItem[];
  unreadCount: number;
  totalCount: number;
};

type Category = "all" | "unread" | "application" | "documents" | "visa" | "payments" | "messages" | "tasks";

// ── Icon resolver ──────────────────────────────────────────────────

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  FileText, CheckCircle2, XCircle, RotateCcw, FolderKanban,
  CheckSquare, Stamp, DollarSign, AlertTriangle, MessageCircle,
  MessageSquare, Bell, Clock, CreditCard, Mail, UserRound,
};

function NotificationIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? Bell;
  return <Icon className={className} aria-hidden />;
}

// ── Filter tabs ────────────────────────────────────────────────────

const TABS: { value: Category; label: string; icon: React.ReactNode }[] = [
  { value: "all", label: "All", icon: <Bell className="h-3.5 w-3.5" /> },
  { value: "unread", label: "Unread", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  { value: "application", label: "Application", icon: <FolderKanban className="h-3.5 w-3.5" /> },
  { value: "documents", label: "Documents", icon: <FileText className="h-3.5 w-3.5" /> },
  { value: "visa", label: "Visa", icon: <Stamp className="h-3.5 w-3.5" /> },
  { value: "payments", label: "Payments", icon: <DollarSign className="h-3.5 w-3.5" /> },
  { value: "messages", label: "Messages", icon: <MessageSquare className="h-3.5 w-3.5" /> },
  { value: "tasks", label: "Tasks", icon: <CheckSquare className="h-3.5 w-3.5" /> },
];

// ── Component ──────────────────────────────────────────────────────

export function NotificationsView() {
  const router = useRouter();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<Category>("all");
  const online = useOnlineStatus();

  const listQ = useQuery<NotificationResponse>({
    queryKey: ["student-notifications", activeTab],
    queryFn: () =>
      apiFetch<NotificationResponse>(`/api/student/notifications?category=${activeTab}`),
    retry: false,
    // Real-time updates arrive via SSE (StudentRealtimeProvider).
    // 120s fallback polling in case SSE has a prolonged disconnect.
    refetchInterval: 120_000,
    staleTime: 10_000,
  });

  const items = useMemo(() => listQ.data?.items ?? [], [listQ.data]);
  const unreadCount = listQ.data?.unreadCount ?? 0;

  if (listQ.isLoading && !listQ.data) {
    return (
      <MobilePage>
        <NotificationsSkeleton />
      </MobilePage>
    );
  }

  if (listQ.isError && !listQ.data) {
    return (
      <MobilePage>
        <MobileCard className="py-8 text-center">
          {!online ? (
            <WifiOff className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden />
          ) : (
            <AlertTriangle className="mx-auto h-10 w-10 text-destructive" aria-hidden />
          )}
          <h2 className="mt-3 text-base font-semibold">
            {!online ? "You're offline" : "Couldn't load notifications"}
          </h2>
          <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
            {!online ? "Check your connection and try again." : "Please try again in a moment."}
          </p>
          <Button onClick={() => listQ.refetch()} className="mt-4" disabled={!online}>
            <RefreshCw className="h-4 w-4" aria-hidden /> Retry
          </Button>
        </MobileCard>
      </MobilePage>
    );
  }

  // Mark a notification as read + navigate to its link
  async function handleNotificationClick(item: NotificationItem) {
    if (!item.isRead) {
      // Optimistic: mark as read locally
      qc.setQueryData<NotificationResponse>(["student-notifications", activeTab], (prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((n) =>
                n.id === item.id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n,
              ),
              unreadCount: Math.max(0, prev.unreadCount - 1),
            }
          : prev,
      );
      try {
        await apiFetch(`/api/student/notifications/${item.id}/read`, { method: "PATCH" });
        qc.invalidateQueries({ queryKey: ["student-notifications"] });
      } catch {
        // Roll back on failure
        qc.invalidateQueries({ queryKey: ["student-notifications"] });
      }
    }
    // Navigate to the notification's link
    if (item.link) {
      router.push(item.link);
    }
  }

  // Mark all as read
  async function handleMarkAllRead() {
    if (unreadCount === 0) return;
    // Optimistic
    qc.setQueryData<NotificationResponse>(["student-notifications", activeTab], (prev) =>
      prev
        ? {
            ...prev,
            items: prev.items.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() })),
            unreadCount: 0,
          }
        : prev,
    );
    try {
      const result = await apiFetch<{ count: number }>("/api/student/notifications/read-all", {
        method: "POST",
      });
      toast({ title: `Marked ${result.count} as read`, variant: "success" });
      qc.invalidateQueries({ queryKey: ["student-notifications"] });
    } catch (err) {
      qc.invalidateQueries({ queryKey: ["student-notifications"] });
      toast({
        title: "Failed",
        description: err instanceof Error ? err.message : "Try again",
        variant: "error",
      });
    }
  }

  return (
    <MobilePage>
      {/* Header with unread count + mark all */}
      <div className="flex items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-base font-semibold">
          <Bell className="h-4 w-4 text-primary" aria-hidden />
          Notifications
          {unreadCount > 0 && <Badge tone="destructive">{unreadCount}</Badge>}
        </h1>
        {unreadCount > 0 && (
          <Button size="sm" variant="outline" onClick={handleMarkAllRead}>
            <CheckCheck className="h-3.5 w-3.5" aria-hidden /> Mark all read
          </Button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="overflow-x-auto pb-1">
        <div className="flex min-w-max gap-1.5">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveTab(tab.value)}
                aria-pressed={isActive}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.icon}
                {tab.label}
                {tab.value === "unread" && unreadCount > 0 && (
                  <span className="ml-0.5 rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Notification list */}
      {items.length === 0 ? (
        <MobileCard className="py-8 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
            <Bell className="h-6 w-6" aria-hidden />
          </span>
          <h2 className="mt-3 text-base font-semibold">
            {activeTab === "unread" ? "No unread notifications" : "No notifications"}
          </h2>
          <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
            {activeTab === "unread"
              ? "You're all caught up. New notifications will appear here."
              : "Notifications about your application, documents, payments, and visa will appear here."}
          </p>
        </MobileCard>
      ) : (
        <div className="space-y-1.5">
          {items.map((item) => (
            <NotificationCard key={item.id} item={item} onClick={() => handleNotificationClick(item)} />
          ))}
        </div>
      )}

      {/* Refresh + offline */}
      <div className="flex items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
        <span>{listQ.isFetching ? "Refreshing…" : "Auto-refreshes every 30s"}</span>
        {!online && (
          <span className="flex items-center gap-1 text-warning">
            <WifiOff className="h-3 w-3" aria-hidden /> Offline
          </span>
        )}
        <Button size="sm" variant="ghost" onClick={() => listQ.refetch()} disabled={listQ.isFetching} aria-label="Refresh list">
          <RefreshCw className={cn("h-3.5 w-3.5", listQ.isFetching && "animate-spin")} aria-hidden />
        </Button>
      </div>
    </MobilePage>
  );
}

// ── Notification card ─────────────────────────────────────────────

function NotificationCard({
  item,
  onClick,
}: {
  item: NotificationItem;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-primary",
        item.isRead
          ? "border-border bg-card hover:bg-muted/30"
          : "border-primary/30 bg-primary/5 hover:bg-primary/10",
      )}
    >
      {/* Icon */}
      <span
        className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-full",
          item.isRead
            ? "bg-muted text-muted-foreground"
            : "bg-primary/15 text-primary",
        )}
      >
        <NotificationIcon name={item.icon} className="h-4 w-4" />
      </span>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className={cn("truncate text-sm", item.isRead ? "font-medium" : "font-semibold")}>
            {item.title}
          </p>
          {!item.isRead && (
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />
          )}
        </div>
        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{item.message}</p>
        <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
          <span>{fmtRelative(item.createdAt)}</span>
          {item.link && (
            <span className="flex items-center gap-0.5 text-primary">
              View <ChevronRight className="h-3 w-3" aria-hidden />
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// ── Loading skeleton ───────────────────────────────────────────────

function NotificationsSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading notifications">
      <Skeleton className="h-9 w-full rounded-lg" />
      <Skeleton className="h-8 w-full rounded-full" />
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────

function fmtRelative(dateStr: string): string {
  try {
    const date = parseISO(dateStr);
    const now = new Date();
    const mins = differenceInMinutes(now, date);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = differenceInHours(now, date);
    if (hours < 24) return `${hours}h ago`;
    const days = differenceInDays(now, date);
    if (days === 1) return "yesterday";
    if (days < 7) return `${days}d ago`;
    return format(date, "MMM d");
  } catch {
    return "—";
  }
}

function useOnlineStatus() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}
