"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarClock,
  ChevronDown,
  Clock,
  Compass,
  History,
  MapPin,
  RefreshCw,
  Sparkles,
  WifiOff,
} from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { Badge, Button } from "@/components/ui";
import { MobilePage, MobileCard } from "@/components/student/ui";
import { Skeleton } from "@/components/ui/overlays";
import { ApplicationSelector, type ApplicationOption } from "./application-selector";
import { ProgressBar } from "./pipeline-progress";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";

// ── Types (mirror the service's student-safe timeline shape) ──────

type StageMarker = {
  key: string;
  name: string;
  sortOrder: number;
  state: "completed" | "current" | "upcoming" | "skipped";
};

type TimelineItem = {
  id: string;
  fromStage: string | null;
  toStage: string;
  fromLabel: string;
  toLabel: string;
  description: string;
  note: string | null;
  createdAt: Date | string;
  changedByName: string | null;
};

type TimelineData = {
  application: {
    id: string;
    applicationNumber: string;
    stageKey: string;
    stageLabel: string;
    status: string;
    priority: string;
    lastUpdated: Date | string;
    country: { id: string; name: string; flag: string | null } | null;
    university: { id: string; name: string } | null;
    course: { id: string; name: string } | null;
  };
  progress: {
    percent: number;
    currentIndex: number;
    total: number;
    passed: number;
    isComplete: boolean;
  };
  stages: StageMarker[];
  currentStage: {
    key: string;
    label: string;
    description: string;
    nextDescription: string;
    isComplete: boolean;
  };
  timeline: TimelineItem[];
  timelineCount: number;
};

type ListResponse = { applications: ApplicationOption[] };

// Number of items shown in "Latest" mode. The user can switch to
// "All History" to see everything.
const LATEST_COUNT = 5;

// ── Component ──────────────────────────────────────────────────────

export function TimelineView() {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<"latest" | "all">("latest");

  // Step 1: fetch the list of the caller's applications (for the
  // selector). Same pattern as Module 04.
  const listQ = useQuery<ListResponse>({
    queryKey: ["student-applications"],
    queryFn: () => apiFetch<ListResponse>("/api/student/applications"),
    retry: false,
    staleTime: 30_000,
  });

  const apps = useMemo(() => listQ.data?.applications ?? [], [listQ.data]);
  const effectiveSelectedId = useMemo(
    () => selectedId ?? apps[0]?.id ?? null,
    [selectedId, apps],
  );

  const online = useOnlineStatus();

  if (listQ.isLoading && !listQ.data) {
    return (
      <MobilePage>
        <TimelineSkeleton />
      </MobilePage>
    );
  }

  if (listQ.isError && !listQ.data) {
    return (
      <MobilePage>
        <MobileCard className="py-8 text-center">
          {!online ? (
            <WifiOff className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden />
          ) : (
            <AlertTriangle className="mx-auto h-10 w-10 text-destructive" aria-hidden />
          )}
          <h2 className="mt-3 text-base font-semibold">
            {!online ? "You're offline" : "Couldn't load your applications"}
          </h2>
          <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
            {!online
              ? "Check your connection and try again."
              : listQ.error instanceof Error
                ? listQ.error.message
                : "Please try again in a moment."}
          </p>
          <Button onClick={() => listQ.refetch()} className="mt-4" disabled={!online}>
            <RefreshCw className="h-4 w-4" aria-hidden /> Retry
          </Button>
        </MobileCard>
      </MobilePage>
    );
  }

  if (apps.length === 0) {
    return (
      <MobilePage>
        <MobileCard className="py-8 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
            <Compass className="h-6 w-6" aria-hidden />
          </span>
          <h2 className="mt-3 text-base font-semibold">No applications yet</h2>
          <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
            Browse universities to start an application. Once you have one, the timeline will appear here.
          </p>
          <Button onClick={() => router.push("/student/universities")} className="mt-4">
            <Compass className="h-4 w-4" aria-hidden /> Browse Universities
          </Button>
        </MobileCard>
      </MobilePage>
    );
  }

  const showSelector = apps.length > 1;

  return (
    <MobilePage>
      {showSelector && (
        <ApplicationSelector
          options={apps}
          selectedId={effectiveSelectedId}
          onSelect={setSelectedId}
        />
      )}

      {effectiveSelectedId ? (
        <TimelineDetail id={effectiveSelectedId} view={view} onViewChange={setView} />
      ) : (
        <TimelineSkeleton />
      )}

      <div className="flex items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
        <span>{listQ.isFetching ? "Refreshing…" : "Updated just now"}</span>
        <Button size="sm" variant="ghost" onClick={() => listQ.refetch()} disabled={listQ.isFetching}>
          <RefreshCw className={cn("h-3.5 w-3.5", listQ.isFetching && "animate-spin")} aria-hidden />
        </Button>
      </div>
    </MobilePage>
  );
}

// ── Detail view (timeline for one application) ─────────────────────

function TimelineDetail({
  id,
  view,
  onViewChange,
}: {
  id: string;
  view: "latest" | "all";
  onViewChange: (v: "latest" | "all") => void;
}) {
  const detailQ = useQuery<{ data: TimelineData }>({
    queryKey: ["student-application-timeline", id],
    queryFn: () => apiFetch<{ data: TimelineData }>(`/api/student/application/${id}/timeline`),
    retry: false,
    staleTime: 15_000,
  });

  if (detailQ.isLoading && !detailQ.data) {
    return <TimelineSkeleton showHeader={false} />;
  }

  if (detailQ.isError || !detailQ.data?.data) {
    return (
      <MobileCard className="py-6 text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-destructive" aria-hidden />
        <p className="mt-2 text-sm text-muted-foreground">
          {detailQ.error instanceof Error
            ? detailQ.error.message
            : "Couldn't load this timeline."}
        </p>
        <Button size="sm" variant="outline" className="mt-3" onClick={() => detailQ.refetch()}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Retry
        </Button>
      </MobileCard>
    );
  }

  const data = detailQ.data.data;
  const app = data.application;
  const current = data.currentStage;
  const items = view === "latest" ? data.timeline.slice(0, LATEST_COUNT) : data.timeline;
  const hasMore = data.timeline.length > LATEST_COUNT;

  return (
    <div className="space-y-4">
      {/* Header card with application context + progress */}
      <MobileCard className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-xs text-muted-foreground">
              Application #{app.applicationNumber}
            </p>
            <h1 className="mt-1 truncate text-lg font-semibold">
              {app.country?.flag ? `${app.country.flag} ` : ""}
              {app.country?.name ?? "—"}
            </h1>
            {app.university?.name && (
              <p className="truncate text-sm text-muted-foreground">
                {app.university.name}
                {app.course?.name ? ` · ${app.course.name}` : ""}
              </p>
            )}
          </div>
          <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
            {app.stageLabel}
          </span>
        </div>
        <ProgressBar
          percent={data.progress.percent}
          isComplete={data.progress.isComplete}
          label="Pipeline Progress"
        />
      </MobileCard>

      {/* Current-stage callout — prominent visual treatment */}
      <div
        className={cn(
          "rounded-xl border p-4 shadow-sm",
          current.isComplete
            ? "border-success/40 bg-success/10"
            : "border-primary/40 bg-primary/5",
        )}
      >
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "grid h-10 w-10 shrink-0 place-items-center rounded-full text-lg",
              current.isComplete ? "bg-success text-success-foreground" : "bg-primary text-primary-foreground",
            )}
            aria-hidden
          >
            <Sparkles className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Current Stage
            </p>
            <h2 className="mt-0.5 text-base font-semibold">{current.label}</h2>
            <p className="mt-1 text-sm text-foreground">{current.description}</p>
            <div className="mt-3 rounded-md bg-card/80 p-2.5 text-xs">
              <p className="font-medium text-foreground">What happens next?</p>
              <p className="mt-0.5 text-muted-foreground">{current.nextDescription}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Pipeline strip — horizontal on desktop, vertical on mobile */}
      <MobileCard className="space-y-3">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-primary" aria-hidden />
          <h2 className="text-sm font-semibold">Pipeline</h2>
        </div>
        <PipelineStrip stages={data.stages} />
      </MobileCard>

      {/* Timeline header with Latest / All toggle */}
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Clock className="h-4 w-4 text-primary" aria-hidden />
          Activity History
          <Badge tone="default">{data.timelineCount}</Badge>
        </h2>
        {hasMore && (
          <div className="flex items-center gap-1 rounded-md border border-border bg-card p-0.5 text-xs">
            <ToggleButton active={view === "latest"} onClick={() => onViewChange("latest")}>
              Latest
            </ToggleButton>
            <ToggleButton active={view === "all"} onClick={() => onViewChange("all")}>
              All History
            </ToggleButton>
          </div>
        )}
      </div>

      {/* Timeline list */}
      {items.length === 0 ? (
        <MobileCard className="py-6 text-center">
          <Clock className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
          <p className="mt-2 text-sm text-muted-foreground">
            No activity recorded yet. Check back after your counselor updates your application.
          </p>
        </MobileCard>
      ) : (
        <TimelineList items={items} currentStageKey={app.stageKey} />
      )}

      {/* "Show all" affordance when in Latest mode and there's more */}
      {view === "latest" && hasMore && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => onViewChange("all")}
        >
          Show all {data.timelineCount} activities
          <ChevronDown className="h-4 w-4" aria-hidden />
        </Button>
      )}

      {/* CTA row */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Link
          href="/student/application"
          className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"
        >
          <MapPin className="h-3.5 w-3.5" aria-hidden /> Application
        </Link>
        <Link
          href="/student/messages"
          className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"
        >
          Message Counselor
        </Link>
        <Link
          href="/student/documents"
          className="col-span-2 flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary sm:col-span-1"
        >
          <CalendarClock className="h-3.5 w-3.5" aria-hidden /> Documents
        </Link>
      </div>
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded px-2 py-1 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary",
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

// ── Compact pipeline strip (vertical on mobile, horizontal on desktop) ──

function PipelineStrip({ stages }: { stages: StageMarker[] }) {
  return (
    <div>
      {/* Horizontal strip on desktop — small dots + labels */}
      <div className="hidden md:block">
        <div className="flex items-start gap-0 overflow-x-auto pb-1">
          {stages.map((s, i) => {
            const isLast = i === stages.length - 1;
            return (
              <div key={s.key} className="flex items-start gap-0">
                <div className="flex w-24 flex-col items-center text-center">
                  <span
                    aria-hidden
                    className={cn(
                      "grid h-5 w-5 place-items-center rounded-full border-2 text-[9px] font-medium",
                      s.state === "completed" && "border-primary bg-primary text-primary-foreground",
                      s.state === "current" && "border-primary bg-primary/15 text-primary ring-2 ring-primary/30",
                      s.state === "upcoming" && "border-border bg-card text-muted-foreground",
                      s.state === "skipped" && "border-border bg-muted text-muted-foreground/70",
                    )}
                  >
                    {s.state === "completed" ? "✓" : s.state === "skipped" ? "—" : ""}
                  </span>
                  <p
                    className={cn(
                      "mt-1 text-[10px] leading-tight",
                      s.state === "current" ? "font-semibold text-foreground" : "text-muted-foreground",
                      s.state === "skipped" && "line-through",
                    )}
                  >
                    {s.name}
                  </p>
                </div>
                {!isLast && (
                  <div
                    aria-hidden
                    className={cn(
                      "mt-2.5 h-0.5 w-3 shrink-0",
                      s.state === "completed" ? "bg-primary" : "bg-border",
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Vertical strip on mobile — compact */}
      <ol className="space-y-0.5 md:hidden" aria-label="Pipeline">
        {stages.map((s, i) => {
          const isLast = i === stages.length - 1;
          return (
            <li key={s.key} className="relative flex items-center gap-3 py-0.5">
              {!isLast && (
                <span
                  aria-hidden
                  className={cn(
                    "absolute left-[7px] top-5 h-4 w-0.5",
                    s.state === "completed" ? "bg-primary" : "bg-border",
                  )}
                />
              )}
              <span
                aria-hidden
                className={cn(
                  "grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full border-2 text-[8px]",
                  s.state === "completed" && "border-primary bg-primary text-primary-foreground",
                  s.state === "current" && "border-primary bg-primary/15 text-primary",
                  s.state === "upcoming" && "border-border bg-card text-muted-foreground",
                  s.state === "skipped" && "border-border bg-muted text-muted-foreground/70",
                )}
              >
                {s.state === "completed" ? "✓" : ""}
              </span>
              <p
                className={cn(
                  "text-xs",
                  s.state === "current" && "font-semibold text-foreground",
                  s.state === "completed" && "text-foreground",
                  s.state === "upcoming" && "text-muted-foreground",
                  s.state === "skipped" && "text-muted-foreground line-through",
                )}
              >
                {s.name}
                {s.state === "current" && (
                  <span className="ml-1 rounded bg-primary px-1 py-0 text-[9px] font-bold uppercase text-primary-foreground">
                    Now
                  </span>
                )}
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ── Timeline list (vertical, expandable items) ─────────────────────

function TimelineList({
  items,
  currentStageKey,
}: {
  items: TimelineItem[];
  currentStageKey: string;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <ol
      aria-label="Application timeline"
      className="relative space-y-0 border-l-2 border-border pl-5"
    >
      {items.map((item, i) => {
        const isCurrent = item.toStage === currentStageKey;
        const isExpanded = expanded.has(item.id);
        const isLast = i === items.length - 1;
        return (
          <li key={item.id} className="relative pb-4 last:pb-0">
            {/* Stage state dot — colored by whether it matches the current stage */}
            <span
              aria-hidden
              className={cn(
                "absolute -left-[26px] top-1 grid h-4 w-4 place-items-center rounded-full border-2 ring-2 ring-card",
                isCurrent
                  ? "border-primary bg-primary"
                  : "border-border bg-card",
              )}
            >
              {isCurrent && (
                <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
              )}
            </span>

            {/* Card */}
            <button
              type="button"
              onClick={() => toggle(item.id)}
              aria-expanded={isExpanded}
              className={cn(
                "w-full rounded-lg border bg-card p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-primary",
                isCurrent
                  ? "border-primary/40 ring-1 ring-primary/20"
                  : "border-border hover:bg-muted/30",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {isCurrent && (
                      <Badge tone="info" className="text-[10px]">Current</Badge>
                    )}
                    <p className="text-sm font-semibold">
                      {item.toLabel}
                    </p>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {item.description}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock className="h-3 w-3" aria-hidden />
                      {fmtDate(item.createdAt)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" aria-hidden />
                      {fmtTime(item.createdAt)}
                    </span>
                    {item.changedByName && (
                      <span>· by {item.changedByName}</span>
                    )}
                  </div>
                </div>
                {item.note && (
                  <ChevronDown
                    className={cn(
                      "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                      isExpanded && "rotate-180",
                    )}
                    aria-hidden
                  />
                )}
              </div>

              {/* Expandable note section */}
              {item.note && isExpanded && (
                <div className="mt-2 rounded-md bg-muted/40 p-2 text-xs text-foreground">
                  <p className="font-medium text-muted-foreground">Note</p>
                  <p className="mt-0.5 whitespace-pre-wrap">{item.note}</p>
                </div>
              )}
            </button>

            {/* If this isn't the last item and isn't expanded, show a tiny hint */}
            {!isLast && !isExpanded && item.note && (
              <p className="mt-1 pl-1 text-[10px] text-muted-foreground/70">
                Tap to expand note
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ── Loading skeleton ───────────────────────────────────────────────

function TimelineSkeleton({ showHeader = true }: { showHeader?: boolean }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading timeline">
      {showHeader && (
        <MobileCard className="space-y-3">
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-2.5 w-full" />
        </MobileCard>
      )}
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-16 w-full rounded-xl" />
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────

function fmtDate(d: Date | string): string {
  try {
    const date = typeof d === "string" ? parseISO(d) : d;
    return format(date, "MMM d, yyyy");
  } catch {
    return "—";
  }
}

function fmtTime(d: Date | string): string {
  try {
    const date = typeof d === "string" ? parseISO(d) : d;
    return format(date, "h:mm a");
  } catch {
    return "—";
  }
}

// ── Online status hook (reused) ────────────────────────────────────

function useOnlineStatus() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}
