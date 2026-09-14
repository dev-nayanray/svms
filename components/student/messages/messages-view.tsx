"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ChevronRight,
  MessageSquare,
  RefreshCw,
  Search,
  UserRound,
  WifiOff,
  X,
} from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { Button, Input } from "@/components/ui";
import { MobilePage, MobileCard } from "@/components/student/ui";
import { Skeleton } from "@/components/ui/overlays";
import { cn } from "@/lib/utils";
import { format, parseISO, differenceInMinutes, differenceInHours, differenceInDays } from "date-fns";

// ── Types ──────────────────────────────────────────────────────────

type Conversation = {
  id: string;
  counselorName: string;
  counselorInitials: string;
  counselorId: string;
  latestMessage: string | null;
  latestMessageAt: string | null;
  latestMessageSenderId: string | null;
  unreadCount: number;
};

type ListResponse = { conversations: Conversation[] };

// ── Component ──────────────────────────────────────────────────────

export function MessagesView() {
  const [search, setSearch] = useState("");

  const listQ = useQuery<ListResponse>({
    queryKey: ["student-conversations"],
    queryFn: () => apiFetch<ListResponse>("/api/student/messages"),
    retry: false,
    // Real-time updates arrive via SSE (StudentRealtimeProvider).
    // 120s fallback polling in case SSE has a prolonged disconnect.
    refetchInterval: 120_000,
    staleTime: 10_000,
  });

  const online = useOnlineStatus();

  if (listQ.isLoading && !listQ.data) {
    return (
      <MobilePage>
        <InboxSkeleton />
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
            {!online ? "You're offline" : "Couldn't load your messages"}
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

  const conversations = listQ.data?.conversations ?? [];
  const filtered = search.trim()
    ? conversations.filter((c) =>
        c.counselorName.toLowerCase().includes(search.toLowerCase()) ||
        c.latestMessage?.toLowerCase().includes(search.toLowerCase())
      )
    : conversations;
  const totalUnread = conversations.reduce((s, c) => s + c.unreadCount, 0);

  return (
    <MobilePage>
      {/* Search bar */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search conversations…"
          className="pl-9"
          aria-label="Search conversations"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-2 top-1.5 rounded p-1 text-muted-foreground hover:bg-muted"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Summary */}
      {conversations.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {conversations.length} conversation{conversations.length === 1 ? "" : "s"}
          {totalUnread > 0 && (
            <span className="ml-1 font-medium text-primary">· {totalUnread} unread</span>
          )}
        </p>
      )}

      {/* Conversation list */}
      {filtered.length === 0 ? (
        <MobileCard className="py-8 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
            <MessageSquare className="h-6 w-6" aria-hidden />
          </span>
          <h2 className="mt-3 text-base font-semibold">
            {search ? "No matching conversations" : "No conversations yet"}
          </h2>
          <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
            {search
              ? "Try a different search term."
              : "Your counselor will start a conversation when there's an update on your application."}
          </p>
        </MobileCard>
      ) : (
        <div className="space-y-1">
          {filtered.map((c) => (
            <ConversationCard key={c.id} conversation={c} />
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

// ── Conversation card ──────────────────────────────────────────────

function ConversationCard({ conversation }: { conversation: Conversation }) {
  const hasUnread = conversation.unreadCount > 0;
  return (
    <Link
      href={`/student/messages/${conversation.id}`}
      className="block focus-visible:outline-2 focus-visible:outline-primary"
    >
      <div className={cn(
        "flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/30",
        hasUnread ? "border-primary/30 bg-primary/5" : "border-border bg-card",
      )}>
        {/* Avatar */}
        <span className={cn(
          "relative grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-semibold",
          hasUnread ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
        )}>
          {conversation.counselorInitials || <UserRound className="h-5 w-5" aria-hidden />}
          {hasUnread && (
            <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
              {conversation.unreadCount > 9 ? "9+" : conversation.unreadCount}
            </span>
          )}
        </span>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className={cn("truncate text-sm", hasUnread ? "font-semibold" : "font-medium")}>
              {conversation.counselorName}
            </p>
            {conversation.latestMessageAt && (
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {fmtRelative(conversation.latestMessageAt)}
              </span>
            )}
          </div>
          {conversation.latestMessage && (
            <p className={cn(
              "mt-0.5 truncate text-xs",
              hasUnread ? "text-foreground font-medium" : "text-muted-foreground",
            )}>
              {conversation.latestMessageSenderId === conversation.counselorId ? "" : "You: "}
              {conversation.latestMessage}
            </p>
          )}
        </div>

        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </div>
    </Link>
  );
}

// ── Loading skeleton ───────────────────────────────────────────────

function InboxSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading messages">
      <Skeleton className="h-9 w-full rounded-md" />
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
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
    if (mins < 1) return "now";
    if (mins < 60) return `${mins}m`;
    const hours = differenceInHours(now, date);
    if (hours < 24) return `${hours}h`;
    const days = differenceInDays(now, date);
    if (days === 1) return "yesterday";
    if (days < 7) return `${days}d`;
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
