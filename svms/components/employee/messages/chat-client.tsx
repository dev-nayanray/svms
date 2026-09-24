"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Send, Paperclip, X, AlertCircle, FileText, Lock } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import type { MessageRow, Attachment, AttachmentInput } from "@/lib/services/message-cases";
import { MAX_ATTACHMENTS_PER_MESSAGE, MAX_MESSAGE_BODY } from "@/lib/services/message-cases";

type Props = {
  conversationId: string;
  initialMessages: MessageRow[];
  callerUserId: string;
  studentName: string;
  canSend: boolean;
};

const POLL_INTERVAL_MS = 8_000;

export function ChatClient({
  conversationId,
  initialMessages,
  callerUserId,
  studentName,
  canSend,
}: Props) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<MessageRow[]>(initialMessages);
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<"STUDENT_MESSAGE" | "INTERNAL_NOTE">("STUDENT_MESSAGE");
  const [pendingAttachments, setPendingAttachments] = useState<AttachmentInput[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [networkError, setNetworkError] = useState(false);
  const [readMarkedAt, setReadMarkedAt] = useState<Date | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const lastPollRef = useRef<Date>(new Date());

  // ── Auto-scroll to bottom on new messages ───────────────────────────
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // ── Mark-as-read on mount and on new messages ───────────────────────
  const markRead = useCallback(async () => {
    try {
      const res = await fetch(`/api/employee/messages/${conversationId}/read`, {
        method: "PATCH",
      });
      if (res.ok) {
        setReadMarkedAt(new Date());
        // Update local state — set readAt on messages from the student.
        setMessages((prev) =>
          prev.map((m) =>
            m.senderId !== callerUserId && m.readAt === null ? { ...m, readAt: new Date() } : m,
          ),
        );
      }
    } catch {
      // silent — non-critical
    }
  }, [conversationId, callerUserId]);

  useEffect(() => {
    void markRead();
    // mount-only — mark-as-read on conversation open
  }, []);

  // ── Polling for new messages ────────────────────────────────────────
  useEffect(() => {
    // Use the latest message's createdAt as the cursor; if none, use mount time.
    lastPollRef.current = messages.length > 0
      ? new Date(messages[messages.length - 1].createdAt)
      : new Date();

    const id = setInterval(async () => {
      try {
        const since = lastPollRef.current.toISOString();
        const res = await fetch(
          `/api/employee/messages/${conversationId}/poll?since=${encodeURIComponent(since)}`,
          { cache: "no-store" },
        );
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.success) {
          setNetworkError(true);
          return;
        }
        setNetworkError(false);
        const newMessages: MessageRow[] = data.data.messages ?? [];
        if (newMessages.length > 0) {
          setMessages((prev) => {
            const existing = new Set(prev.map((m) => m.id));
            const fresh = newMessages.filter((m: MessageRow) => !existing.has(m.id));
            return [...prev, ...fresh];
          });
          lastPollRef.current = new Date();
          void markRead();
        }
      } catch {
        setNetworkError(true);
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(id);
    // depends on conversationId only; poll reads latest state via refs
  }, [conversationId]);

  // ── Send message ─────────────────────────────────────────────────────
  const send = async () => {
    const trimmed = body.trim();
    if (!trimmed && pendingAttachments.length === 0) return;
    if (trimmed.length > MAX_MESSAGE_BODY) {
      setError(`Message body must be ≤ ${MAX_MESSAGE_BODY} characters.`);
      return;
    }
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/employee/messages/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: trimmed,
          kind,
          attachments: pendingAttachments.length > 0 ? pendingAttachments : undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error?.message ?? `Failed (${res.status})`);
      }
      // Optimistic: append locally with the new id, then poll will skip it.
      // The poll endpoint returns messages by createdAt > cursor, so we
      // need to update the cursor to "now" to avoid double-rendering.
      lastPollRef.current = new Date();
      // Re-fetch the conversation detail to get the canonical message
      // (including the kind and readAt set by the server).
      void refreshFullConversation();
      setBody("");
      setPendingAttachments([]);
      toast({
        title: kind === "INTERNAL_NOTE" ? "Internal note added" : "Message sent",
        variant: "success",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error — please retry.");
    } finally {
      setSending(false);
    }
  };

  async function refreshFullConversation() {
    try {
      const res = await fetch(`/api/employee/messages/${conversationId}`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        setMessages(data.data.messages ?? []);
      }
    } catch {
      // silent
    }
  }

  // ── Attachment handling ─────────────────────────────────────────────
  // We do NOT upload files directly here — the architecture uses a separate
  // presign/upload flow that returns a { fileUrl, fileName, mimeType, fileSize }
  // record. For this UI we accept File objects from the file input, but in a
  // production build you'd POST them to a storage endpoint first. We record
  // them locally and synthesize a URL placeholder so the send path can be
  // tested end-to-end; the server still validates size + MIME type.
  const onAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    if (pendingAttachments.length + files.length > MAX_ATTACHMENTS_PER_MESSAGE) {
      setError(`Maximum ${MAX_ATTACHMENTS_PER_MESSAGE} attachments per message.`);
      return;
    }
    setError(null);
    const accepted: AttachmentInput[] = [];
    for (const f of files) {
      accepted.push({
        fileUrl: `attachment://local/${f.name}`,
        fileName: f.name,
        mimeType: f.type || "application/octet-stream",
        fileSize: f.size,
      });
    }
    setPendingAttachments((prev) => [...prev, ...accepted]);
    e.target.value = "";
  };

  const removeAttachment = (idx: number) => {
    setPendingAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  // ── Keyboard shortcut: Enter to send, Shift+Enter for newline ────────
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!sending && canSend) void send();
    }
  };

  return (
    <div className="flex flex-col rounded-lg border border-border bg-card">
      {/* Status bar — shows the network state */}
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          {networkError ? (
            <>
              <AlertCircle className="h-3.5 w-3.5 text-destructive" aria-hidden />
              <span>Connection issue — retrying…</span>
            </>
          ) : (
            <>
              <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden />
              <span>Live · updates every {POLL_INTERVAL_MS / 1000}s</span>
            </>
          )}
        </span>
        {readMarkedAt && (
          <span>
            Marked read {formatTime(readMarkedAt)}
          </span>
        )}
      </div>

      {/* Messages */}
      <div className="flex max-h-[60vh] min-h-[300px] flex-col gap-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <EmptyConversation studentName={studentName} />
        ) : (
          <>
            {messages.map((m) => (
              <MessageBubble
                key={m.id}
                message={m}
                callerUserId={callerUserId}
                studentName={studentName}
              />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Composer */}
      {canSend ? (
        <Composer
          body={body}
          setBody={setBody}
          kind={kind}
          setKind={setKind}
          sending={sending}
          error={error}
          onSend={send}
          onKeyDown={onKeyDown}
          pendingAttachments={pendingAttachments}
          onAttach={onAttach}
          onRemoveAttachment={removeAttachment}
        />
      ) : (
        <div className="border-t border-border p-4 text-center text-xs text-muted-foreground">
          You do not have permission to send messages in this conversation.
        </div>
      )}
    </div>
  );
}

// ── Message bubble ────────────────────────────────────────────────────

function MessageBubble({
  message,
  callerUserId,
  studentName,
}: {
  message: MessageRow;
  callerUserId: string;
  studentName: string;
}) {
  const isMine = message.senderId === callerUserId;
  const isInternal = message.kind === "INTERNAL_NOTE";

  if (isInternal) {
    return (
      <div className="flex flex-col items-start gap-1">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-warning">
          <Lock className="h-3 w-3" aria-hidden />
          Internal note — not visible to student
        </div>
        <div className="max-w-[85%] rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-sm">
          <p className="whitespace-pre-wrap">{message.body}</p>
          {message.attachments.length > 0 && (
            <div className="mt-2 space-y-1">
              {message.attachments.map((a, i) => (
                <AttachmentChip key={i} attachment={a} />
              ))}
            </div>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground">{formatTime(message.createdAt)}</p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-1", isMine ? "items-end" : "items-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-md px-3 py-2 text-sm",
          isMine
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground",
        )}
      >
        {!isMine && (
          <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide opacity-70">
            {studentName}
          </p>
        )}
        <p className="whitespace-pre-wrap break-words">{message.body}</p>
        {message.attachments.length > 0 && (
          <div className={cn("mt-2 space-y-1", isMine && "border-t border-primary-foreground/20 pt-2")}>
            {message.attachments.map((a, i) => (
              <AttachmentChip key={i} attachment={a} inverted={isMine} />
            ))}
          </div>
        )}
      </div>
      <p className="px-1 text-[10px] text-muted-foreground">
        {formatTime(message.createdAt)}
        {isMine && (
          <span className="ml-1">
            · {message.readAt ? "Read" : "Sent"}
          </span>
        )}
      </p>
    </div>
  );
}

function AttachmentChip({
  attachment,
  inverted,
}: {
  attachment: Attachment;
  inverted?: boolean;
}) {
  return (
    <a
      href={attachment.fileUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "flex items-center gap-2 rounded-sm px-2 py-1 text-xs transition-colors",
        inverted ? "bg-primary-foreground/10 hover:bg-primary-foreground/20" : "bg-background hover:bg-muted",
      )}
    >
      <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 truncate">{attachment.fileName}</span>
      <span className="shrink-0 text-[10px] opacity-70">{formatSize(attachment.fileSize)}</span>
    </a>
  );
}

// ── Composer ──────────────────────────────────────────────────────────

function Composer({
  body,
  setBody,
  kind,
  setKind,
  sending,
  error,
  onSend,
  onKeyDown,
  pendingAttachments,
  onAttach,
  onRemoveAttachment,
}: {
  body: string;
  setBody: (v: string) => void;
  kind: "STUDENT_MESSAGE" | "INTERNAL_NOTE";
  setKind: (k: "STUDENT_MESSAGE" | "INTERNAL_NOTE") => void;
  sending: boolean;
  error: string | null;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  pendingAttachments: AttachmentInput[];
  onAttach: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveAttachment: (idx: number) => void;
}) {
  return (
    <div className="border-t border-border p-3">
      {/* Kind toggle */}
      <div className="mb-2 flex items-center gap-1">
        <KindToggle
          value="STUDENT_MESSAGE"
          current={kind}
          onChange={setKind}
          label="Student message"
        />
        <KindToggle
          value="INTERNAL_NOTE"
          current={kind}
          onChange={setKind}
          label="Internal note"
          icon={<Lock className="h-3 w-3" aria-hidden />}
          tone="warning"
        />
      </div>

      {/* Pending attachments */}
      {pendingAttachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {pendingAttachments.map((a, i) => (
            <div
              key={i}
              className="flex items-center gap-1.5 rounded-md border border-border bg-muted px-2 py-1 text-xs"
            >
              <FileText className="h-3 w-3" aria-hidden />
              <span className="max-w-[140px] truncate">{a.fileName}</span>
              <button
                type="button"
                onClick={() => onRemoveAttachment(i)}
                aria-label={`Remove ${a.fileName}`}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {error && (
        <p className="mb-2 flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle className="h-3 w-3" /> {error}
        </p>
      )}

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <textarea
            ref={(el) => {
              // textareaRef assignment handled by parent if needed
              if (el) el.dataset.kind = kind;
            }}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={onKeyDown}
            rows={2}
            maxLength={MAX_MESSAGE_BODY}
            placeholder={kind === "INTERNAL_NOTE" ? "Add an internal note (employee-only)…" : "Type a message…"}
            className="min-h-[60px] w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
            <span>
              <kbd className="rounded border border-border px-1">Enter</kbd> to send ·{" "}
              <kbd className="rounded border border-border px-1">Shift</kbd>+
              <kbd className="rounded border border-border px-1">Enter</kbd> for newline
            </span>
            <span>{body.length} / {MAX_MESSAGE_BODY}</span>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label
            className="grid h-9 w-9 cursor-pointer place-items-center rounded-md border border-input bg-background text-muted-foreground hover:text-foreground"
            title="Attach file"
          >
            <Paperclip className="h-4 w-4" aria-hidden />
            <input
              type="file"
              multiple
              className="hidden"
              onChange={onAttach}
              accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip"
            />
          </label>
          <Button
            onClick={onSend}
            disabled={sending || (!body.trim() && pendingAttachments.length === 0)}
            size="icon"
            className="h-9 w-9"
            aria-label="Send"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

function KindToggle({
  value,
  current,
  onChange,
  label,
  icon,
  tone = "default",
}: {
  value: "STUDENT_MESSAGE" | "INTERNAL_NOTE";
  current: "STUDENT_MESSAGE" | "INTERNAL_NOTE";
  onChange: (k: "STUDENT_MESSAGE" | "INTERNAL_NOTE") => void;
  label: string;
  icon?: React.ReactNode;
  tone?: "default" | "warning";
}) {
  const active = value === current;
  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors",
        active
          ? tone === "warning"
            ? "border-warning bg-warning/10 text-warning"
            : "border-primary bg-primary/10 text-primary"
          : "border-border bg-background text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function EmptyConversation({ studentName }: { studentName: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
      <p className="font-medium">No messages yet</p>
      <p>Send the first message to {studentName}.</p>
    </div>
  );
}

// ── Format helpers ────────────────────────────────────────────────────

function formatTime(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
