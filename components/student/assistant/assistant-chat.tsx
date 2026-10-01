"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Send, RotateCcw, AlertCircle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { sendMessage } from "@/lib/ai/client";

// ── Types ────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** True while the assistant message is being streamed (partial). */
  isStreaming?: boolean;
  /** True if this message resulted in an error. */
  isError?: boolean;
}

// ── Constants ────────────────────────────────────────────────────

const SUGGESTED_QUESTIONS = [
  "What is my GPA?",
  "Show my courses",
  "When is my next appointment?",
  "Show my results",
  "How is my attendance?",
  "What notifications do I have?",
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

  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to the latest message
  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Online/offline detection
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

  // Abort any in-flight request when the component unmounts
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // Focus the input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // ── Send a message ────────────────────────────────────────────

  const handleSend = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isSending) return;
      if (connectionStatus === "offline") {
        setError("You're offline. Please check your connection and try again.");
        return;
      }

      setError(null);
      setInput("");

      // Add the user's message immediately
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: trimmed,
      };

      // Add a placeholder for the assistant's streaming response
      const assistantMsgId = `assistant-${Date.now()}`;
      const assistantMsg: ChatMessage = {
        id: assistantMsgId,
        role: "assistant",
        content: "",
        isStreaming: true,
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsSending(true);

      // Create an abort controller for this request
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
                  // Remove the error message if it's empty (no text was streamed)
                  .filter((m) => !(m.id === assistantMsgId && m.content === "")),
              );
              setError(event.error.message);
              break;
          }
        }
      } catch (err) {
        // Network error or abort
        if (err instanceof Error && err.name === "AbortError") {
          // User cancelled — mark as not streaming
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? { ...m, content: m.content || "Message cancelled.", isStreaming: false }
                : m,
            ),
          );
        } else {
          const errorMsg = "Connection failed. Please check your internet and try again.";
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
        // Refocus the input
        inputRef.current?.focus();
      }
    },
    [conversationId, isSending, connectionStatus],
  );

  // ── Retry the last message ────────────────────────────────────

  const handleRetry = useCallback(() => {
    // Find the last user message
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUserMsg) return;

    // Remove the last assistant message (the error)
    setMessages((prev) => {
      const lastAssistantIdx = [...prev].reverse().findIndex((m) => m.role === "assistant");
      if (lastAssistantIdx === -1) return prev;
      return prev.slice(0, prev.length - 1 - lastAssistantIdx);
    });

    // Re-send the last user message
    handleSend(lastUserMsg.content);
  }, [messages, handleSend]);

  // ── Keydown handler (Enter to send, Shift+Enter for newline) ──

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend(input);
      }
    },
    [input, handleSend],
  );

  // ── Show suggested questions only at the start ────────────────

  const showSuggestions = messages.length === 0;

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
                  connectionStatus === "online" ? "bg-emerald-500" : "bg-red-500",
                )}
                aria-hidden
              />
              <span className="text-[11px] text-muted-foreground">
                {connectionStatus === "online" ? "Available" : "Offline"}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* ── Chat messages area ─────────────────────────────────── */}
      <div
        className="flex-1 overflow-y-auto"
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
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {/* Suggested questions (shown at the start, hidden after) */}
          {showSuggestions && (
            <div className="mt-6">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Suggested questions
              </p>
              <div className="grid gap-2">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => handleSend(q)}
                    disabled={isSending}
                    className="flex min-h-[44px] items-center rounded-xl border border-border/60 bg-card px-4 py-2.5 text-left text-sm font-medium text-foreground transition-colors hover:border-amber-300/60 hover:bg-amber-50/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 disabled:opacity-50 dark:hover:bg-amber-950/10"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Error + retry (if the last message was an error) */}
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

          {/* Scroll anchor */}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ── Input area ─────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-border/60 bg-card">
        <div className="mx-auto w-full max-w-2xl px-4 py-3">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask me anything about your studies…"
              maxLength={MAX_INPUT_LENGTH}
              rows={1}
              disabled={isSending || connectionStatus === "offline"}
              aria-label="Type your message"
              aria-placeholder="Ask me anything about your studies"
              className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border border-border/60 bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-amber-300/60 focus:outline-none focus:ring-2 focus:ring-amber-500/20 disabled:opacity-50"
              style={{
                height: "auto",
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = "auto";
                target.style.height = `${Math.min(target.scrollHeight, 128)}px`;
              }}
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
    </div>
  );
}

// ── Message bubble subcomponent ──────────────────────────────────

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const isError = message.isError;

  return (
    <div
      className={cn("mb-3 flex", isUser ? "justify-end" : "justify-start")}
      role="article"
      aria-label={isUser ? "Your message" : "Assistant message"}
    >
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
          isUser
            ? "bg-amber-500 text-white"
            : isError
              ? "border border-red-300/60 bg-red-50/40 text-red-600 dark:bg-red-950/10"
              : "border border-border/60 bg-card text-foreground",
        )}
      >
        {/* Streaming indicator (show only when streaming and content is empty) */}
        {message.isStreaming && !message.content && (
          <div className="flex items-center gap-1.5 py-0.5" aria-label="Assistant is thinking">
            <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.3s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.15s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60" />
          </div>
        )}

        {/* Message content */}
        {message.content && (
          <p className={cn("whitespace-pre-wrap break-words", isUser && "font-medium")}>
            {message.content}
            {message.isStreaming && (
              <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-current align-middle" aria-hidden />
            )}
          </p>
        )}
      </div>
    </div>
  );
}
