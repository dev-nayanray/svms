"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCheck,
  Paperclip,
  RefreshCw,
  Send,
  UserRound,
  WifiOff,
} from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui";
import { MobileCard } from "@/components/student/ui";
import { Skeleton } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { format, parseISO, isSameDay } from "date-fns";

// ── Types ──────────────────────────────────────────────────────────

type ChatMessage = {
  id: string;
  senderId: string;
  body: string;
  attachmentUrl: string | null;
  readAt: string | null;
  createdAt: string;
  isMine: boolean;
};

type Conversation = {
  id: string;
  counselorName: string;
  counselorInitials: string;
  counselorId: string;
  messages: ChatMessage[];
  unreadCount: number;
};

type ConversationResponse = { conversation: Conversation };

// ── Component ──────────────────────────────────────────────────────

export function ChatView({ conversationId }: { conversationId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const online = useOnlineStatus();

  // Fetch the conversation — polls every 5 seconds when active
  const detailQ = useQuery<ConversationResponse>({
    queryKey: ["student-conversation", conversationId],
    queryFn: () => apiFetch<ConversationResponse>(`/api/student/messages/${conversationId}`),
    retry: false,
    // Poll every 5 seconds for near-real-time message delivery
    refetchInterval: 5_000,
    staleTime: 3_000,
  });

  // Auto-scroll to bottom when messages change
  const messages = useMemo(() => detailQ.data?.conversation.messages ?? [], [detailQ.data]);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Show "saved" state briefly after a successful send
  const [justSent, setJustSent] = useState<string | null>(null);
  useEffect(() => {
    if (justSent) {
      const t = setTimeout(() => setJustSent(null), 2000);
      return () => clearTimeout(t);
    }
  }, [justSent]);

  // Group messages by date for date separators — MUST be before any
  // early returns so hooks ordering is stable.
  const groupedMessages = useMemo(() => {
    const groups: { date: string; messages: ChatMessage[] }[] = [];
    for (const msg of messages) {
      const msgDate = parseISO(msg.createdAt);
      const dateKey = format(msgDate, "yyyy-MM-dd");
      const lastGroup = groups[groups.length - 1];
      if (lastGroup && lastGroup.date === dateKey) {
        lastGroup.messages.push(msg);
      } else {
        groups.push({ date: dateKey, messages: [msg] });
      }
    }
    return groups;
  }, [messages]);

  if (detailQ.isLoading && !detailQ.data) {
    return (
      <div className="flex h-[calc(100dvh-3.5rem-2rem)] md:h-[calc(100dvh-3.5rem-3rem)] flex-col">
        <ChatHeader name="" initials="" onBack={() => router.push("/student/messages")} />
        <div className="flex-1 space-y-3 p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className={cn("h-12 rounded-2xl", i % 2 === 0 ? "w-3/4" : "ml-auto w-2/3")} />
          ))}
        </div>
      </div>
    );
  }

  if (detailQ.isError || !detailQ.data?.conversation) {
    return (
      <div className="flex h-[calc(100dvh-3.5rem-2rem)] md:h-[calc(100dvh-3.5rem-3rem)] flex-col">
        <ChatHeader name="" initials="" onBack={() => router.push("/student/messages")} />
        <div className="flex flex-1 items-center justify-center p-4">
          <MobileCard className="py-6 text-center">
            <AlertTriangle className="mx-auto h-8 w-8 text-destructive" aria-hidden />
            <p className="mt-2 text-sm text-muted-foreground">
              {detailQ.error instanceof Error ? detailQ.error.message : "Conversation not found."}
            </p>
            <Button size="sm" variant="outline" className="mt-3" onClick={() => detailQ.refetch()}>
              <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Retry
            </Button>
          </MobileCard>
        </div>
      </div>
    );
  }

  const conversation = detailQ.data.conversation;
  const canSend = input.trim().length > 0 && !sending && online;

  async function handleSend() {
    if (!canSend) return;
    const body = input.trim();
    setInput("");
    setSending(true);

    // Optimistic: add the message locally immediately
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: ChatMessage = {
      id: tempId,
      senderId: "",
      body,
      attachmentUrl: null,
      readAt: null,
      createdAt: new Date().toISOString(),
      isMine: true,
    };

    qc.setQueryData<ConversationResponse>(["student-conversation", conversationId], (prev) =>
      prev
        ? {
            conversation: {
              ...prev.conversation,
              messages: [...prev.conversation.messages, optimisticMsg],
            },
          }
        : prev,
    );

    try {
      const result = await apiFetch<{ message: ChatMessage }>(
        `/api/student/messages/${conversationId}/messages`,
        { method: "POST", json: { body } },
      );
      // Replace the temp message with the real one
      qc.setQueryData<ConversationResponse>(["student-conversation", conversationId], (prev) =>
        prev
          ? {
              conversation: {
                ...prev.conversation,
                messages: prev.conversation.messages.map((m) =>
                  m.id === tempId ? result.message : m,
                ),
              },
            }
          : prev,
      );
      setJustSent(tempId);
      // Also invalidate the inbox so the preview updates
      qc.invalidateQueries({ queryKey: ["student-conversations"] });
    } catch (err) {
      // Remove the optimistic message on failure
      qc.setQueryData<ConversationResponse>(["student-conversation", conversationId], (prev) =>
        prev
          ? {
              conversation: {
                ...prev.conversation,
                messages: prev.conversation.messages.filter((m) => m.id !== tempId),
              },
            }
          : prev,
      );
      // Restore the input text so the student can retry
      setInput(body);
      toast({
        title: "Failed to send",
        description: err instanceof Error ? err.message : "Try again",
        variant: "error",
      });
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex h-[calc(100dvh-3.5rem-2rem)] md:h-[calc(100dvh-3.5rem-3rem)] flex-col bg-muted/20">
      {/* Chat header */}
      <ChatHeader
        name={conversation.counselorName}
        initials={conversation.counselorInitials}
        onBack={() => router.push("/student/messages")}
      />

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
              <UserRound className="h-6 w-6" aria-hidden />
            </span>
            <p className="text-sm font-medium">Start the conversation</p>
            <p className="text-xs text-muted-foreground">
              Send a message to your counselor. They&apos;ll respond as soon as they can.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {groupedMessages.map((group) => (
              <div key={group.date}>
                {/* Date separator */}
                <div className="my-3 flex items-center justify-center">
                  <span className="rounded-full bg-muted px-3 py-1 text-[11px] font-medium text-muted-foreground">
                    {formatDateSeparator(group.date)}
                  </span>
                </div>
                {/* Messages */}
                {group.messages.map((msg) => (
                  <MessageBubble key={msg.id} message={msg} justSent={justSent === msg.id} />
                ))}
              </div>
            ))}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <div className="border-t border-border bg-card px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {!online && (
          <div className="mb-1 flex items-center justify-center gap-1 text-[11px] text-warning">
            <WifiOff className="h-3 w-3" aria-hidden /> Offline — messages will be queued
          </div>
        )}
        <div className="flex items-end gap-2">
          <button
            type="button"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"
            aria-label="Attach file (coming soon)"
            disabled
          >
            <Paperclip className="h-5 w-5" aria-hidden />
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message…"
            rows={1}
            disabled={sending}
            className="max-h-32 min-h-[40px] flex-1 resize-none rounded-2xl border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            aria-label="Message input"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            aria-label="Send message"
            className={cn(
              "grid h-10 w-10 shrink-0 place-items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-primary",
              canSend
                ? "bg-primary text-primary-foreground hover:bg-primary-hover"
                : "bg-muted text-muted-foreground/50",
            )}
          >
            {sending ? (
              <RefreshCw className="h-5 w-5 animate-spin" aria-hidden />
            ) : (
              <Send className="h-5 w-5" aria-hidden />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Chat header ────────────────────────────────────────────────────

function ChatHeader({
  name,
  initials,
  onBack,
}: {
  name: string;
  initials: string;
  onBack: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-card/95 px-2 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <button
        onClick={onBack}
        aria-label="Back to messages"
        className="grid h-11 w-11 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
      >
        <ArrowLeft className="h-5 w-5" aria-hidden />
      </button>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
        {initials || <UserRound className="h-4 w-4" aria-hidden />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{name || "Counselor"}</p>
        <p className="text-[11px] text-muted-foreground">Auto-refreshes every 5s</p>
      </div>
    </header>
  );
}

// ── Message bubble ─────────────────────────────────────────────────

function MessageBubble({ message, justSent }: { message: ChatMessage; justSent?: boolean }) {
  const isMine = message.isMine;
  const time = format(parseISO(message.createdAt), "h:mm a");
  const isRead = !!message.readAt;

  return (
    <div className={cn("flex", isMine ? "justify-end" : "justify-start")}>
      <div className={cn(
        "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
        isMine
          ? "rounded-br-sm bg-primary text-primary-foreground"
          : "rounded-bl-sm border border-border bg-card text-foreground",
      )}>
        <p className="whitespace-pre-wrap break-words">{message.body}</p>
        {message.attachmentUrl && (
          <a
            href={message.attachmentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "mt-1 inline-flex items-center gap-1 text-xs underline",
              isMine ? "text-primary-foreground/80" : "text-primary",
            )}
          >
            <Paperclip className="h-3 w-3" aria-hidden /> Attachment
          </a>
        )}
        <div className={cn(
          "mt-0.5 flex items-center gap-1 text-[10px]",
          isMine ? "text-primary-foreground/60" : "text-muted-foreground",
        )}>
          <span>{time}</span>
          {justSent && <span className="text-success">✓ Sent</span>}
          {isMine && isRead && <CheckCheck className="h-3 w-3" aria-hidden />}
          {isMine && !isRead && !justSent && <Check className="h-3 w-3" aria-hidden />}
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────

function formatDateSeparator(dateStr: string): string {
  try {
    const date = parseISO(dateStr + "T00:00:00Z");
    const now = new Date();
    if (isSameDay(date, now)) return "Today";
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (isSameDay(date, yesterday)) return "Yesterday";
    return format(date, "MMM d, yyyy");
  } catch {
    return dateStr;
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
