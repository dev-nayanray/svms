"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  Clock,
  Compass,
  FileCheck,
  FileText,
  Globe,
  RefreshCw,
  Stamp,
  WifiOff,
  XCircle,
} from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { Button, Badge } from "@/components/ui";
import { MobilePage, MobileCard } from "@/components/student/ui";
import { Skeleton } from "@/components/ui/overlays";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";

// ── Types (mirror the API response shape) ──────────────────────────

type VisaSummary = {
  id: string;
  stage: string;
  stageLabel: string;
  visaType: string | null;
  submittedAt: string | null;
  biometricsAt: string | null;
  interviewAt: string | null;
  decisionAt: string | null;
  application: {
    id: string;
    applicationNumber: string;
    country: { id: string; name: string; flag: string | null };
    university: { id: string; name: string } | null;
    course: { id: string; name: string } | null;
  };
  updatedAt: string;
};

type PipelineStage = {
  key: string;
  label: string;
  state: "completed" | "current" | "upcoming";
};

type TimelineEntry = {
  id: string;
  fromStage: string | null;
  toStage: string;
  fromLabel: string | null;
  toLabel: string;
  note: string | null;
  createdAt: string;
};

type VisaDetail = {
  id: string;
  stage: string;
  stageLabel: string;
  visaType: string | null;
  submittedAt: string | null;
  biometricsAt: string | null;
  interviewAt: string | null;
  decisionAt: string | null;
  application: {
    id: string;
    applicationNumber: string;
    stageKey: string;
    status: string;
    country: { id: string; name: string; flag: string | null };
    university: { id: string; name: string } | null;
    course: { id: string; name: string } | null;
  };
  pipeline: PipelineStage[];
  timeline: TimelineEntry[];
  createdAt: string;
  updatedAt: string;
};

type Requirement = {
  id: string;
  name: string;
  description: string | null;
  required: boolean;
  sortOrder: number;
};

type ListResponse = { visas: VisaSummary[] };
type DetailResponse = { visa: VisaDetail };
type RequirementsResponse = { requirements: Requirement[] };

// ── Status → tone + icon mapping ───────────────────────────────────

const STATUS_TONE: Record<string, "default" | "info" | "warning" | "destructive" | "success"> = {
  PREPARATION: "warning",
  SUBMITTED: "info",
  BIOMETRICS: "info",
  INTERVIEW: "info",
  PROCESSING: "info",
  APPROVED: "success",
  REFUSED: "destructive",
  WITHDRAWN: "destructive",
  COMPLETED: "success",
};

function statusIcon(stage: string) {
  switch (stage) {
    case "APPROVED":
    case "COMPLETED":
      return <CheckCircle2 className="h-5 w-5" aria-hidden />;
    case "REFUSED":
    case "WITHDRAWN":
      return <XCircle className="h-5 w-5" aria-hidden />;
    default:
      return <Clock className="h-5 w-5" aria-hidden />;
  }
}

// ── Component ──────────────────────────────────────────────────────

export function VisaView() {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Step 1: fetch the list of the caller's visa applications.
  const listQ = useQuery<ListResponse>({
    queryKey: ["student-visas"],
    queryFn: () => apiFetch<ListResponse>("/api/student/visa"),
    retry: false,
    staleTime: 30_000,
  });

  const visas = listQ.data?.visas ?? [];
  const effectiveSelectedId = selectedId ?? visas[0]?.id ?? null;

  const online = useOnlineStatus();

  // Loading state
  if (listQ.isLoading && !listQ.data) {
    return (
      <MobilePage>
        <VisaSkeleton />
      </MobilePage>
    );
  }

  // Error state
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
            {!online ? "You're offline" : "Couldn't load your visa applications"}
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

  // Empty state — no visa applications yet
  if (visas.length === 0) {
    return (
      <MobilePage>
        <MobileCard className="py-8 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
            <Stamp className="h-6 w-6" aria-hidden />
          </span>
          <h2 className="mt-3 text-base font-semibold">No visa applications yet</h2>
          <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
            Visa tracking begins once your application reaches the visa preparation stage.
            Check your application status or contact your counselor.
          </p>
          <Button onClick={() => router.push("/student/application")} className="mt-4">
            <Compass className="h-4 w-4" aria-hidden /> View Application
          </Button>
        </MobileCard>
      </MobilePage>
    );
  }

  // Multi-application selector (if > 1 visa)
  const showSelector = visas.length > 1;

  return (
    <MobilePage>
      {showSelector && (
        <VisaSelector
          visas={visas}
          selectedId={effectiveSelectedId}
          onSelect={setSelectedId}
        />
      )}

      {effectiveSelectedId ? (
        <VisaDetail id={effectiveSelectedId} countryId={visas.find(v => v.id === effectiveSelectedId)?.application.country.id} />
      ) : (
        <VisaSkeleton showHeader={false} />
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

// ── Visa selector (compact dropdown for multiple applications) ─────

function VisaSelector({
  visas,
  selectedId,
  onSelect,
}: {
  visas: VisaSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = visas.find((v) => v.id === selectedId);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-left transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-primary"
      >
        <span className="flex min-w-0 items-center gap-2">
          {selected?.application.country.flag && (
            <span aria-hidden className="text-base">{selected.application.country.flag}</span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">
              {selected ? `${selected.application.country.name}` : "Select visa"}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {selected ? `${selected.application.applicationNumber} · ${selected.stageLabel}` : ""}
            </span>
          </span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 md:items-center" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-t-2xl border-t border-border bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:rounded-xl md:border md:border-t" onClick={(e) => e.stopPropagation()}>
            <div aria-hidden className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted md:hidden" />
            <h3 className="mb-3 text-sm font-semibold">Your Visa Applications</h3>
            <ul className="max-h-[60dvh] space-y-1 overflow-y-auto">
              {visas.map((v) => (
                <li key={v.id}>
                  <button
                    type="button"
                    onClick={() => { onSelect(v.id); setOpen(false); }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors",
                      v.id === selectedId ? "bg-primary/10 ring-1 ring-primary" : "hover:bg-muted",
                    )}
                  >
                    <span className="text-base" aria-hidden>{v.application.country.flag}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{v.application.country.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {v.application.applicationNumber} · {v.stageLabel}
                      </span>
                    </span>
                    <Badge tone={STATUS_TONE[v.stage] ?? "default"}>{v.stageLabel}</Badge>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}

// ── Detail view (one visa application) ──────────────────────────────

function VisaDetail({ id, countryId }: { id: string; countryId?: string }) {
  const detailQ = useQuery<DetailResponse>({
    queryKey: ["student-visa-detail", id],
    queryFn: () => apiFetch<DetailResponse>(`/api/student/visa/${id}`),
    retry: false,
    staleTime: 15_000,
  });

  // Fetch requirements for this visa's country
  const reqsQ = useQuery<RequirementsResponse>({
    queryKey: ["student-visa-requirements", countryId],
    queryFn: () => apiFetch<RequirementsResponse>(`/api/student/visa/requirements?countryId=${countryId}`),
    enabled: !!countryId,
    retry: false,
    staleTime: 60_000,
  });

  if (detailQ.isLoading && !detailQ.data) {
    return <VisaSkeleton showHeader={false} />;
  }

  if (detailQ.isError || !detailQ.data?.visa) {
    return (
      <MobileCard className="py-6 text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-destructive" aria-hidden />
        <p className="mt-2 text-sm text-muted-foreground">
          {detailQ.error instanceof Error ? detailQ.error.message : "Couldn't load this visa."}
        </p>
        <Button size="sm" variant="outline" className="mt-3" onClick={() => detailQ.refetch()}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Retry
        </Button>
      </MobileCard>
    );
  }

  const visa = detailQ.data.visa;
  const requirements = reqsQ.data?.requirements ?? [];
  const tone = STATUS_TONE[visa.stage] ?? "default";

  return (
    <div className="space-y-4">
      {/* Visa status card — prominent visualization */}
      <MobileCard className={cn(
        "space-y-3 border-2",
        tone === "success" && "border-success/40",
        tone === "destructive" && "border-destructive/40",
        tone === "warning" && "border-warning/40",
        tone === "info" && "border-info/40",
        tone === "default" && "border-border",
      )}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Visa Application
            </p>
            <h1 className="mt-1 text-lg font-semibold">
              {visa.application.country.flag ? `${visa.application.country.flag} ` : ""}
              {visa.application.country.name}
            </h1>
            {visa.visaType && (
              <p className="mt-0.5 text-sm text-muted-foreground">{visa.visaType}</p>
            )}
            <p className="mt-0.5 font-mono text-xs text-muted-foreground">
              {visa.application.applicationNumber}
            </p>
          </div>
          <div className={cn(
            "flex shrink-0 flex-col items-center gap-1 rounded-xl px-3 py-2",
            tone === "success" && "bg-success/10 text-success",
            tone === "destructive" && "bg-destructive/10 text-destructive",
            tone === "warning" && "bg-warning/10 text-warning",
            tone === "info" && "bg-info/10 text-info",
            tone === "default" && "bg-muted text-muted-foreground",
          )}>
            {statusIcon(visa.stage)}
            <span className="text-xs font-semibold">{visa.stageLabel}</span>
          </div>
        </div>
      </MobileCard>

      {/* Visa pipeline timeline */}
      <MobileCard className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Stamp className="h-4 w-4 text-primary" aria-hidden />
          Visa Timeline
        </h2>
        <PipelineTimeline stages={visa.pipeline} />
      </MobileCard>

      {/* Date cards */}
      <div className="grid grid-cols-2 gap-2">
        <DateCard
          icon={<CalendarClock className="h-3.5 w-3.5" aria-hidden />}
          label="Submitted"
          date={visa.submittedAt}
          tone="info"
        />
        <DateCard
          icon={<FileCheck className="h-3.5 w-3.5" aria-hidden />}
          label="Biometrics"
          date={visa.biometricsAt}
          tone="info"
        />
        <DateCard
          icon={<FileText className="h-3.5 w-3.5" aria-hidden />}
          label="Interview"
          date={visa.interviewAt}
          tone="info"
        />
        <DateCard
          icon={<CheckCircle2 className="h-3.5 w-3.5" aria-hidden />}
          label="Decision"
          date={visa.decisionAt}
          tone={visa.stage === "APPROVED" || visa.stage === "COMPLETED" ? "success" : visa.stage === "REFUSED" ? "destructive" : "default"}
        />
      </div>

      {/* Requirements checklist */}
      {requirements.length > 0 && (
        <MobileCard className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <FileCheck className="h-4 w-4 text-primary" aria-hidden />
            Visa Requirements ({requirements.length})
          </h2>
          <ul className="space-y-2">
            {requirements.map((req) => (
              <li key={req.id} className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{req.name}</p>
                  {req.description && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{req.description}</p>
                  )}
                </div>
                <span className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                  req.required ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground",
                )}>
                  {req.required ? "Required" : "Optional"}
                </span>
              </li>
            ))}
          </ul>
        </MobileCard>
      )}

      {/* Activity timeline */}
      {visa.timeline.length > 0 && (
        <MobileCard className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Clock className="h-4 w-4 text-primary" aria-hidden />
            Activity History
          </h2>
          <ol className="relative space-y-3 border-l-2 border-border pl-4">
            {visa.timeline.slice(0, 8).map((h) => (
              <li key={h.id} className="relative">
                <span aria-hidden className="absolute -left-[18px] top-1 grid h-3 w-3 place-items-center rounded-full border-2 border-primary bg-card ring-2 ring-card" />
                <p className="text-sm font-medium">
                  {h.fromStage ? `${h.fromLabel} → ${h.toLabel}` : h.toLabel}
                </p>
                {h.note && <p className="text-xs text-muted-foreground">{h.note}</p>}
                <p className="mt-0.5 text-[11px] text-muted-foreground">{fmtDateTime(h.createdAt)}</p>
              </li>
            ))}
          </ol>
        </MobileCard>
      )}

      {/* Sticky action area */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Link
          href="/student/application"
          className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> Application
        </Link>
        <Link
          href="/student/documents"
          className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"
        >
          <FileText className="h-3.5 w-3.5" aria-hidden /> Documents
        </Link>
        <Link
          href="/student/messages"
          className="col-span-2 flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary sm:col-span-1"
        >
          <Globe className="h-3.5 w-3.5" aria-hidden /> Message Counselor
        </Link>
      </div>
    </div>
  );
}

// ── Pipeline timeline component ────────────────────────────────────

function PipelineTimeline({ stages }: { stages: PipelineStage[] }) {
  return (
    <ol className="space-y-0">
      {stages.map((s, i) => {
        const isLast = i === stages.length - 1;
        return (
          <li key={s.key} className="relative flex items-start gap-3 pb-4 last:pb-0">
            {!isLast && (
              <span
                aria-hidden
                className={cn(
                  "absolute left-[11px] top-6 h-[calc(100%-16px)] w-0.5",
                  s.state === "completed" ? "bg-primary" : "bg-border",
                )}
              />
            )}
            <span
              aria-hidden
              className={cn(
                "relative grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 text-[10px] font-medium",
                s.state === "completed" && "border-primary bg-primary text-primary-foreground",
                s.state === "current" && "border-primary bg-primary/15 text-primary",
                s.state === "upcoming" && "border-border bg-card text-muted-foreground",
              )}
            >
              {s.state === "completed" ? "✓" : ""}
            </span>
            <div className="min-w-0 pt-0.5">
              <p className={cn(
                "text-sm leading-5",
                s.state === "current" && "font-semibold text-foreground",
                s.state === "completed" && "font-medium text-foreground",
                s.state === "upcoming" && "text-muted-foreground",
              )}>
                {s.label}
                {s.state === "current" && (
                  <span className="ml-1.5 rounded bg-primary px-1.5 py-0 text-[9px] font-bold uppercase text-primary-foreground">
                    Now
                  </span>
                )}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ── Date card component ────────────────────────────────────────────

function DateCard({
  icon,
  label,
  date,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  date: string | null;
  tone?: "default" | "info" | "warning" | "success" | "destructive";
}) {
  const toneCls = {
    default: "border-border bg-card",
    info: "border-info/30 bg-info/5",
    warning: "border-warning/30 bg-warning/5",
    success: "border-success/30 bg-success/5",
    destructive: "border-destructive/30 bg-destructive/5",
  }[tone];

  return (
    <div className={cn("rounded-lg border p-3", toneCls)}>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-sm font-semibold">
        {date ? fmtDate(date) : <span className="text-muted-foreground/70">—</span>}
      </p>
    </div>
  );
}

// ── Loading skeleton ───────────────────────────────────────────────

function VisaSkeleton({ showHeader = true }: { showHeader?: boolean }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading visa">
      {showHeader && (
        <MobileCard className="space-y-3">
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
        </MobileCard>
      )}
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-32 w-full rounded-xl" />
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────

function fmtDate(d: string): string {
  try {
    return format(parseISO(d), "MMM d, yyyy");
  } catch {
    return "—";
  }
}

function fmtDateTime(d: string): string {
  try {
    return format(parseISO(d), "MMM d, yyyy 'at' h:mm a");
  } catch {
    return "—";
  }
}

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
