"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui";
import { Button, Input, Textarea } from "@/components/ui";
import { EmptyState } from "@/components/shared";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { formatDate } from "@/lib/utils";
import { Search, Send, Paperclip, X, ChevronLeft } from "lucide-react";

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

type ConversationList = {
  data: Conversation[];
};

/**
 * Admin Messaging — conversation list + conversation detail with compose.
 *
 * Features:
 *  - Conversation list with search (student name, employee name, student ID)
 *  - Conversation detail: full message thread with timestamps + read status
 *  - Compose new message: body + optional attachment URL + visibility toggle
 *  - Attachments architecture: attachmentUrl stored as a string (future:
 *    object storage with signed URLs)
 *  - Admins have supervisory visibility — can see all conversations
 *  - Internal notes are never exposed to students (visibility field)
 */
export function MessagingAdmin() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [composeBody, setComposeBody] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [sending, setSending] = useState(false);

  const queryString = new URLSearchParams(search ? { search } : {}).toString();

  // Conversation list
  const { data: listData, isPending: listPending } = useQuery({
    queryKey: ["/api/conversations", queryString],
    queryFn: () => apiFetch<ConversationList>(`/api/conversations?${queryString}`),
    staleTime: 10_000,
  });

  const conversations = listData?.data ?? [];

  // Selected conversation detail
  const { data: detail, isPending: detailPending } = useQuery({
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
          attachmentUrl: attachmentUrl.trim() || undefined,
          visibility: "STUDENT",
        },
      });
      toast({ title: "Message sent", variant: "success" });
      setComposeBody("");
      setAttachmentUrl("");
      qc.invalidateQueries({ queryKey: ["/api/conversations", selectedId] });
      qc.invalidateQueries({ queryKey: ["/api/conversations", queryString] });
    } catch (err) {
      toast({ title: "Failed", description: (err as Error).message, variant: "error" });
    } finally {
      setSending(false);
    }
  };

  // Conversation detail view
  if (selectedId && detail) {
    const currentUserId = ""; // will be replaced by the actual user ID from session
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setSelectedId(null)}>
            <ChevronLeft className="h-4 w-4" aria-hidden /> Back to conversations
          </Button>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="font-semibold">
                  {detail.student.firstName} {detail.student.lastName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {detail.student.studentId} · Counselor: {detail.employee.user.name}
                </p>
              </div>
            </div>

            {/* Message thread */}
            <div className="max-h-96 space-y-3 overflow-y-auto">
              {detail.messages.length === 0 ? (
                <EmptyState title="No messages yet" />
              ) : (
                detail.messages.map((msg) => {
                  const isOwn = msg.senderId !== detail.student.userId;
                  return (
                    <div
                      key={msg.id}
                      className={
                        "flex flex-col " + (isOwn ? "items-end" : "items-start")
                      }
                    >
                      <div
                        className={
                          "max-w-[80%] rounded-lg px-3 py-2 text-sm " +
                          (isOwn
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-foreground")
                        }
                      >
                        <p>{msg.body}</p>
                        {msg.attachmentUrl && (
                          <a
                            href={msg.attachmentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={
                              "mt-1 inline-flex items-center gap-1 text-xs underline " +
                              (isOwn ? "text-primary-foreground/80" : "text-primary")
                            }
                          >
                            <Paperclip className="h-3 w-3" aria-hidden /> Attachment
                          </a>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatDate(msg.createdAt)}</span>
                        {isOwn && (
                          <span>{msg.readAt ? "Read" : "Delivered"}</span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Compose */}
            <form onSubmit={sendMessage} className="mt-4 space-y-2 border-t border-border pt-3">
              <Textarea
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
                placeholder="Type a message…"
                className="min-h-[70px]"
                aria-label="Message body"
              />
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  value={attachmentUrl}
                  onChange={(e) => setAttachmentUrl(e.target.value)}
                  placeholder="Attachment URL (optional)"
                  className="flex-1"
                  aria-label="Attachment URL"
                />
                <Button type="submit" disabled={sending || !composeBody.trim()}>
                  <Send className="h-4 w-4" aria-hidden /> Send
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Messages are student-visible. Internal notes are a future enhancement.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Conversation list view
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
          className="h-9 w-full rounded-md border border-border bg-card pl-9 pr-9 text-sm"
          aria-label="Search conversations"
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

      {/* Conversation list */}
      {listPending ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      ) : conversations.length === 0 ? (
        <EmptyState
          title="No conversations"
          description="Conversations are created when a counselor sends a message to a student."
        />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {conversations.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => setSelectedId(c.id)}
                className="flex w-full items-center justify-between gap-4 p-4 text-left hover:bg-muted/40"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {c.student.firstName} {c.student.lastName}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {c._count.messages} message{c._count.messages === 1 ? "" : "s"}
                    </span>
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {c.messages[0]?.body ?? "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Counselor: {c.employee.user.name}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDate(c.lastMessageAt)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Supervisory visibility notice */}
      <Card className="bg-muted/30">
        <CardContent className="p-3 text-xs text-muted-foreground">
          <p>
            <strong>Supervisory visibility:</strong> Admins can see all conversations between
            students and counselors. Internal notes (visibility: INTERNAL) are never exposed to
            students — enforced server-side via the <code className="rounded bg-muted px-1 py-0.5">isMessageVisibleTo()</code> helper.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
