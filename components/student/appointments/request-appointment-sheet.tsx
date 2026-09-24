"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import { CalendarClock, Loader2, X, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, Input, Select, Label, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";

/**
 * Bottom-sheet (mobile) / right-drawer (desktop) form for requesting
 * a new appointment. The student proposes a preferred date+time +
 * purpose + meeting method + notes; the counselor then either
 * approves (→ SCHEDULED, possibly with adjusted time/location) or
 * rejects (→ CANCELLED). The sheet is intentionally dumb: it owns
 * form state and the submission lifecycle, but the parent owns the
 * appointment list cache (TanStack Query).
 *
 * Lifecycle states:
 *  - idle      — form is editable, no submit in flight
 *  - submitting— POST in flight; the submit button shows a spinner
 *  - success   — brief "Request submitted" toast, then sheet closes
 *  - error     — error toast, sheet stays open so the student can retry
 *
 * The `key` prop should be bumped by the parent each time the sheet
 * opens, so React remounts this component and all useState initializers
 * run fresh — this is the React-recommended alternative to syncing
 * props to state in effects.
 */

const MEETING_METHODS = [
  { value: "", label: "No preference" },
  { value: "VIDEO_CALL", label: "Video call" },
  { value: "PHONE_CALL", label: "Phone call" },
  { value: "IN_PERSON", label: "In-person" },
] as const;

const PURPOSE_SUGGESTIONS = [
  "Visa interview preparation",
  "Document review",
  "Application status update",
  "University shortlisting",
  "Payment & invoice questions",
  "Other",
] as const;

/** Returns a datetime-local string for "tomorrow 14:00" in the
 * caller's local timezone — the default value for the preferredAt
 * field. We don't use "now" because picking the current minute
 * almost always fails the "must be in the future" check by the time
 * the student hits Submit. */
function defaultPreferredAt(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(14, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function RequestAppointmentSheet({
  open,
  onOpenChange,
  onRequested,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Called after a successful request — parent should invalidate
   * the appointments list query and switch to the "requested" tab. */
  onRequested: () => void;
}) {
  const { toast } = useToast();
  const [preferredAt, setPreferredAt] = useState<string>(defaultPreferredAt());
  const [purpose, setPurpose] = useState<string>("");
  const [purposePreset, setPurposePreset] = useState<string>("");
  const [meetingMethod, setMeetingMethod] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lock body scroll while the sheet is open. Side effect on the DOM
  // (not React state), so it doesn't trigger set-state-in-effect.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  function onPurposePresetChange(value: string) {
    setPurposePreset(value);
    if (value && value !== "Other") {
      setPurpose(value);
    } else if (value === "Other") {
      setPurpose("");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // ── Client-side validation (server is source of truth) ──
    if (!preferredAt) {
      setError("Please pick a preferred date and time.");
      return;
    }
    const isoDate = new Date(preferredAt);
    if (isNaN(isoDate.getTime())) {
      setError("Preferred date looks invalid — please pick again.");
      return;
    }
    if (isoDate.getTime() < Date.now() - 2 * 60 * 1000) {
      setError("Preferred date must be in the future.");
      return;
    }
    if (purpose.trim().length < 3) {
      setError("Purpose must be at least 3 characters.");
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch("/api/student/appointments/request", {
        method: "POST",
        json: {
          preferredAt: isoDate.toISOString(),
          purpose: purpose.trim(),
          ...(meetingMethod ? { meetingMethod } : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        },
      });
      toast({
        title: "Request submitted",
        description: "Your counselor has been notified. You'll see a notification when they respond.",
        variant: "success",
      });
      onRequested();
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Couldn't submit your request";
      setError(msg);
      toast({ title: "Request failed", description: msg, variant: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/50" />
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
                Request appointment
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-0.5 text-xs text-muted-foreground">
                Propose a time and purpose — your counselor will review and confirm.
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
            aria-describedby="request-appt-desc"
          >
            <div className="flex-1 overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] space-y-4">
              {/* Preferred date + time */}
              <div className="space-y-1.5">
                <Label htmlFor="preferred-at">
                  Preferred date &amp; time
                  <span className="ml-1 text-red-600" aria-hidden>*</span>
                </Label>
                <Input
                  id="preferred-at"
                  type="datetime-local"
                  required
                  value={preferredAt}
                  onChange={(e) => setPreferredAt(e.target.value)}
                  disabled={submitting}
                  min={new Date().toISOString().slice(0, 16)}
                />
                <p className="text-[11px] text-muted-foreground">
                  Pick any upcoming slot. Your counselor may suggest a different time.
                </p>
              </div>

              {/* Purpose preset chips (quick-select) */}
              <div className="space-y-1.5">
                <Label>Common purposes</Label>
                <div className="flex flex-wrap gap-1.5">
                  {PURPOSE_SUGGESTIONS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => onPurposePresetChange(p === "Other" ? "Other" : p)}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-amber-500",
                        purposePreset === p
                          ? "border-amber-500 bg-amber-500/10 text-amber-600"
                          : "border-border bg-card text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Purpose — free text (synced from preset, editable) */}
              <div className="space-y-1.5">
                <Label htmlFor="purpose">
                  Purpose
                  <span className="ml-1 text-red-600" aria-hidden>*</span>
                </Label>
                <Input
                  id="purpose"
                  required
                  value={purpose}
                  onChange={(e) => {
                    setPurpose(e.target.value);
                    // If the student starts typing after picking a preset,
                    // mark preset as "Other" so the chip reflects reality.
                    if (purposePreset && purposePreset !== "Other" && e.target.value !== purposePreset) {
                      setPurposePreset("Other");
                    }
                  }}
                  placeholder="e.g. Visa interview preparation"
                  maxLength={200}
                  disabled={submitting}
                />
              </div>

              {/* Meeting method preference */}
              <div className="space-y-1.5">
                <Label htmlFor="meeting-method">Meeting preference</Label>
                <Select
                  id="meeting-method"
                  value={meetingMethod}
                  onChange={(e) => setMeetingMethod(e.target.value)}
                  disabled={submitting}
                >
                  {MEETING_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </Select>
              </div>

              {/* Notes — optional */}
              <div className="space-y-1.5">
                <Label htmlFor="notes">
                  Notes <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any context for your counselor — e.g. what you'd like to discuss, documents to bring, etc."
                  maxLength={2000}
                  disabled={submitting}
                  rows={4}
                />
                <p className="text-[11px] text-muted-foreground tabular-nums">
                  {notes.length}/2000 characters
                </p>
              </div>

              {/* Inline error — server / validation messages */}
              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-lg border border-red-300/60 bg-red-50/40 p-3 text-sm text-red-600 dark:bg-red-950/10"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1">{error}</span>
                </div>
              )}
            </div>

            {/* ── Sticky footer with submit ── */}
            <div className="border-t border-border p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <Button
                type="submit"
                disabled={submitting}
                className="w-full"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Submitting…
                  </>
                ) : (
                  <>
                    <CalendarClock className="h-4 w-4" aria-hidden />
                    Submit request
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
