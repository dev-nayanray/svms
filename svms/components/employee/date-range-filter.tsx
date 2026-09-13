"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui";
import {
  DASHBOARD_RANGE_LABELS,
  DASHBOARD_RANGE_PRESETS,
  type DashboardRangePreset,
} from "@/lib/utils/dashboard-range";

/**
 * Date-range filter — small client component because the chips call
 * `router.push()` to update the URL (which re-renders the page server-side).
 *
 * The current preset is derived from the URL so it round-trips correctly
 * on back/forward navigation. For the `custom` preset, the user opens a
 * native date-range picker (two `<input type="date">`) which then pushes
 * the resolved `from`/`to` query params.
 */
export function DateRangeFilter({
  activePreset,
  customFrom,
  customTo,
}: {
  activePreset: DashboardRangePreset;
  customFrom?: string;
  customTo?: string;
}) {
  const pathname = usePathname();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Calendar className="h-3.5 w-3.5" aria-hidden /> Range:
      </div>
      <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Date range filter">
        {DASHBOARD_RANGE_PRESETS.map((preset) => (
          <Link
            key={preset}
            href={{
              pathname,
              query: preset === "custom" && customFrom && customTo
                ? { preset, from: customFrom, to: customTo }
                : { preset },
            }}
            aria-current={activePreset === preset ? "page" : undefined}
            className={cn(
              "inline-flex h-8 items-center rounded-md border px-2.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
              activePreset === preset
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {DASHBOARD_RANGE_LABELS[preset]}
          </Link>
        ))}
      </div>
      {activePreset === "custom" && (
        <CustomRangePicker initialFrom={customFrom} initialTo={customTo} pathname={pathname} />
      )}
    </div>
  );
}

function CustomRangePicker({
  initialFrom,
  initialTo,
  pathname,
}: {
  initialFrom?: string;
  initialTo?: string;
  pathname: string;
}) {
  return (
    <form
      className="flex items-center gap-1.5"
      action={(formData) => {
        const from = formData.get("from") as string;
        const to = formData.get("to") as string;
        if (from && to) {
          const params = new URLSearchParams({ preset: "custom", from, to });
          window.location.href = `${pathname}?${params.toString()}`;
        }
      }}
    >
      <input
        type="date"
        name="from"
        defaultValue={initialFrom}
        aria-label="From date"
        className="h-8 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-2 focus-visible:outline-ring"
        required
      />
      <span className="text-xs text-muted-foreground">–</span>
      <input
        type="date"
        name="to"
        defaultValue={initialTo}
        aria-label="To date"
        className="h-8 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-2 focus-visible:outline-ring"
        required
      />
      <Button type="submit" size="sm" variant="outline" className="h-8">
        Apply
      </Button>
    </form>
  );
}

/** Small spinner shown while the page server-side re-renders on filter change. */
export function FilterPending({ pending }: { pending: boolean }) {
  if (!pending) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Updating…
    </span>
  );
}
