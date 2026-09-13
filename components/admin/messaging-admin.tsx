"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Textarea } from "@/components/ui";
import { EmptyState } from "@/components/shared";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { formatDate, cn } from "@/lib/utils";
import { Search, Send, Paperclip, X, ChevronLeft, MessageSquare, RefreshCw } from "lucide-react";

type Conversation = {
  id: string;
  studentId: string;
  employeeId: string;
  lastMessageAt: string;
  student: { id: string; firstName: string; lastName: string; studentId: string };
  employee: { id: string; user: { id: string; name: string } };
  messages: { id: string; body: string; createdAt: string; senderId: string }[];
  _count: { messages: number };
};

type ConversationList = { data: Conversation[] };

type ConversationDetail = {
  id: string;
  student: { id: string; firstName: string; lastName: string; studentId: string; userId: string };
  employee: { id: string; user: { id: string; name: string } };
  messages: {
    id: string;
    senderId: string;
    body: string;
    attachmentUrl: string | null;
    readAt: string | null;
    createdAt: string;
  }[];
};

export function MessagingAdmin() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [composeBody, setComposeBody] = useState("");
  const [sending, setSending] = useState(false);

  const queryString = new URLSearchParams(search ? { search } : {}).toString();

  const { data: listData, isPending: listPending, refetch } = useQuery({
    queryKey: ["/api/conversations", queryString],
    queryFn: () => apiFetch<ConversationList>(`/api/conversations?${queryString}`),
    staleTime: 10_000,
  });

  const conversations = listData?.data ?? [];

  const { data: detail } = useQuery({
    queryKey: ["/api/conversations", selectedId],
    queryFn: () => apiFetch<ConversationDetail>(`/api/conversations/${selectedId}`),
    enabled: !!selectedId,
    staleTime: 5_000,
  });

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail) return;
    if (!composeBody.trim()) {
      toast({ title: "Message is empty", variant: "error" });
      return;
    }
    setSending(true);
    try {
      await apiFetch("/api/conversations", {
        method: "POST",
        json: {
          studentId: detail.student.id,
          body: composeBody.trim(),
          visibility: "STUDENT",
        },
      });
      toast({ title: "Message sent", variant: "success" });
      setComposeBody("");
      qc.invalidateQueries({ queryKey: ["/api/conversations", selectedId] });
      qc.invalidateQueries({ queryKey: ["/api/conversations", queryString] });
    } catch (err) {
      toast({ title: "Failed", description: (err as Error).message, variant: "error" });
    } finally {
      setSending(false);
    }
  };

  // ── Conversation detail view ──
  if (selectedId && detail) {
    const messages = detail.messages ?? [];
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setSelectedId(null)}>
            <ChevronLeft className="h-4 w-4" aria-hidden /> Back
          </Button>
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* Conversation header */}
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary">
            {detail.student.firstName[0]}{detail.student.lastName[0]}
          </span>
          <div className="flex-1">
            <p className="font-bold">{detail.student.firstName} {detail.student.lastName}</p>
            <p className="text-xs text-muted-foreground">
              {detail.student.studentId} · Counselor: {detail.employee.user.name}
            </p>
          </div>
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-bold text-muted-foreground">
            {messages.length} messages
          </span>
        </div>

        {/* Message thread */}
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="max-h-[400px] space-y-3 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <EmptyState title="No messages yet" description="Send the first message to start the conversation." />
            ) : (
              messages.map((msg) => {
                const isOwn = msg.senderId !== detail.student.userId;
                return (
                  <div key={msg.id} className={cn("flex flex-col", isOwn ? "items-end" : "items-start")}>
                    <div
                      className={cn(
                        "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm",
                        isOwn
                          ? "rounded-br-sm bg-primary text-primary-foreground"
                          : "rounded-bl-sm bg-muted text-foreground",
                      )}
                    >
                      <p>{msg.body}</p>
                      {msg.attachmentUrl && (
                        <a
                          href={msg.attachmentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(
                            "mt-1.5 inline-flex items-center gap-1 text-xs underline",
                            isOwn ? "text-primary-foreground/80" : "text-primary",
                          )}
                        >
                          <Paperclip className="h-3 w-3" aria-hidden /> Attachment
                        </a>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-2 px-1 text-xs text-muted-foreground">
                      <span>{formatDate(msg.createdAt)}</span>
                      {isOwn && <span>{msg.readAt ? "✓ Read" : "✓ Delivered"}</span>}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Compose */}
          <form onSubmit={sendMessage} className="border-t border-border p-4">
            <Textarea
              value={composeBody}
              onChange={(e) => setComposeBody(e.target.value)}
              placeholder="Type a message…"
              className="min-h-[70px] resize-none"
              aria-label="Message body"
            />
            <div className="mt-2 flex justify-end">
              <Button type="submit" disabled={sending || !composeBody.trim()} size="sm">
                {sending ? "Sending…" : "Send"} <Send className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ── Conversation list view ──
  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by student name or ID…"
          className="h-9 w-full rounded-lg border border-border bg-card pl-9 pr-9 text-sm focus:border-primary focus:outline-none"
          aria-label="Search conversations"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-2 top-1.5 rounded p-1 text-muted-foreground hover:bg-muted" aria-label="Clear search">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Conversation list */}
      {listPending ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : conversations.length === 0 ? (
        <EmptyState
          title="No conversations"
          description="Conversations appear when a counselor sends a message to a student."
        />
      ) : (
        <ul className="space-y-2">
          {conversations.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => setSelectedId(c.id)}
                className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                {/* Avatar */}
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {c.student.firstName[0]}{c.student.lastName[0]}
                </span>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-bold">
                      {c.student.firstName} {c.student.lastName}
                    </p>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDate(c.lastMessageAt)}
                    </span>
                  </div>
                  <p className="truncate text-sm text-muted-foreground">
                    {c.messages[0]?.body ?? "No messages yet"}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {c.student.studentId}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {c._count.messages} message{c._count.messages === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>

                <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground/30" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Info notice */}
      <div className="rounded-xl border border-border bg-muted/20 p-3">
        <p className="text-xs text-muted-foreground">
          <strong>Supervisory visibility:</strong> Admins can see all conversations between students and counselors.
          Internal notes (visibility: INTERNAL) are never exposed to students.
        </p>
      </div>
    </div>
  );
}
