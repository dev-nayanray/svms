"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import { ChevronDown, MapPin, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui";

/**
 * Multi-application selector for the My Application screen.
 *
 * When a student has more than one application, the header shows a
 * compact summary of the currently-selected application with a chevron
 * affordance. Tapping it opens a bottom-sheet (mobile) / dropdown
 * (desktop) listing all applications, each with country, university,
 * stage badge, and the percent.
 *
 * On mobile, the sheet slides in from the bottom; on desktop it's a
 * right-side drawer. Selecting an application closes the sheet and
 * fires `onSelect(id)`.
 */
export type ApplicationOption = {
  id: string;
  applicationNumber: string;
  countryName: string;
  countryFlag?: string | null;
  universityName?: string | null;
  courseName?: string | null;
  stageLabel: string;
  status: string;
  percent: number;
};

export function ApplicationSelector({
  options,
  selectedId,
  onSelect,
}: {
  options: ApplicationOption[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);

  // Close on Escape is handled by DialogPrimitive automatically.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const selected = options.find((o) => o.id === selectedId) ?? options[0];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-left transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-primary"
      >
        <span className="flex min-w-0 items-center gap-2">
          {selected?.countryFlag && (
            <span aria-hidden className="text-base">
              {selected.countryFlag}
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">
              {selected ? `${selected.countryName}${selected.universityName ? ` — ${selected.universityName}` : ""}` : "Select application"}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {selected ? `${selected.applicationNumber} · ${selected.stageLabel}` : ""}
            </span>
          </span>
        </span>
        <span className="flex items-center gap-2">
          {selected && (
            <Badge tone={selected.percent === 100 ? "success" : "info"}>
              {selected.percent}%
            </Badge>
          )}
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
            aria-hidden
          />
        </span>
      </button>

      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/50" />
          <DialogPrimitive.Content
            aria-label="Select application"
            className={cn(
              "fixed z-50 flex flex-col bg-card shadow-xl outline-none",
              "inset-x-0 bottom-0 top-auto max-h-[80dvh] rounded-t-2xl border-t border-border",
              "md:inset-y-0 md:left-auto md:right-0 md:top-0 md:bottom-0 md:max-h-none md:w-[440px] md:rounded-none md:border-l md:border-t-0",
            )}
          >
            <div className="flex items-center justify-between border-b border-border p-4">
              <div aria-hidden className="mx-auto mb-2 h-1 w-10 rounded-full bg-muted md:hidden" />
              <DialogPrimitive.Title className="text-base font-semibold">
                Your Applications
              </DialogPrimitive.Title>
              <DialogPrimitive.Close
                aria-label="Close"
                className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </DialogPrimitive.Close>
            </div>
            <div className="flex-1 overflow-y-auto p-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <ul className="space-y-1">
                {options.map((opt) => {
                  const isSelected = opt.id === selectedId;
                  return (
                    <li key={opt.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onSelect(opt.id);
                          setOpen(false);
                        }}
                        aria-pressed={isSelected}
                        className={cn(
                          "flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-primary",
                          isSelected ? "bg-primary/10 ring-1 ring-primary" : "hover:bg-muted",
                        )}
                      >
                        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-md bg-muted text-base" aria-hidden>
                          {opt.countryFlag || <MapPin className="h-4 w-4" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-semibold">
                              {opt.countryName}
                            </span>
                            <Badge tone={opt.percent === 100 ? "success" : "info"}>
                              {opt.percent}%
                            </Badge>
                          </span>
                          {opt.universityName && (
                            <span className="block truncate text-xs text-muted-foreground">
                              {opt.universityName}
                              {opt.courseName ? ` · ${opt.courseName}` : ""}
                            </span>
                          )}
                          <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span className="font-mono">{opt.applicationNumber}</span>
                            <span aria-hidden>·</span>
                            <span>{opt.stageLabel}</span>
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
