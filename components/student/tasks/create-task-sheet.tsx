"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  CalendarClock,
  CheckSquare,
  Loader2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, Input, Label, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";

const PRIORITIES = [
  { value: "LOW", label: "Low", tone: "bg-muted text-muted-foreground" },
  { value: "MEDIUM", label: "Medium", tone: "bg-info/15 text-info" },
  { value: "HIGH", label: "High", tone: "bg-warning/15 text-warning" },
  { value: "URGENT", label: "Urgent", tone: "bg-destructive/15 text-destructive" },
] as const;

const TITLE_SUGGESTIONS = [
  "Gather bank statements",
  "Renew passport",
  "Schedule IELTS test",
  "Research housing options",
  "Collect recommendation letters",
  "Notify employer of leave",
  "Book flight tickets",
] as const;

/**
 * Bottom-sheet (mobile) / right-drawer (desktop) form for creating
 * a personal (self-assigned) task. Students use this to track their
 * own to-dos alongside counselor-assigned tasks — useful for
 * "remember to gather bank statements" type things that aren't
 * formally tracked by the counselor.
 *
 * Lifecycle states:
 *  - idle       — form is editable, no submit in flight
 *  - submitting — POST in flight; the submit button shows a spinner
 *  - success    — brief "Task created" toast, then sheet closes
 *  - error      — error toast + sheet stays open so the student can retry
 *
 * The `key` prop should be bumped by the parent each time the sheet
 * opens, so React remounts this component and all useState initializers
 * run fresh.
 */
export function CreateTaskSheet({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Called after a successful create — parent should invalidate the
   * tasks list query and switch to the "all" tab. */
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<string>("MEDIUM");
  const [dueDate, setDueDate] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lock body scroll while sheet is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  function applySuggestion(s: string) {
    setTitle(s);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // ── Client-side validation (server is source of truth) ──
    if (title.trim().length < 3) {
      setError("Title must be at least 3 characters.");
      return;
    }

    // Parse dueDate if provided
    let dueDateIso: string | undefined;
    if (dueDate) {
      const parsed = new Date(dueDate);
      if (isNaN(parsed.getTime())) {
        setError("Due date looks invalid — please pick again.");
        return;
      }
      // Allow up to 2 minutes in the past for clock drift.
      if (parsed.getTime() < Date.now() - 2 * 60 * 1000) {
        setError("Due date must be in the future. Pick an upcoming date.");
        return;
      }
      dueDateIso = parsed.toISOString();
    }

    setSubmitting(true);
    try {
      await apiFetch("/api/student/tasks", {
        method: "POST",
        json: {
          title: title.trim(),
          ...(description.trim() ? { description: description.trim() } : {}),
          priority,
          ...(dueDateIso ? { dueDate: dueDateIso } : {}),
        },
      });
      toast({
        title: "Task created",
        description: "Your personal task has been added to your list.",
        variant: "success",
      });
      onCreated();
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Couldn't create the task";
      setError(msg);
      toast({ title: "Failed", description: msg, variant: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />
        <DialogPrimitive.Content
          className={cn(
            "fixed z-50 flex flex-col bg-card shadow-xl outline-none",
            "inset-x-0 bottom-0 top-auto max-h-[92dvh] rounded-t-2xl border-t border-border",
            "md:inset-y-0 md:left-auto md:right-0 md:top-0 md:bottom-0 md:max-h-none md:w-[480px] md:rounded-none md:border-l md:border-t-0",
          )}
        >
          {/* ── Header ── */}
          <div className="flex items-start justify-between gap-3 border-b border-border p-4 pb-3">
            <div className="min-w-0">
              <div aria-hidden className="mx-auto mb-2 h-1 w-10 rounded-full bg-muted md:hidden" />
              <DialogPrimitive.Title className="truncate text-base font-semibold">
                New personal task
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-0.5 text-xs text-muted-foreground">
                Track your own to-dos alongside your counselor&rsquo;s tasks.
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close
              aria-label="Close"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>

          {/* ── Body — form ── */}
          <form
            onSubmit={handleSubmit}
            className="flex flex-1 flex-col overflow-hidden"
          >
            <div className="flex-1 overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] space-y-4">
              {/* Title — required */}
              <div className="space-y-1.5">
                <Label htmlFor="task-title">
                  Title
                  <span className="ml-1 text-destructive" aria-hidden>*</span>
                </Label>
                <Input
                  id="task-title"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Gather bank statements"
                  maxLength={200}
                  disabled={submitting}
                  autoFocus
                />
                <p className="text-[11px] text-muted-foreground">
                  {title.length}/200 characters
                </p>
              </div>

              {/* Quick-select suggestions */}
              <div className="space-y-1.5">
                <Label>Quick suggestions</Label>
                <div className="flex flex-wrap gap-1.5">
                  {TITLE_SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => applySuggestion(s)}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary",
                        title === s
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-card text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Priority */}
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <div className="grid grid-cols-4 gap-1.5">
                  {PRIORITIES.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setPriority(p.value)}
                      aria-pressed={priority === p.value}
                      className={cn(
                        "flex min-h-[36px] items-center justify-center rounded-md px-2 py-1.5 text-xs font-semibold transition-all focus-visible:outline-2 focus-visible:outline-primary",
                        priority === p.value
                          ? cn(p.tone, "ring-2 ring-offset-1 ring-offset-card")
                          : "border border-border bg-card text-muted-foreground hover:bg-muted",
                        priority === p.value && p.value === "LOW" && "ring-muted-foreground/40",
                        priority === p.value && p.value === "MEDIUM" && "ring-info/40",
                        priority === p.value && p.value === "HIGH" && "ring-warning/40",
                        priority === p.value && p.value === "URGENT" && "ring-destructive/40",
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Due date — optional */}
              <div className="space-y-1.5">
                <Label htmlFor="task-due-date">
                  Due date <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="task-due-date"
                  type="datetime-local"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  disabled={submitting}
                  min={new Date().toISOString().slice(0, 16)}
                />
                <p className="text-[11px] text-muted-foreground">
                  Pick an upcoming date — your counselor isn&rsquo;t notified of personal tasks.
                </p>
              </div>

              {/* Notes / description — optional */}
              <div className="space-y-1.5">
                <Label htmlFor="task-description">
                  Notes <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Textarea
                  id="task-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add any details that will help you remember what to do — e.g. 'last 6 months, from primary account'."
                  maxLength={2000}
                  disabled={submitting}
                  rows={4}
                />
                <p className="text-[11px] text-muted-foreground">
                  {description.length}/2000 characters
                </p>
              </div>

              {/* Inline error */}
              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1">{error}</span>
                </div>
              )}
            </div>

            {/* ── Sticky footer ── */}
            <div className="border-t border-border p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <Button
                type="submit"
                disabled={submitting}
                className="w-full"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Creating…
                  </>
                ) : (
                  <>
                    <CheckSquare className="h-4 w-4" aria-hidden />
                    Create task
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

// Helper — re-export for parent components that want a preview icon
export function TaskPriorityBadge({ priority }: { priority: string }) {
  const p = PRIORITIES.find((x) => x.value === priority) ?? PRIORITIES[1];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide", p.tone)}>
      {p.label}
    </span>
  );
}

// Re-export for the page wiring
export { CalendarClock };
