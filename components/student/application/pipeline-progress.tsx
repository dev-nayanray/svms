"use client";

import { cn } from "@/lib/utils";
import type { StageMarker } from "@/lib/utils/application-pipeline";

/**
 * Vertical pipeline view for mobile. Each stage is a row with a
 * state indicator (✓ / dot / — / number), a label, and a connecting
 * line to the next stage.
 *
 * The component is presentational only — state computation is done
 * server-side in `computeStageStates` and the result is passed in.
 *
 * On desktop (md+), the same data renders as a horizontal scrollable
 * strip via the `variant="horizontal"` prop.
 */
export function PipelineProgress({
  stages,
  variant = "vertical",
}: {
  stages: StageMarker[];
  variant?: "vertical" | "horizontal";
}) {
  if (stages.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No pipeline configured.</p>
    );
  }

  if (variant === "horizontal") {
    return <HorizontalPipeline stages={stages} />;
  }
  return <VerticalPipeline stages={stages} />;
}

function VerticalPipeline({ stages }: { stages: StageMarker[] }) {
  return (
    <ol aria-label="Application pipeline" className="relative space-y-0">
      {stages.map((s, i) => {
        const isLast = i === stages.length - 1;
        return (
          <li key={s.key} className="relative flex gap-3 pb-4 last:pb-0">
            {!isLast && (
              <span
                aria-hidden
                className={cn(
                  "absolute left-[11px] top-6 h-[calc(100%-16px)] w-0.5",
                  s.state === "completed" ? "bg-primary" : "bg-border",
                )}
              />
            )}
            <StageDot state={s.state} index={i} />
            <div className="min-w-0 flex-1 pt-0.5">
              <p
                className={cn(
                  "text-sm leading-5",
                  s.state === "current" && "font-semibold text-foreground",
                  s.state === "completed" && "font-medium text-foreground",
                  s.state === "upcoming" && "text-muted-foreground",
                  s.state === "skipped" && "text-muted-foreground line-through",
                )}
              >
                {s.name}
                {s.state === "current" && (
                  <span className="sr-only"> (current stage)</span>
                )}
                {s.state === "skipped" && (
                  <span className="sr-only"> (skipped)</span>
                )}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function HorizontalPipeline({ stages }: { stages: StageMarker[] }) {
  return (
    <div
      role="region"
      aria-label="Application pipeline (horizontal)"
      className="overflow-x-auto pb-2"
    >
      <ol className="flex min-w-max items-start gap-0">
        {stages.map((s, i) => {
          const isLast = i === stages.length - 1;
          return (
            <li key={s.key} className="flex items-start gap-0">
              <div className="flex w-28 flex-col items-center text-center">
                <StageDot state={s.state} index={i} horizontal />
                <p
                  className={cn(
                    "mt-1.5 text-[11px] leading-tight",
                    s.state === "current" && "font-semibold text-foreground",
                    s.state === "completed" && "font-medium text-foreground",
                    s.state === "upcoming" && "text-muted-foreground",
                    s.state === "skipped" && "text-muted-foreground line-through",
                  )}
                >
                  {s.name}
                </p>
              </div>
              {!isLast && (
                <div
                  aria-hidden
                  className={cn(
                    "mt-3 h-0.5 w-8 shrink-0",
                    s.state === "completed" ? "bg-primary" : "bg-border",
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function StageDot({
  state,
  index,
  horizontal,
}: {
  state: StageMarker["state"];
  index: number;
  horizontal?: boolean;
}) {
  const sizeClass = horizontal ? "h-6 w-6" : "h-6 w-6";
  return (
    <span
      aria-hidden
      className={cn(
        "relative grid shrink-0 place-items-center rounded-full border-2 text-[11px] font-medium",
        sizeClass,
        state === "completed" && "border-primary bg-primary text-primary-foreground",
        state === "current" && "border-primary bg-primary/15 text-primary",
        state === "upcoming" && "border-border bg-card text-muted-foreground",
        state === "skipped" && "border-border bg-muted text-muted-foreground/70",
      )}
    >
      {state === "completed" ? "✓" : state === "skipped" ? "—" : index + 1}
    </span>
  );
}

/** Compact progress bar shown above the pipeline. */
export function ProgressBar({
  percent,
  label,
  isComplete,
}: {
  percent: number;
  label?: string;
  isComplete?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">
          {label ?? "Application Progress"}
        </span>
        <span
          className={cn(
            "text-sm font-semibold",
            isComplete ? "text-success" : "text-primary",
          )}
        >
          {pct}%
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? "Application progress"}
        className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] motion-reduce:transition-none",
            isComplete ? "bg-success" : "bg-primary",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
