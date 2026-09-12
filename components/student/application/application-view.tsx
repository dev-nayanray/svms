"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Compass,
  FolderOpen,
  RefreshCw,
  WifiOff,
} from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui";
import { MobilePage, MobileCard } from "@/components/student/ui";
import { Skeleton } from "@/components/ui/overlays";
import { Tabs, TabsContent } from "@/components/ui/overlays";
import { ApplicationSelector, type ApplicationOption } from "./application-selector";
import { PipelineProgress, ProgressBar } from "./pipeline-progress";
import {
  CounselorCard,
  CourseCard,
  DatesCard,
  DocumentsCard,
  IntakeCard,
  NextActionBanner,
  OverviewCard,
  PaymentsCard,
  StatusCard,
  TasksCard,
  TimelineCard,
  UniversityCard,
  VisaCard,
  NotesCard,
  type AppView,
} from "./section-cards";
import { cn } from "@/lib/utils";

// ── Types (mirror the API envelope shape) ──────────────────────────

type ApplicationSummary = ApplicationOption;

type ListResponse = {
  applications: ApplicationSummary[];
};

type DetailResponse = {
  application: AppView | null;
};

// ── Component ──────────────────────────────────────────────────────

export function ApplicationView() {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Step 1: fetch the list of the caller's applications.
  const listQ = useQuery<ListResponse>({
    queryKey: ["student-applications"],
    queryFn: () => apiFetch<ListResponse>("/api/student/applications"),
    retry: false,
    staleTime: 30_000,
  });

  // Derive the effective selection: explicit user choice OR the first
  // application in the list (the most recently updated ACTIVE one).
  // No useEffect/setState-in-effect needed — this is a pure derivation
  // from the query data + the user's explicit selection.
  // `apps` is memoized so the downstream useMemo's dependencies are
  // stable across renders when the underlying data hasn't changed.
  const apps = useMemo(
    () => listQ.data?.applications ?? [],
    [listQ.data],
  );
  const effectiveSelectedId = useMemo(
    () => selectedId ?? apps[0]?.id ?? null,
    [selectedId, apps],
  );

  const online = useOnlineStatus();

  // Loading state for the list (initial mount, no data yet).
  if (listQ.isLoading && !listQ.data) {
    return (
      <MobilePage>
        <ApplicationSkeleton />
      </MobilePage>
    );
  }

  // Error state — server or offline.
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
          <Button
            onClick={() => listQ.refetch()}
            className="mt-4"
            disabled={!online}
          >
            <RefreshCw className="h-4 w-4" aria-hidden /> Retry
          </Button>
        </MobileCard>
      </MobilePage>
    );
  }

  // Empty state — no applications yet.
  if (apps.length === 0) {
    return (
      <MobilePage>
        <MobileCard className="py-8 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
            <FolderOpen className="h-6 w-6" aria-hidden />
          </span>
          <h2 className="mt-3 text-base font-semibold">No applications yet</h2>
          <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
            Browse universities and shortlist your favorites to start an application.
          </p>
          <Button onClick={() => router.push("/student/universities")} className="mt-4">
            <Compass className="h-4 w-4" aria-hidden /> Browse Universities
          </Button>
        </MobileCard>
      </MobilePage>
    );
  }

  // Multi-application selector — only when there's more than one.
  const showSelector = apps.length > 1;

  // The detail view for the currently-selected application.
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
        <ApplicationDetail id={effectiveSelectedId} />
      ) : (
        <ApplicationSkeleton />
      )}

      <div className="flex items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
        <span>{listQ.isFetching ? "Refreshing…" : "Updated just now"}</span>
        <Button
          size="sm"
          variant="ghost"
          aria-label="Refresh list"
          onClick={() => listQ.refetch()}
          disabled={listQ.isFetching}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", listQ.isFetching && "animate-spin")} aria-hidden />
        </Button>
      </div>
    </MobilePage>
  );
}

// ── Detail view (one application) ──────────────────────────────────

function ApplicationDetail({ id }: { id: string }) {
  const detailQ = useQuery<DetailResponse>({
    queryKey: ["student-application", id],
    queryFn: () => apiFetch<DetailResponse>(`/api/student/application/${id}`),
    retry: false,
    staleTime: 15_000,
  });

  if (detailQ.isLoading && !detailQ.data) {
    return <ApplicationSkeleton showHeader={false} />;
  }

  if (detailQ.isError || !detailQ.data?.application) {
    return (
      <MobileCard className="py-6 text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-destructive" aria-hidden />
        <p className="mt-2 text-sm text-muted-foreground">
          {detailQ.error instanceof Error
            ? detailQ.error.message
            : "Couldn't load this application."}
        </p>
        <Button
          size="sm"
          variant="outline"
          className="mt-3"
          onClick={() => detailQ.refetch()}
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Retry
        </Button>
      </MobileCard>
    );
  }

  const app = detailQ.data.application;

  return (
    <div className="space-y-4">
      {/* Header card */}
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
          percent={app.progress.percent}
          isComplete={app.progress.isComplete}
          label="Application Progress"
        />
      </MobileCard>

      {/* Next action sticky banner */}
      <NextActionBanner app={app} />

      {/* Tabs on desktop, stacked cards on mobile */}
      <Tabs
        tabs={[
          { value: "overview", label: "Overview" },
          { value: "details", label: "Details" },
          { value: "documents", label: "Documents" },
          { value: "tasks", label: "Tasks & Payments" },
          { value: "visa", label: "Visa" },
          { value: "timeline", label: "Timeline" },
        ]}
        defaultValue="overview"
      >
        {/* Overview tab — always visible on mobile, primary tab on desktop */}
        <TabsContent value="overview" className="space-y-4 pt-4">
          <MobileCard className="space-y-3">
            <h2 className="text-sm font-semibold">Pipeline</h2>
            {/* Vertical pipeline on mobile, horizontal on desktop */}
            <div className="md:hidden">
              <PipelineProgress stages={app.stages} variant="vertical" />
            </div>
            <div className="hidden md:block">
              <PipelineProgress stages={app.stages} variant="horizontal" />
            </div>
          </MobileCard>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <OverviewCard app={app} />
            <StatusCard app={app} />
            <DatesCard app={app} />
          </div>
        </TabsContent>

        <TabsContent value="details" className="space-y-4 pt-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <UniversityCard app={app} />
            <CourseCard app={app} />
            <IntakeCard app={app} />
            <CounselorCard app={app} />
            <OverviewCard app={app} />
            <StatusCard app={app} />
          </div>
        </TabsContent>

        <TabsContent value="documents" className="space-y-4 pt-4">
          <DocumentsCard app={app} />
        </TabsContent>

        <TabsContent value="tasks" className="space-y-4 pt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <TasksCard app={app} />
            <PaymentsCard app={app} />
          </div>
        </TabsContent>

        <TabsContent value="visa" className="space-y-4 pt-4">
          <VisaCard app={app} />
          {app.notes.length > 0 && <NotesCard app={app} />}
        </TabsContent>

        <TabsContent value="timeline" className="space-y-4 pt-4">
          <TimelineCard app={app} />
        </TabsContent>
      </Tabs>

      {/* Mobile-only: always-visible stacked sections below the tabs.
          This keeps the key info reachable without tapping through
          tabs on a phone. */}
      <div className="space-y-4 md:hidden">
        <DocumentsCard app={app} />
        <TasksCard app={app} />
        <PaymentsCard app={app} />
        <VisaCard app={app} />
        <TimelineCard app={app} />
        <CounselorCard app={app} />
      </div>

      {/* CTA row */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <QuickCta href="/student/documents" label="Upload Document" icon={<FolderOpen className="h-4 w-4" aria-hidden />} />
        <QuickCta href="/student/payments" label="Pay Outstanding" icon={<ArrowRight className="h-4 w-4" aria-hidden />} />
        <QuickCta href="/student/messages" label="Message Counselor" icon={<ArrowRight className="h-4 w-4" aria-hidden />} />
        <QuickCta href="/student/visa" label="Visa Info" icon={<ArrowRight className="h-4 w-4" aria-hidden />} />
      </div>
    </div>
  );
}

function QuickCta({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"
    >
      {icon}
      {label}
    </Link>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────

function ApplicationSkeleton({ showHeader = true }: { showHeader?: boolean }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading application">
      {showHeader && (
        <MobileCard className="space-y-3">
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-2.5 w-full" />
        </MobileCard>
      )}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <MobileCard key={i}>
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="mt-2 h-3 w-2/3" />
            <Skeleton className="mt-1 h-3 w-1/2" />
          </MobileCard>
        ))}
      </div>
    </div>
  );
}

// ── Online status hook (reused from profile-view) ─────────────────

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
