"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Send,
  RotateCcw,
  AlertCircle,
  Sparkles,
  Copy,
  Check,
  Trash2,
  History,
  X,
  GraduationCap,
  FileText,
  Bell,
  CalendarClock,
  CheckSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { sendMessage } from "@/lib/ai/client";
import { fetchConversations, deleteConversation as deleteConvApi } from "@/lib/ai/client";

// ── Types ────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  isError?: boolean;
}

interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
}

// ── Constants ────────────────────────────────────────────────────

const SUGGESTED_QUESTIONS = [
  { icon: GraduationCap, text: "What is my GPA?" },
  { icon: FileText, text: "Show my courses" },
  { icon: CalendarClock, text: "When is my next appointment?" },
  { icon: FileText, text: "Show my results" },
  { icon: CheckSquare, text: "What tasks are pending?" },
  { icon: Bell, text: "What notifications do I have?" },
] as const;

/** Contextual quick actions shown after the AI responds. */
const QUICK_ACTIONS = [
  "What about my documents?",
  "Show my payment summary",
  "What's my visa status?",
] as const;

const MAX_INPUT_LENGTH = 2000;

// ── Component ────────────────────────────────────────────────────

export function AssistantChat() {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"online" | "offline">("online");
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Conversation history sidebar
  const [showHistory, setShowHistory] = useState(false);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // ── Auto-scroll ───────────────────────────────────────────────

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // ── Online/offline detection ──────────────────────────────────

  useEffect(() => {
    const updateStatus = () => setConnectionStatus(navigator.onLine ? "online" : "offline");
    updateStatus();
    window.addEventListener("online", updateStatus);
    window.addEventListener("offline", updateStatus);
    return () => {
      window.removeEventListener("online", updateStatus);
      window.removeEventListener("offline", updateStatus);
    };
  }, []);

  // ── Cleanup on unmount ────────────────────────────────────────

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // ── Focus input on mount ──────────────────────────────────────

  useEffect(() => {
    // Delay focus slightly to avoid the mobile keyboard popping up
    // before the page is fully rendered.
    const timer = setTimeout(() => inputRef.current?.focus(), 300);
    return () => clearTimeout(timer);
  }, []);

  // ── Mobile keyboard optimization ──────────────────────────────
  // When the keyboard opens on mobile, the viewport shrinks. We need
  // to scroll the chat area to keep the latest message visible.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => {
      // Only scroll if we're near the bottom (don't fight the user)
      const container = scrollContainerRef.current;
      if (!container) return;
      const isNearBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight < 150;
      if (isNearBottom) {
        scrollToBottom();
      }
    };
    window.addEventListener("resize", handleResize);
    // Also handle visualViewport (more reliable on iOS)
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", handleResize);
    }
    return () => {
      window.removeEventListener("resize", handleResize);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", handleResize);
      }
    };
  }, [scrollToBottom]);

  // ── Send a message ────────────────────────────────────────────

  const handleSend = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isSending) return;
      if (connectionStatus === "offline") {
        setError("You appear to be offline. Please check your connection and try again.");
        return;
      }

      setError(null);
      setInput("");

      // Reset textarea height
      if (inputRef.current) {
        inputRef.current.style.height = "auto";
      }

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: trimmed,
      };

      const assistantMsgId = `assistant-${Date.now()}`;
      const assistantMsg: ChatMessage = {
        id: assistantMsgId,
        role: "assistant",
        content: "",
        isStreaming: true,
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsSending(true);

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        let accumulatedText = "";

        for await (const event of sendMessage({
          message: trimmed,
          conversationId: conversationId ?? undefined,
          signal: abortController.signal,
        })) {
          switch (event.type) {
            case "conversation":
              if (event.conversationId) {
                setConversationId(event.conversationId);
              }
              break;

            case "text":
              accumulatedText += event.text;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? { ...m, content: accumulatedText, isStreaming: true }
                    : m,
                ),
              );
              break;

            case "done":
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? { ...m, content: accumulatedText, isStreaming: false }
                    : m,
                ),
              );
              break;

            case "error":
              setMessages((prev) =>
                prev
                  .map((m) =>
                    m.id === assistantMsgId
                      ? {
                          ...m,
                          content: event.error.message,
                          isStreaming: false,
                          isError: true,
                        }
                      : m,
                  )
                  .filter((m) => !(m.id === assistantMsgId && m.content === "")),
              );
              setError(event.error.message);
              break;
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? { ...m, content: m.content || "Message cancelled.", isStreaming: false }
                : m,
            ),
          );
        } else {
          const errorMsg = "Something went wrong. Please check your connection and try again.";
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? { ...m, content: errorMsg, isStreaming: false, isError: true }
                : m,
            ),
          );
          setError(errorMsg);
        }
      } finally {
        setIsSending(false);
        abortControllerRef.current = null;
        inputRef.current?.focus();
      }
    },
    [conversationId, isSending, connectionStatus],
  );

  // ── Retry ─────────────────────────────────────────────────────

  const handleRetry = useCallback(() => {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUserMsg) return;

    setMessages((prev) => {
      const lastAssistantIdx = [...prev].reverse().findIndex((m) => m.role === "assistant");
      if (lastAssistantIdx === -1) return prev;
      return prev.slice(0, prev.length - 1 - lastAssistantIdx);
    });

    handleSend(lastUserMsg.content);
  }, [messages, handleSend]);

  // ── Copy response ─────────────────────────────────────────────

  const handleCopy = useCallback(async (content: string, msgId: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(msgId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Clipboard API not available — silently ignore
    }
  }, []);

  // ── Clear conversation ────────────────────────────────────────

  const handleClear = useCallback(() => {
    if (messages.length === 0) return;
    if (!confirm("Clear this conversation? This cannot be undone.")) return;

    // Abort any in-flight request
    abortControllerRef.current?.abort();

    setMessages([]);
    setConversationId(null);
    setError(null);
    setInput("");
    inputRef.current?.focus();
  }, [messages.length]);

  // ── Conversation history sidebar ──────────────────────────────

  const handleLoadHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const data = await fetchConversations();
      setConversations(
        data.conversations.map((c) => ({
          id: c.id,
          title: c.title,
          updatedAt: c.updatedAt,
          messageCount: c.messageCount,
        })),
      );
    } catch {
      // Silently fail — the sidebar just shows "No conversations"
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  const handleOpenHistory = useCallback(() => {
    setShowHistory(true);
    handleLoadHistory();
  }, [handleLoadHistory]);

  const handleCloseHistory = useCallback(() => {
    setShowHistory(false);
  }, []);

  const handleSelectConversation = useCallback(
    async (convId: string) => {
      setShowHistory(false);
      setMessages([]);
      setConversationId(convId);
      setError(null);

      // Load the conversation's messages
      try {
        const res = await fetch(`/api/student/assistant/conversations/${convId}`);
        if (res.ok) {
          const body = await res.json();
          const msgs = body.data?.conversation?.messages ?? [];
          setMessages(
            msgs.map((m: { role: string; content: string }, i: number) => ({
              id: `loaded-${i}`,
              role: m.role as "user" | "assistant",
              content: m.content,
            })),
          );
        }
      } catch {
        // If loading fails, start fresh with this conversation ID
      }

      inputRef.current?.focus();
    },
    [],
  );

  const handleDeleteConversation = useCallback(
    async (convId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await deleteConvApi(convId);
        setConversations((prev) => prev.filter((c) => c.id !== convId));
        if (convId === conversationId) {
          setMessages([]);
          setConversationId(null);
        }
      } catch {
        // Silently fail
      }
    },
    [conversationId],
  );

  // ── Keydown handler ───────────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend(input);
      }
    },
    [input, handleSend],
  );

  // ── Derived state ─────────────────────────────────────────────

  const showSuggestions = messages.length === 0;
  const showQuickActions = !showSuggestions && !isSending && messages.length > 0 && !error;
  const lastAssistantMsg = [...messages].reverse().find((m) => m.role === "assistant" && !m.isError);

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="flex h-[100dvh] flex-col bg-background">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border/60 bg-card px-3">
        <button
          onClick={() => router.push("/student")}
          aria-label="Back to dashboard"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 active:scale-95"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </button>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-500/10 text-amber-600">
            <Sparkles className="h-4 w-4" aria-hidden />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-bold tracking-tight">AI Assistant</h1>
            <div className="flex items-center gap-1">
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  isSending ? "animate-pulse bg-amber-500" : connectionStatus === "online" ? "bg-emerald-500" : "bg-red-500",
                )}
                aria-hidden
              />
              <span className="text-[11px] text-muted-foreground">
                {isSending ? "Thinking…" : connectionStatus === "online" ? "Available" : "Offline"}
              </span>
            </div>
          </div>
        </div>

        {/* History button */}
        <button
          onClick={handleOpenHistory}
          aria-label="Conversation history"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 active:scale-95"
        >
          <History className="h-5 w-5" aria-hidden />
        </button>

        {/* Clear button (only when there are messages) */}
        {messages.length > 0 && (
          <button
            onClick={handleClear}
            aria-label="Clear conversation"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 active:scale-95"
          >
            <Trash2 className="h-5 w-5" aria-hidden />
          </button>
        )}
      </header>

      {/* ── Chat messages area ─────────────────────────────────── */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto overscroll-contain"
        role="log"
        aria-label="Chat messages"
        aria-live="polite"
      >
        <div className="mx-auto w-full max-w-2xl px-4 py-4">
          {/* Empty state */}
          {showSuggestions && (
            <div className="flex flex-col items-center py-8 text-center">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-amber-500/10 text-amber-600">
                <Sparkles className="h-6 w-6" aria-hidden />
              </div>
              <h2 className="mt-3 text-base font-bold tracking-tight">How can I help you?</h2>
              <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                Ask me about your application, courses, documents, tasks, appointments, and more.
              </p>
            </div>
          )}

          {/* Messages */}
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isCopied={copiedId === msg.id}
              onCopy={() => handleCopy(msg.content, msg.id)}
            />
          ))}

          {/* Suggested questions (shown at start) */}
          {showSuggestions && (
            <div className="mt-6">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Suggested questions
              </p>
              <div className="grid gap-2">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q.text}
                    onClick={() => handleSend(q.text)}
                    disabled={isSending}
                    className="flex min-h-[44px] items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-2.5 text-left text-sm font-medium text-foreground transition-colors hover:border-amber-300/60 hover:bg-amber-50/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 disabled:opacity-50 dark:hover:bg-amber-950/10"
                  >
                    <q.icon className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
                    {q.text}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Contextual quick actions (shown after AI responds) */}
          {showQuickActions && lastAssistantMsg && !lastAssistantMsg.isStreaming && (
            <div className="mt-4 flex flex-wrap gap-2">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action}
                  onClick={() => handleSend(action)}
                  className="inline-flex min-h-[36px] items-center rounded-full border border-border/60 bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-amber-300/60 hover:bg-amber-50/30 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 dark:hover:bg-amber-950/10"
                >
                  {action}
                </button>
              ))}
            </div>
          )}

          {/* Error + retry */}
          {error && !isSending && (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-red-300/60 bg-red-50/40 p-3 dark:bg-red-950/10">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600" aria-hidden />
                <p className="text-xs text-red-600">{error}</p>
              </div>
              <button
                onClick={handleRetry}
                className="inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-500/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                Retry
              </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ── Input area ─────────────────────────────────────────── */}
      <div
        className="shrink-0 border-t border-border/60 bg-card"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0px)" }}
      >
        <div className="mx-auto w-full max-w-2xl px-4 py-3">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask me anything…"
              maxLength={MAX_INPUT_LENGTH}
              rows={1}
              disabled={isSending || connectionStatus === "offline"}
              aria-label="Type your message"
              className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border border-border/60 bg-background px-4 py-2.5 text-base text-foreground placeholder:text-muted-foreground focus:border-amber-300/60 focus:outline-none focus:ring-2 focus:ring-amber-500/20 disabled:opacity-50"
              style={{ height: "auto" }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = "auto";
                target.style.height = `${Math.min(target.scrollHeight, 128)}px`;
              }}
              // Prevent iOS zoom on focus — font-size must be ≥ 16px
              // (handled by text-base = 16px above)
              autoComplete="off"
              autoCorrect="off"
              spellCheck="true"
              enterKeyHint="send"
            />
            <button
              onClick={() => handleSend(input)}
              disabled={!input.trim() || isSending || connectionStatus === "offline"}
              aria-label="Send message"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-500 text-white transition-all hover:bg-amber-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 active:scale-95 disabled:opacity-40 disabled:active:scale-100"
            >
              {isSending ? (
                <span
                  className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                  aria-label="Sending"
                />
              ) : (
                <Send className="h-4 w-4" aria-hidden />
              )}
            </button>
          </div>
          <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
            Press Enter to send · Shift+Enter for a new line
          </p>
        </div>
      </div>

      {/* ── Conversation history sidebar ───────────────────────── */}
      {showHistory && (
        <div
          className="fixed inset-0 z-50 bg-black/50"
          onClick={handleCloseHistory}
          aria-hidden
        >
          <div
            className="absolute right-0 top-0 h-full w-80 max-w-[85vw] overflow-y-auto bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Conversation history"
          >
            {/* Sidebar header */}
            <div className="sticky top-0 flex h-14 items-center justify-between border-b border-border/60 bg-card px-4">
              <h2 className="text-sm font-bold tracking-tight">Conversations</h2>
              <button
                onClick={handleCloseHistory}
                aria-label="Close history"
                className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            {/* Sidebar content */}
            <div className="p-3">
              {isLoadingHistory ? (
                <div className="flex items-center justify-center py-8">
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-amber-500/30 border-t-amber-500" />
                </div>
              ) : conversations.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No conversations yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {conversations.map((conv) => (
                    <div
                      key={conv.id}
                      onClick={() => handleSelectConversation(conv.id)}
                      className="group flex cursor-pointer items-center gap-3 rounded-xl border border-border/60 p-3 transition-colors hover:border-amber-300/60 hover:bg-amber-50/30 dark:hover:bg-amber-950/10"
                    >
                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-500/10 text-amber-600">
                        <Sparkles className="h-4 w-4" aria-hidden />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{conv.title}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {conv.messageCount} messages · {formatRelativeTime(conv.updatedAt)}
                        </p>
                      </div>
                      <button
                        onClick={(e) => handleDeleteConversation(conv.id, e)}
                        aria-label="Delete conversation"
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground opacity-0 transition-opacity hover:bg-red-500/10 hover:text-red-600 group-hover:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Message bubble subcomponent ──────────────────────────────────

function MessageBubble({
  message,
  isCopied,
  onCopy,
}: {
  message: ChatMessage;
  isCopied: boolean;
  onCopy: () => void;
}) {
  const isUser = message.role === "user";
  const isError = message.isError;
  const canCopy = !isUser && !message.isStreaming && message.content && !isError;

  return (
    <div
      className={cn("mb-3 flex", isUser ? "justify-end" : "justify-start")}
      role="article"
      aria-label={isUser ? "Your message" : "Assistant message"}
    >
      <div className="max-w-[85%]">
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
            isUser
              ? "bg-amber-500 text-white"
              : isError
                ? "border border-red-300/60 bg-red-50/40 text-red-600 dark:bg-red-950/10"
                : "border border-border/60 bg-card text-foreground",
          )}
        >
          {/* Streaming indicator */}
          {message.isStreaming && !message.content && (
            <div className="flex items-center gap-1.5 py-0.5" aria-label="Assistant is thinking">
              <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.3s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.15s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60" />
            </div>
          )}

          {/* Message content — rendered as markdown-like text */}
          {message.content && (
            <div className="whitespace-pre-wrap break-words">
              <RenderedContent content={message.content} isUser={isUser} />
              {message.isStreaming && (
                <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-current align-middle" aria-hidden />
              )}
            </div>
          )}
        </div>

        {/* Action bar (copy button) — shown for completed assistant messages */}
        {canCopy && (
          <div className="mt-1 flex justify-start pl-1">
            <button
              onClick={onCopy}
              aria-label={isCopied ? "Copied" : "Copy response"}
              className="inline-flex min-h-[28px] items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {isCopied ? (
                <>
                  <Check className="h-3 w-3 text-emerald-500" aria-hidden />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" aria-hidden />
                  Copy
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Simple markdown-like content renderer ────────────────────────

/**
 * Renders AI message content with basic formatting:
 * - **bold** → <strong>
 * - Lines starting with • or - → bullet list
 * - Lines starting with # → section header
 * - Otherwise → plain paragraph
 *
 * This is intentionally simple — no external markdown library needed.
 * The AI is instructed to use these simple formats in the system prompt.
 */
function RenderedContent({ content, isUser }: { content: string; isUser: boolean }) {
  if (isUser) {
    return <span className="font-medium">{content}</span>;
  }

  // Split into lines and process
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let bulletGroup: string[] = [];

  function flushBullets(key: number) {
    if (bulletGroup.length === 0) return;
    elements.push(
      <ul key={`bullets-${key}`} className="my-1 space-y-0.5 pl-1">
        {bulletGroup.map((b, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-amber-500" aria-hidden>•</span>
            <span>{renderInlineFormatting(b)}</span>
          </li>
        ))}
      </ul>,
    );
    bulletGroup = [];
  }

  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    // Empty line — flush bullets, add spacing
    if (!trimmed) {
      flushBullets(idx);
      if (elements.length > 0) {
        elements.push(<div key={`gap-${idx}`} className="h-1.5" />);
      }
      return;
    }

    // Section header (# Header)
    if (trimmed.startsWith("# ")) {
      flushBullets(idx);
      elements.push(
        <p key={`header-${idx}`} className="mt-2 mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          {trimmed.slice(2)}
        </p>,
      );
      return;
    }

    // Bullet point (• or - or *)
    if (/^[•\-*]\s/.test(trimmed)) {
      bulletGroup.push(trimmed.replace(/^[•\-*]\s/, ""));
      return;
    }

    // Table row (| col1 | col2 |)
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      flushBullets(idx);
      const cells = trimmed.split("|").filter((c) => c.trim()).map((c) => c.trim());
      // Skip separator rows (|---|---|)
      if (cells.every((c) => /^[-:]+$/.test(c))) return;
      elements.push(
        <div key={`table-${idx}`} className="my-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
          {cells.map((cell, i) => (
            <span key={i} className={i === 0 ? "font-semibold" : "text-muted-foreground"}>
              {renderInlineFormatting(cell)}
            </span>
          ))}
        </div>,
      );
      return;
    }

    // Regular paragraph
    flushBullets(idx);
    elements.push(
      <p key={`para-${idx}`} className="my-0.5">
        {renderInlineFormatting(trimmed)}
      </p>,
    );
  });

  flushBullets(999);

  return <>{elements}</>;
}

/**
 * Render inline formatting: **bold** → <strong>
 */
function renderInlineFormatting(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-bold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

// ── Helpers ──────────────────────────────────────────────────────

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
