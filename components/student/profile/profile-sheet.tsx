"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui";

/**
 * Full-screen-on-mobile / side-drawer-on-desktop edit sheet for the
 * profile module.
 *
 * On mobile (< md) it slides in from the bottom and takes up to 92dvh
 * of the viewport, with the form body scrollable and the save button
 * pinned to the bottom in the safe area.
 *
 * On desktop (≥ md) it slides in from the right as a 480px-wide
 * drawer — the same shape used by the admin shells for record edits.
 *
 * The sheet is intentionally dumb: the parent owns form state, the
 * saving/saved/error flags, and the close behavior. The sheet renders
 * a sticky footer with a primary Save button and a secondary Cancel,
 * and disables both while a save is in flight.
 */
export function ProfileSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  onSave,
  saving,
  saveLabel = "Save",
  cancelLabel = "Cancel",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  onSave: () => void;
  saving?: boolean;
  saveLabel?: string;
  cancelLabel?: string;
}) {
  // Lock body scroll while the sheet is open so the underlying page
  // doesn't bleed through on touch devices.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(
            "fixed z-50 flex flex-col bg-card shadow-xl outline-none",
            // Mobile: bottom sheet, 92dvh max, full width, rounded top
            "inset-x-0 bottom-0 top-auto max-h-[92dvh] rounded-t-2xl border-t border-border",
            // Desktop: right drawer, 480px wide, full height
            "md:inset-y-0 md:left-auto md:right-0 md:top-0 md:bottom-0 md:max-h-none md:w-[480px] md:rounded-none md:border-l md:border-t-0"
          )}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 border-b border-border p-4 pb-3">
            <div className="min-w-0">
              {/* Mobile drag handle */}
              <div aria-hidden className="mx-auto mb-2 h-1 w-10 rounded-full bg-muted md:hidden" />
              <DialogPrimitive.Title className="truncate text-base font-semibold">
                {title}
              </DialogPrimitive.Title>
              {description && (
                <DialogPrimitive.Description className="mt-0.5 text-xs text-muted-foreground">
                  {description}
                </DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close
              aria-label="Close"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            {children}
          </div>

          {/* Sticky footer with action buttons */}
          <div className="flex items-center gap-2 border-t border-border bg-card p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
              className="flex-1"
              type="button"
            >
              {cancelLabel}
            </Button>
            <Button onClick={onSave} disabled={saving} className="flex-1" type="button">
              {saving ? "Saving…" : saveLabel}
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** Labeled field wrapper used by all section forms. */
export function Field({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1 text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-destructive" aria-hidden>*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
