"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Filter, X, Plus, MessageSquare, AlertCircle } from "lucide-react";
import { Button, Badge, Card, CardContent } from "@/components/ui";
import { cn, formatDate, initials } from "@/lib/utils";
import type { ConversationListItem } from "@/lib/services/message-cases";
type Props = {
  initialRows: ConversationListItem[];
  initialPage: number;
  initialPageSize: number;
  initialTotal: number;
  initialTotalPages: number;
  initialSearch: string;
  initialUnreadOnly: boolean;
  initialStudentId?: string;
  canCreate: boolean;
  studentHint: string | null;
};

export function ConversationListClient({
  initialRows,
  initialPage,
  initialPageSize,
  initialTotal,
  initialTotalPages,
  initialSearch,
  initialUnreadOnly,
  initialStudentId,
  canCreate,
  studentHint,
}: Props) {
  const router = useRouter();
  const [search, setSearch] = useState(initialSearch);
  const [unreadOnly, setUnreadOnly] = useState(initialUnreadOnly);
  const [rows, setRows] = useState(initialRows);
  const [page, setPage] = useState(initialPage);
  const [total, setTotal] = useState(initialTotal);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newConvOpen, setNewConvOpen] = useState(false);

  // Debounced search + filter refresh.
  useEffect(() => {
    const handle = setTimeout(() => {
      if (search === initialSearch && unreadOnly === initialUnreadOnly && page === initialPage) return;
      void refresh(1);
    }, 300);
    return () => clearTimeout(handle);
    // depends on (search, unreadOnly) only
  }, [search, unreadOnly]);

  // Poll for new messages every 30s when on page 1 with no filters — keeps
  // the unread badge fresh without re-fetching the whole list.
  useEffect(() => {
    if (page !== 1 || search || unreadOnly) return;
    const id = setInterval(() => {
      void refresh(page, true);
    }, 30_000);
    return () => clearInterval(id);
    // depends on (page, search, unreadOnly)
  }, [page, search, unreadOnly]);

  async function refresh(targetPage: number, silent = false) {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (unreadOnly) params.set("unreadOnly", "true");
      if (initialStudentId) params.set("studentId", initialStudentId);
      params.set("page", String(targetPage));
      params.set("pageSize", String(initialPageSize));
      const res = await fetch(`/api/employee/messages?${params.toString()}`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error?.message ?? `Failed (${res.status})`);
      }
      setRows(data.data.rows);
      setTotal(data.data.total);
      setTotalPages(data.data.totalPages);
      setPage(data.data.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error — please retry.");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  const hasFilters = Boolean(search) || unreadOnly;

  return (
    <div>
      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex flex-1 min-w-[200px] items-center gap-2 rounded-md border border-input bg-background px-2.5 py-1.5">
          <Search className="h-4 w-4 text-muted-foreground" aria-hidden />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by student name, email, or subject…"
            aria-label="Search conversations"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => setUnreadOnly((v) => !v)}
          aria-pressed={unreadOnly}
          className={cn(
            "flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm transition-colors",
            unreadOnly
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-background text-muted-foreground hover:text-foreground",
          )}
        >
          <Filter className="h-3.5 w-3.5" aria-hidden />
          Unread only
        </button>
        {hasFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              setUnreadOnly(false);
            }}
          >
            Clear
          </Button>
        )}
        {canCreate && (
          <Button type="button" size="sm" onClick={() => setNewConvOpen(true)}>
            <Plus className="h-3.5 w-3.5" aria-hidden /> New
          </Button>
        )}
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
          <span className="flex-1">{error}</span>
          <Button variant="ghost" size="sm" onClick={() => void refresh(page)}>
            Retry
          </Button>
        </div>
      )}

      {/* Hint banner when filtered by studentId */}
      {initialStudentId && studentHint && (
        <div className="mb-4 rounded-md border border-info/30 bg-info/5 p-3 text-sm text-info">
          Showing conversations with <strong>{studentHint}</strong>.{" "}
          <Link href="/employee/messages" className="underline">Show all</Link>
        </div>
      )}

      {/* List */}
      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <EmptyState hasFilters={hasFilters} canCreate={canCreate} onCreate={() => setNewConvOpen(true)} />
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((c) => {
                return (
                  <li key={c.id}>
                    <Link
                      href={`/employee/messages/${c.id}`}
                      className="flex items-center gap-3 p-4 hover:bg-muted/30"
                    >
                      {/* Avatar */}
                      <span
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
                        aria-hidden
                      >
                        {initials(`${c.student.firstName} ${c.student.lastName}`) || "S"}
                      </span>

                      {/* Main */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium">
                            {c.student.firstName} {c.student.lastName}
                          </p>
                          {c.application && (
                            <Badge tone="default" className="shrink-0 text-[10px]">
                              {c.application.applicationNumber}
                            </Badge>
                          )}
                          {c.lastMessage?.kind === "INTERNAL_NOTE" && (
                            <Badge tone="warning" className="shrink-0 text-[10px]">Internal note</Badge>
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {c.lastMessage?.body ?? c.subject ?? "No messages yet"}
                        </p>
                      </div>

                      {/* Right column */}
                      <div className="flex flex-col items-end gap-1">
                        {c.unreadCount > 0 ? (
                          <Badge tone="info">{c.unreadCount} unread</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">{formatDate(c.updatedAt)}</span>
                        )}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
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

      {newConvOpen && (
        <NewConversationDialog
          onClose={() => setNewConvOpen(false)}
          onCreated={(id) => {
            setNewConvOpen(false);
            router.push(`/employee/messages/${id}`);
          }}
        />
      )}
    </div>
  );
}

// Helper to detect "I sent the last message" — currently unused but reserved
// for future UI tweaks (e.g. show "You: ..." prefix).
// (Removed — re-introduce when needed.)

function EmptyState({
  hasFilters,
  canCreate,
  onCreate,
}: {
  hasFilters: boolean;
  canCreate: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 p-12 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-muted">
        <MessageSquare className="h-5 w-5 text-muted-foreground" aria-hidden />
      </span>
      <div>
        <p className="text-sm font-medium">
          {hasFilters ? "No conversations match these filters." : "No conversations yet"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {hasFilters
            ? "Try adjusting your search or clearing the unread filter."
            : "When a student is assigned to you, their messages will appear here."}
        </p>
      </div>
      {canCreate && !hasFilters && (
        <Button size="sm" onClick={onCreate}>
          <Plus className="h-3.5 w-3.5" aria-hidden /> Start a conversation
        </Button>
      )}
    </div>
  );
}

// Lightweight "New conversation" dialog. Fetches students assigned to the
// caller via /api/employee/students (existing endpoint returns a list).
function NewConversationDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [students, setStudents] = useState<{ id: string; name: string; email: string }[]>([]);
  const [selected, setSelected] = useState("");
  const [subject, setSubject] = useState("");
  const [firstMessage, setFirstMessage] = useState("");
  const [kind, setKind] = useState<"STUDENT_MESSAGE" | "INTERNAL_NOTE">("STUDENT_MESSAGE");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/employee/students?pageSize=50", { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (res.ok && data?.success) {
          setStudents(
            (data.data.rows ?? []).map((s: { id: string; firstName: string; lastName: string; email: string }) => ({
              id: s.id,
              name: `${s.firstName} ${s.lastName}`,
              email: s.email,
            })),
          );
        }
      } catch {
        // ignore — user can still type a subject + message
      }
    })();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) {
      setError("Please select a student.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/employee/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: selected,
          subject: subject || undefined,
          firstMessage: firstMessage || undefined,
          firstMessageKind: kind,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error?.message ?? `Failed (${res.status})`);
      }
      onCreated(data.data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error — please retry.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div className="relative z-10 w-[95vw] max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
        <h2 className="text-base font-semibold">New conversation</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Start a thread with an assigned student.
        </p>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <div>
            <label htmlFor="nc-student" className="text-xs font-medium text-muted-foreground">Student</label>
            <select
              id="nc-student"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              required
            >
              <option value="">Select a student…</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>{s.name} — {s.email}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="nc-subject" className="text-xs font-medium text-muted-foreground">Subject (optional)</label>
            <input
              id="nc-subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={200}
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="nc-msg" className="text-xs font-medium text-muted-foreground">First message</label>
            <textarea
              id="nc-msg"
              value={firstMessage}
              onChange={(e) => setFirstMessage(e.target.value)}
              rows={3}
              maxLength={10_000}
              className="mt-1 flex min-h-[80px] w-full rounded-md border border-input bg-background px-2 py-2 text-sm"
              placeholder="Type the first message…"
            />
          </div>
          <div className="flex gap-2">
            <label className="flex items-center gap-1.5 text-xs">
              <input
                type="radio"
                name="kind"
                value="STUDENT_MESSAGE"
                checked={kind === "STUDENT_MESSAGE"}
                onChange={() => setKind("STUDENT_MESSAGE")}
              />
              Student-visible
            </label>
            <label className="flex items-center gap-1.5 text-xs">
              <input
                type="radio"
                name="kind"
                value="INTERNAL_NOTE"
                checked={kind === "INTERNAL_NOTE"}
                onChange={() => setKind("INTERNAL_NOTE")}
              />
              Internal note
            </label>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            <Button type="submit" size="sm" disabled={sending || !firstMessage.trim()}>
              {sending ? "Sending…" : "Start"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
