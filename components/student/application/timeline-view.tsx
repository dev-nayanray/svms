"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarClock, ChevronDown, Clock, Compass,
  History, MapPin, RefreshCw, Sparkles, CheckCircle2,
  Circle, CircleDot, ArrowRight,
} from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui";
import { MobilePage, MobileCard, StudentEmptyState, StudentErrorState, StatusBadge, FilterChip } from "@/components/student/ui";
import { Skeleton } from "@/components/ui/overlays";
import { ApplicationSelector, type ApplicationOption } from "./application-selector";
import { ProgressBar } from "./pipeline-progress";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { useOnlineStatus } from "@/lib/hooks/use-online-status";

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
const LATEST_COUNT = 5;

export function TimelineView() {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<"latest" | "all">("latest");

  const listQ = useQuery<ListResponse>({
    queryKey: ["student-applications"],
    queryFn: () => apiFetch<ListResponse>("/api/student/applications"),
    retry: false,
    staleTime: 30_000,
  });

  const apps = useMemo(() => listQ.data?.applications ?? [], [listQ.data]);
  const effectiveSelectedId = useMemo(() => selectedId ?? apps[0]?.id ?? null, [selectedId, apps]);
  const online = useOnlineStatus();

  if (listQ.isLoading && !listQ.data) {
    return <MobilePage><TimelineSkeleton /></MobilePage>;
  }

  if (listQ.isError && !listQ.data) {
    return (
      <MobilePage>
        <StudentErrorState
          online={online}
          title={!online ? "You're offline" : "Couldn't load your applications"}
          description={!online ? "Check your connection and try again." : listQ.error instanceof Error ? listQ.error.message : "Please try again in a moment."}
          onRetry={() => listQ.refetch()}
        />
      </MobilePage>
    );
  }

  if (apps.length === 0) {
    return (
      <MobilePage>
        <StudentEmptyState
          icon={<Compass className="h-5 w-5" aria-hidden />}
          title="No applications yet"
          description="Browse universities to start an application. Once you have one, the timeline will appear here."
          action={<Button onClick={() => router.push("/student/universities")}><Compass className="h-4 w-4" aria-hidden /> Browse Universities</Button>}
        />
      </MobilePage>
    );
  }

  return (
    <MobilePage>
      {apps.length > 1 && <ApplicationSelector options={apps} selectedId={effectiveSelectedId} onSelect={setSelectedId} />}
      {effectiveSelectedId ? <TimelineDetail id={effectiveSelectedId} view={view} onViewChange={setView} /> : <TimelineSkeleton />}
      <div className="flex items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
        <span>{listQ.isFetching ? "Refreshing…" : "Updated just now"}</span>
        <Button size="sm" variant="ghost" onClick={() => listQ.refetch()} disabled={listQ.isFetching} aria-label="Refresh list">
          <RefreshCw className={cn("h-3.5 w-3.5", listQ.isFetching && "animate-spin")} />
        </Button>
      </div>
    </MobilePage>
  );
}

function TimelineDetail({ id, view, onViewChange }: { id: string; view: "latest" | "all"; onViewChange: (v: "latest" | "all") => void; }) {
  const detailQ = useQuery<{ data: TimelineData }>({
    queryKey: ["student-application-timeline", id],
    queryFn: () => apiFetch<{ data: TimelineData }>(`/api/student/application/${id}/timeline`),
    retry: false,
    staleTime: 15_000,
  });

  if (detailQ.isLoading && !detailQ.data) return <TimelineSkeleton showHeader={false} />;

  if (detailQ.isError || !detailQ.data?.data) {
    return (
      <StudentErrorState
        description={detailQ.error instanceof Error ? detailQ.error.message : "Couldn't load this timeline."}
        onRetry={() => detailQ.refetch()}
      />
    );
  }

  const data = detailQ.data.data;
  const app = data.application;
  const current = data.currentStage;
  const items = view === "latest" ? data.timeline.slice(0, LATEST_COUNT) : data.timeline;
  const hasMore = data.timeline.length > LATEST_COUNT;

  return (
    <div className="space-y-5">
      {/* ── Header card ── */}
      <MobileCard className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-xs text-muted-foreground">Application #{app.applicationNumber}</p>
            <h1 className="mt-1 truncate text-lg font-bold tracking-tight">
              {app.country?.flag ? `${app.country.flag} ` : ""}{app.country?.name ?? "—"}
            </h1>
            {app.university?.name && <p className="truncate text-sm text-muted-foreground">{app.university.name}{app.course?.name ? ` · ${app.course.name}` : ""}</p>}
          </div>
          <span className="shrink-0 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-600 tabular-nums">{app.stageLabel}</span>
        </div>
        <ProgressBar percent={data.progress.percent} isComplete={data.progress.isComplete} label="Pipeline Progress" />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Stage {data.progress.currentIndex + 1} of {data.progress.total}</span>
          <span>{data.progress.passed} completed · {data.progress.total - data.progress.passed - 1} remaining</span>
        </div>
      </MobileCard>

      {/* ── Current stage callout ── */}
      <div className={cn(
        "overflow-hidden rounded-2xl border p-4 shadow-sm",
        current.isComplete ? "border-emerald-200/60 bg-emerald-50/40 dark:bg-emerald-950/10" : "border-amber-300/60 bg-amber-50/40 dark:bg-amber-950/10",
      )}>
        <div className="flex items-start gap-3">
          <span className={cn(
            "grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white shadow-md",
            current.isComplete ? "bg-emerald-500" : "bg-amber-500",
          )}>
            {current.isComplete ? <CheckCircle2 className="h-6 w-6" aria-hidden /> : <Sparkles className="h-6 w-6" aria-hidden />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">{current.isComplete ? "Completed" : "Current Stage"}</p>
            <h2 className="mt-0.5 text-base font-bold tracking-tight">{current.label}</h2>
            <p className="mt-1 text-sm text-foreground/80">{current.description}</p>
            {!current.isComplete && current.nextDescription && (
              <div className="mt-3 flex items-start gap-2 rounded-xl bg-card/80 p-3 text-xs">
                <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <div>
                  <p className="font-semibold text-foreground">What happens next?</p>
                  <p className="mt-0.5 text-muted-foreground">{current.nextDescription}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Pipeline stepper ── */}
      <MobileCard className="space-y-4">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-amber-600" aria-hidden />
          <h2 className="text-sm font-bold">Pipeline</h2>
          <span className="ml-auto text-xs font-semibold text-muted-foreground tabular-nums">{data.progress.percent}%</span>
        </div>
        <PipelineStepper stages={data.stages} />
      </MobileCard>

      {/* ── Activity History header ── */}
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <Clock className="h-4 w-4 text-amber-600" aria-hidden />
          Activity History
          <StatusBadge>{data.timelineCount}</StatusBadge>
        </h2>
        {hasMore && (
          <div className="flex items-center gap-1.5">
            <FilterChip active={view === "latest"} onClick={() => onViewChange("latest")}>Latest</FilterChip>
            <FilterChip active={view === "all"} onClick={() => onViewChange("all")}>All</FilterChip>
          </div>
        )}
      </div>

      {/* ── Timeline list ── */}
      {items.length === 0 ? (
        <StudentEmptyState
          icon={<Clock className="h-5 w-5" aria-hidden />}
          title="No activity yet"
          description="Check back after your counselor updates your application."
        />
      ) : (
        <TimelineList items={items} currentStageKey={app.stageKey} />
      )}

      {view === "latest" && hasMore && (
        <Button variant="outline" className="w-full" onClick={() => onViewChange("all")}>
          Show all {data.timelineCount} activities <ChevronDown className="h-4 w-4" />
        </Button>
      )}

      {/* ── CTA row ── */}
      <div className="grid grid-cols-3 gap-2">
        <Link href="/student/application" className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold hover:bg-muted">
          <MapPin className="h-3.5 w-3.5" /> Application
        </Link>
        <Link href="/student/messages" className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold hover:bg-muted">
          Message Counselor
        </Link>
        <Link href="/student/documents" className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold hover:bg-muted">
          <CalendarClock className="h-3.5 w-3.5" /> Documents
        </Link>
      </div>
    </div>
  );
}

// ── Premium Pipeline Stepper ──

function PipelineStepper({ stages }: { stages: StageMarker[] }) {
  return (
    <div className="space-y-0">
      {stages.map((s, i) => {
        const isLast = i === stages.length - 1;
        const isCompleted = s.state === "completed";
        const isCurrent = s.state === "current";
        const isSkipped = s.state === "skipped";

        return (
          <div key={s.key} className="relative flex items-start gap-3 pb-4 last:pb-0">
            {/* Vertical connector line */}
            {!isLast && (
              <div
                aria-hidden
                className={cn(
                  "absolute left-[15px] top-8 h-[calc(100%-16px)] w-0.5 rounded-full",
                  isCompleted ? "bg-amber-500" : "bg-border",
                )}
              />
            )}

            {/* Status circle */}
            <div
              aria-hidden
              className={cn(
                "relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 transition-all duration-300",
                isCompleted && "border-amber-500 bg-amber-500 text-white shadow-sm",
                isCurrent && "border-amber-500 bg-amber-500/10 text-amber-600 ring-4 ring-amber-500/15 scale-110",
                !isCompleted && !isCurrent && !isSkipped && "border-border bg-card text-muted-foreground",
                isSkipped && "border-border bg-muted text-muted-foreground/50",
              )}
            >
              {isCompleted ? (
                <CheckCircle2 className="h-4 w-4" aria-hidden />
              ) : isCurrent ? (
                <CircleDot className="h-4 w-4" aria-hidden />
              ) : isSkipped ? (
                <span className="text-[10px]">—</span>
              ) : (
                <span className="text-[10px] font-bold tabular-nums">{i + 1}</span>
              )}
            </div>

            {/* Label */}
            <div className="min-w-0 flex-1 pt-1">
              <p className={cn(
                "text-sm leading-tight",
                isCurrent && "font-bold text-foreground",
                isCompleted && "font-semibold text-foreground",
                !isCompleted && !isCurrent && "text-muted-foreground",
                isSkipped && "text-muted-foreground/50 line-through",
              )}>
                {s.name}
                {isCurrent && (
                  <span className="ml-2 inline-flex items-center rounded-full bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                    Now
                  </span>
                )}
              </p>
              {isCurrent && (
                <p className="mt-0.5 text-[11px] text-amber-600/70">In progress</p>
              )}
              {isCompleted && (
                <p className="mt-0.5 text-[11px] text-emerald-600">✓ Completed</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Timeline List (vertical, expandable) ──

function TimelineList({ items, currentStageKey }: { items: TimelineItem[]; currentStageKey: string }) {
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
    <ol aria-label="Application timeline" className="relative space-y-3">
      {/* Vertical line */}
      <div aria-hidden className="absolute bottom-0 left-[15px] top-2 w-0.5 rounded-full bg-border" />

      {items.map((item) => {
        const isCurrent = item.toStage === currentStageKey;
        const isExpanded = expanded.has(item.id);

        return (
          <li key={item.id} className="relative pl-10">
            {/* Dot on the line */}
            <div
              aria-hidden
              className={cn(
                "absolute left-0 top-2 z-10 grid h-8 w-8 place-items-center rounded-full border-2 ring-4 ring-background transition-all duration-300",
                isCurrent
                  ? "border-amber-500 bg-amber-500 text-white scale-110 shadow-md"
                  : "border-border bg-card text-muted-foreground",
              )}
            >
              {isCurrent ? (
                <CircleDot className="h-4 w-4" aria-hidden />
              ) : (
                <Circle className="h-3 w-3" aria-hidden />
              )}
            </div>

            {/* Card */}
            <button
              type="button"
              onClick={() => toggle(item.id)}
              aria-expanded={isExpanded}
              className={cn(
                "w-full rounded-2xl border p-4 text-left transition-all duration-200 focus-visible:outline-2 focus-visible:outline-amber-500",
                isCurrent
                  ? "border-amber-300/60 bg-amber-50/40 shadow-sm hover:shadow-md dark:bg-amber-950/10"
                  : "border-border bg-card shadow-sm hover:-translate-y-0.5 hover:shadow-md",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {isCurrent && <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">Current</span>}
                    <p className="text-sm font-bold tracking-tight">{item.toLabel}</p>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock className="h-3 w-3" aria-hidden /> {fmtDate(item.createdAt)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" aria-hidden /> {fmtTime(item.createdAt)}
                    </span>
                    {item.changedByName && <span>· by {item.changedByName}</span>}
                  </div>
                </div>
                {item.note && (
                  <ChevronDown className={cn("mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200", isExpanded && "rotate-180")} />
                )}
              </div>

              {item.note && isExpanded && (
                <div className="mt-3 rounded-xl bg-muted/40 p-3 text-xs">
                  <p className="font-semibold text-muted-foreground">Note</p>
                  <p className="mt-1 whitespace-pre-wrap text-foreground">{item.note}</p>
                </div>
              )}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

// ── Skeleton ──

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
          <Skeleton key={i} className="h-20 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

// ── Helpers ──

function fmtDate(d: Date | string): string {
  try { return format(typeof d === "string" ? parseISO(d) : d, "MMM d, yyyy"); } catch { return "—"; }
}

function fmtTime(d: Date | string): string {
  try { return format(typeof d === "string" ? parseISO(d) : d, "h:mm a"); } catch { return "—"; }
}

