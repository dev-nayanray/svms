"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  CheckSquare,
  FileText,
  GraduationCap,
  Loader2,
  MessageSquare,
  Search,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";

// ── Types (mirror the API response shape) ─────────────────────────

type SearchResult = {
  id: string;
  title: string;
  subtitle?: string;
  href: string;
  icon: string;
};

type SearchResponse = {
  query: string;
  groups: {
    universities: SearchResult[];
    courses: SearchResult[];
    documents: SearchResult[];
    tasks: SearchResult[];
    messages: SearchResult[];
  };
  total: number;
};

// ── Icon resolver ─────────────────────────────────────────────────

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Building2,
  GraduationCap,
  FileText,
  CheckSquare,
  MessageSquare,
};

function ResultIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? Search;
  return <Icon className={className} aria-hidden />;
}

// ── Group config ──────────────────────────────────────────────────

type GroupKey = keyof SearchResponse["groups"];

const GROUPS: { key: GroupKey; label: string }[] = [
  { key: "universities", label: "Universities" },
  { key: "courses", label: "Courses" },
  { key: "documents", label: "Documents" },
  { key: "tasks", label: "Tasks" },
  { key: "messages", label: "Messages" },
];

// ── Component ─────────────────────────────────────────────────────

/**
 * GlobalSearchOverlay — full-screen overlay triggered from the
 * header search button or the Cmd/Ctrl+K keyboard shortcut.
 *
 * UX:
 *  - Tap search icon in header → overlay slides down (mobile) /
 *    appears as a centered dialog (desktop)
 *  - Input auto-focuses; typing triggers a debounced search (250ms)
 *  - Results are grouped by type: Universities, Courses, Documents,
 *    Tasks, Messages — each with its own header + count
 *  - Each result is a button — clicking closes the overlay + navigates
 *  - Empty state when query < 2 chars (shows a hint)
 *  - Loading state with spinner + skeleton rows
 *  - Esc closes the overlay (Radix default)
 *
 * Performance:
 *  - 250ms debounce so we don't fire a request per keystroke
 *  - staleTime: 30s so backspacing + retyping the same query is free
 *  - retry: false so a flaky network doesn't auto-retry mid-search
 *
 * Accessibility:
 *  - DialogPrimitive auto-handles focus trap + restore on close
 *  - Esc closes (Radix default)
 *  - Each result is a button with proper role + label
 *  - Loading state has aria-busy + role=status
 */
export function GlobalSearchOverlay({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Auto-focus the input when the overlay opens + clear state on close.
  useEffect(() => {
    if (open) {
      // Small delay so Radix's focus-trap setup completes first.
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
    // Clear query when closing so the next open starts fresh.
    setQuery("");
    setDebouncedQuery("");
  }, [open]);

  // Debounce the query — 250ms is enough that fast typing doesn't
  // fire a request per keystroke, but feels instant to the user.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  // Only search if query is >= 2 chars (server-side enforces this too).
  const searchable = debouncedQuery.length >= 2;

  const searchQ = useQuery<SearchResponse>({
    queryKey: ["student-search", debouncedQuery],
    queryFn: () =>
      apiFetch<SearchResponse>(
        `/api/student/search?q=${encodeURIComponent(debouncedQuery)}&limit=8`,
      ),
    enabled: searchable,
    retry: false,
    staleTime: 30_000,
  });

  const results = searchQ.data;
  const isLoading = searchable && searchQ.isFetching;
  const total = results?.total ?? 0;

  function handleResultClick(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
        <DialogPrimitive.Content
          className={cn(
            "fixed z-50 flex flex-col bg-card shadow-2xl outline-none",
            // Mobile: full-screen sheet
            "inset-x-0 top-0 bottom-0 rounded-none border-0",
            // Desktop: centered dialog
            "md:inset-x-0 md:top-[10%] md:bottom-auto md:left-1/2 md:-translate-x-1/2",
            "md:w-[min(640px,90vw)] md:rounded-2xl md:border md:border-border",
            "md:max-h-[80vh]",
          )}
          aria-describedby={undefined}
        >
          {/* ── Search input row ── */}
          <div className="flex items-center gap-2 border-b border-border p-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Search className="h-4 w-4" aria-hidden />
              )}
            </span>
            <DialogPrimitive.Title asChild>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search universities, courses, documents, tasks…"
                className="min-w-0 flex-1 bg-transparent text-base font-medium outline-none placeholder:text-muted-foreground/60"
                aria-label="Search query"
                autoComplete="off"
                spellCheck={false}
                maxLength={100}
              />
            </DialogPrimitive.Title>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="Close search"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* ── Results / empty / loading state ── */}
          <div
            className="flex-1 overflow-y-auto p-3"
            aria-busy={isLoading}
            role={isLoading ? "status" : undefined}
          >
            {!searchable ? (
              <EmptyHintState />
            ) : isLoading && !results ? (
              <LoadingState />
            ) : total === 0 ? (
              <NoResultsState query={debouncedQuery} />
            ) : (
              <div className="space-y-4">
                {GROUPS.map((group) => {
                  const items = results?.groups?.[group.key] ?? [];
                  if (items.length === 0) return null;
                  return (
                    <SearchGroup
                      key={group.key}
                      label={group.label}
                      count={items.length}
                      items={items}
                      onResultClick={handleResultClick}
                    />
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Footer — keyboard hints (desktop only) ── */}
          <div className="hidden items-center justify-between gap-2 border-t border-border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground md:flex">
            <span className="flex items-center gap-1.5">
              <kbd className="rounded border border-border bg-card px-1.5 py-0.5 text-[10px] font-semibold">↵</kbd>
              to open
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="rounded border border-border bg-card px-1.5 py-0.5 text-[10px] font-semibold">Esc</kbd>
              to close
            </span>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

// ── Sub-components ────────────────────────────────────────────────

function SearchGroup({
  label,
  count,
  items,
  onResultClick,
}: {
  label: string;
  count: number;
  items: SearchResult[];
  onResultClick: (href: string) => void;
}) {
  return (
    <section aria-label={label}>
      <div className="mb-1.5 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </h3>
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
          {count}
        </span>
      </div>
      <ul className="space-y-0.5">
        {items.map((item) => (
          <li key={`${label}-${item.id}`}>
            <button
              type="button"
              onClick={() => onResultClick(item.href)}
              className="group flex w-full items-center gap-3 rounded-lg border border-transparent p-2 text-left transition-all hover:border-border hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-primary"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                <ResultIcon name={item.icon} className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium leading-tight">{item.title}</p>
                {item.subtitle && (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {item.subtitle}
                  </p>
                )}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function EmptyHintState() {
  return (
    <div className="py-8 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
        <Search className="h-6 w-6" aria-hidden />
      </span>
      <h2 className="mt-3 text-sm font-semibold">Start typing to search</h2>
      <p className="mx-auto mt-1 max-w-xs text-xs text-muted-foreground">
        Find universities, courses, documents, tasks, and messages across your student panel.
      </p>
      <div className="mx-auto mt-4 flex max-w-xs flex-wrap items-center justify-center gap-1.5">
        {["universities", "courses", "documents", "tasks", "messages"].map((s) => (
          <span
            key={s}
            className="rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
          >
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-3 py-2" aria-busy="true" aria-label="Searching">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-lg border border-border p-2"
        >
          <div className="h-8 w-8 shrink-0 animate-pulse rounded-md bg-muted" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

function NoResultsState({ query }: { query: string }) {
  return (
    <div className="py-8 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
        <Search className="h-6 w-6" aria-hidden />
      </span>
      <h2 className="mt-3 text-sm font-semibold">No results for &ldquo;{query}&rdquo;</h2>
      <p className="mx-auto mt-1 max-w-xs text-xs text-muted-foreground">
        Try different keywords or check your spelling. Search covers universities, courses, documents, tasks, and messages.
      </p>
    </div>
  );
}
