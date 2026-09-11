"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BookOpen,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ExternalLink,
  FileCheck,
  Globe,
  GraduationCap,
  Info,
  RefreshCw,
  WifiOff,
} from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { Button, Badge } from "@/components/ui";
import { MobilePage, MobileCard } from "@/components/student/ui";
import { Skeleton } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";
import {
  COURSE_DEGREE_LABELS,
  formatTuitionFee,
  intakeStartDate,
  intakeDeadlineUrgency,
  formatShortDate,
  type IntakeUrgency,
} from "@/lib/constants/courses";
import { resolveUniversityLogo, universityInitials } from "@/lib/constants/universities";
import { cn } from "@/lib/utils";

// ── Types (mirror the API response shape) ──────────────────────────

type Intake = {
  id: string;
  name: string;
  month: number;
  year: number;
  deadline: string | null;
  status: string;
};

type CourseDetail = {
  id: string;
  name: string;
  slug: string;
  universityId: string;
  degreeLevel: string;
  duration: string | null;
  tuitionFee: number | null;
  currency: string;
  applicationFee: number | null;
  applicationDeadline: string | null;
  academicRequirements: string | null;
  englishRequirements: string | null;
  ieltsRequirement: string | null;
  toeflRequirement: string | null;
  pteRequirement: string | null;
  status: string;
  university: {
    id: string;
    name: string;
    logo: string | null;
    website: string | null;
    city: string | null;
    country: {
      id: string;
      name: string;
      code: string;
      flag: string | null;
      currency: string | null;
    };
  };
  intakes: Intake[];
  englishRequirementsList: { test: string; label: string; value: string }[];
  counselingRequested: boolean;
  counselingRequestStatus: string | null;
};

// ── Component ──────────────────────────────────────────────────────

export function CourseDetailView({ id }: { id: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const qc = useQueryClient();

  const detailQ = useQuery({
    queryKey: ["student-course-detail", id],
    queryFn: () => apiFetch<CourseDetail>(`/api/student/courses/${id}`),
    retry: false,
    staleTime: 30_000,
  });

  const online = useOnlineStatus();

  if (detailQ.isLoading && !detailQ.data) {
    return (
      <MobilePage>
        <DetailSkeleton />
      </MobilePage>
    );
  }

  if (detailQ.isError || !detailQ.data) {
    return (
      <MobilePage>
        <MobileCard className="py-8 text-center">
          {!online ? (
            <WifiOff className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden />
          ) : (
            <AlertTriangle className="mx-auto h-10 w-10 text-destructive" aria-hidden />
          )}
          <h2 className="mt-3 text-base font-semibold">
            {!online ? "You're offline" : "Course not found"}
          </h2>
          <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
            {!online
              ? "Check your connection and try again."
              : detailQ.error instanceof Error
                ? detailQ.error.message
                : "This course may have been archived or is no longer available."}
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Button variant="outline" onClick={() => router.push("/student/courses")}>
              <ChevronLeft className="h-4 w-4" aria-hidden /> Back to list
            </Button>
            <Button onClick={() => detailQ.refetch()} disabled={!online}>
              <RefreshCw className="h-4 w-4" aria-hidden /> Retry
            </Button>
          </div>
        </MobileCard>
      </MobilePage>
    );
  }

  const course = detailQ.data;
  const degreeLabel =
    COURSE_DEGREE_LABELS[course.degreeLevel as keyof typeof COURSE_DEGREE_LABELS] ??
    course.degreeLevel;
  const location = [course.university.city, course.university.country.name]
    .filter(Boolean)
    .join(", ");
  const logo = resolveUniversityLogo(course.university.logo);
  const now = new Date();
  const sortedIntakes = [...course.intakes].sort((a, b) => {
    const sa = intakeStartDate(a.month, a.year)?.getTime() ?? 0;
    const sb = intakeStartDate(b.month, b.year)?.getTime() ?? 0;
    return sa - sb;
  });

  async function requestCounseling() {
    try {
      await apiFetch("/api/student/counseling-requests", {
        method: "POST",
        json: {
          universityId: course.universityId,
          courseId: course.id,
          message: `I'm interested in ${course.name} at ${course.university.name}. Can we discuss entry requirements and the application process?`,
        },
      });
      qc.setQueryData<CourseDetail>(["student-course-detail", id], (prev) =>
        prev ? { ...prev, counselingRequested: true, counselingRequestStatus: "PENDING" } : prev,
      );
      toast({
        title: "Request sent",
        description: `Your counselor will reach out about ${course.name}.`,
        variant: "success",
      });
    } catch (err) {
      toast({
        title: "Failed",
        description: err instanceof Error ? err.message : "Try again",
        variant: "error",
      });
    }
  }

  return (
    <MobilePage>
      {/* Back link */}
      <Link
        href="/student/courses"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
      >
        <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> Courses
      </Link>

      {/* Header card */}
      <MobileCard className="space-y-3">
        <div className="flex items-start gap-3">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logo}
              alt={`${course.university.name} logo`}
              className="h-12 w-12 shrink-0 rounded-lg object-contain"
              loading="lazy"
            />
          ) : (
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-primary/10 text-sm font-semibold text-primary" aria-hidden>
              {universityInitials(course.university.name)}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              <GraduationCap className="h-3 w-3" aria-hidden />
              {degreeLabel}
            </span>
            <h1 className="mt-1 text-lg font-semibold leading-tight">{course.name}</h1>
            <Link
              href={`/student/universities/${course.university.id}`}
              className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
            >
              <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {course.university.name}
            </Link>
            {location && (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <Globe className="h-3 w-3 shrink-0" aria-hidden />
                {course.university.country.flag ? `${course.university.country.flag} ` : ""}
                {location}
              </p>
            )}
          </div>
        </div>
      </MobileCard>

      {/* Sticky action bar */}
      <div className="sticky top-14 z-20 -mx-4 flex items-center gap-2 border-b border-border bg-card/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-card/80 md:static md:mx-0 md:rounded-lg md:border md:bg-card md:p-3 md:backdrop-blur-none">
        {course.counselingRequested ? (
          <Button variant="outline" size="sm" disabled className="flex-1 md:flex-none">
            <Info className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">
              {course.counselingRequestStatus === "RESOLVED"
                ? "Counseling done"
                : "Counseling requested"}
            </span>
          </Button>
        ) : (
          <Button variant="default" size="sm" onClick={requestCounseling} className="flex-1 md:flex-none">
            Request Counseling
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(`/student/universities/${course.university.id}`)}
          className="flex-1 md:flex-none"
        >
          <Building2 className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">University</span>
        </Button>
        {course.university.website && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.open(course.university.website!, "_blank", "noopener,noreferrer")}
            className="shrink-0"
            aria-label="Visit university website"
          >
            <ExternalLink className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">Website</span>
          </Button>
        )}
      </div>

      {/* Expandable sections */}
      <div className="space-y-3">
        {/* Overview */}
        <ExpandableCard
          icon={<Info className="h-4 w-4 text-primary" aria-hidden />}
          title="Overview"
          defaultOpen
        >
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <FactRow label="Degree" value={degreeLabel} />
            {course.duration && <FactRow label="Duration" value={course.duration} />}
            {course.tuitionFee != null && (
              <FactRow label="Tuition" value={formatTuitionFee(course.tuitionFee, course.currency)} />
            )}
            {course.applicationFee != null && (
              <FactRow label="App. fee" value={formatTuitionFee(course.applicationFee, course.currency)} />
            )}
            {course.university.country.currency && (
              <FactRow label="Currency" value={course.university.country.currency} />
            )}
            <FactRow label="Open intakes" value={String(course.intakes.length)} />
          </dl>
        </ExpandableCard>

        {/* Intakes */}
        <ExpandableCard
          icon={<CalendarClock className="h-4 w-4 text-primary" aria-hidden />}
          title={`Intakes (${sortedIntakes.length})`}
          badge={<Badge tone="info">{sortedIntakes.length}</Badge>}
        >
          {sortedIntakes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No active intakes right now. Request counseling to ask about future intakes.
            </p>
          ) : (
            <ul className="space-y-2">
              {sortedIntakes.map((i) => {
                const startDate = intakeStartDate(i.month, i.year);
                const urgency = intakeDeadlineUrgency(i.deadline, now);
                return (
                  <IntakeCard
                    key={i.id}
                    name={i.name}
                    startDate={startDate}
                    deadline={i.deadline}
                    urgency={urgency}
                  />
                );
              })}
            </ul>
          )}
        </ExpandableCard>

        {/* Requirements — English + Academic */}
        <ExpandableCard
          icon={<BookOpen className="h-4 w-4 text-primary" aria-hidden />}
          title="Requirements"
        >
          <div className="space-y-4">
            {/* English requirements */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                English Requirements
              </p>
              {course.englishRequirementsList.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No structured English requirements. Ask your counselor about English-test expectations.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {course.englishRequirementsList.map((er) => (
                    <li key={er.test} className="flex items-center justify-between gap-3 rounded-md border border-border p-2.5">
                      <span className="font-medium">{er.label}</span>
                      <span className="text-sm text-muted-foreground">{er.value}</span>
                    </li>
                  ))}
                </ul>
              )}
              {course.englishRequirements && (
                <div className="mt-2 rounded-md bg-muted/30 p-2.5 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">Additional notes</p>
                  <p className="mt-0.5">{course.englishRequirements}</p>
                </div>
              )}
            </div>

            {/* Academic requirements */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Academic Requirements
              </p>
              {course.academicRequirements ? (
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {course.academicRequirements}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Not specified. Your counselor can clarify the academic entry requirements.
                </p>
              )}
            </div>
          </div>
        </ExpandableCard>

        {/* Application Information */}
        <ExpandableCard
          icon={<FileCheck className="h-4 w-4 text-primary" aria-hidden />}
          title="Application Information"
        >
          <div className="space-y-3">
            <dl className="grid grid-cols-2 gap-2 text-sm">
              {course.tuitionFee != null && (
                <FactRow label="Tuition" value={formatTuitionFee(course.tuitionFee, course.currency)} />
              )}
              {course.applicationFee != null && (
                <FactRow label="App. fee" value={formatTuitionFee(course.applicationFee, course.currency)} />
              )}
              <FactRow label="Degree" value={degreeLabel} />
              <FactRow label="Duration" value={course.duration ?? "—"} />
            </dl>

            {course.applicationDeadline && (
              <DeadlineBanner
                deadline={course.applicationDeadline}
                urgency={intakeDeadlineUrgency(course.applicationDeadline, now)}
              />
            )}

            <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
              <p className="font-medium">How to apply</p>
              <p className="mt-1 text-muted-foreground">
                Students don&apos;t apply directly through this portal. To start an application
                to <strong>{course.name}</strong> at <strong>{course.university.name}</strong>,
                request counseling and your assigned counselor will guide you through document
                collection, intake selection, and submission.
              </p>
            </div>
          </div>
        </ExpandableCard>
      </div>

      {/* CTA row */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Link
          href="/student/courses"
          className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> Back to list
        </Link>
        <Link
          href="/student/universities"
          className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"
        >
          <Building2 className="h-3.5 w-3.5" aria-hidden /> Universities
        </Link>
        <Link
          href="/student/application"
          className="col-span-2 flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary sm:col-span-1"
        >
          My Application
        </Link>
      </div>
    </MobilePage>
  );
}

// ── Sub-components ─────────────────────────────────────────────────

function ExpandableCard({
  icon,
  title,
  badge,
  defaultOpen = false,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <MobileCard className="overflow-hidden p-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 p-4 text-left focus-visible:outline-2 focus-visible:outline-primary"
      >
        <span className="flex items-center gap-2">
          {icon}
          <h2 className="text-sm font-semibold">{title}</h2>
        </span>
        <span className="flex items-center gap-2">
          {badge}
          <ChevronDown
            className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")}
            aria-hidden
          />
        </span>
      </button>
      {open && <div className="border-t border-border p-4">{children}</div>}
    </MobileCard>
  );
}

function FactRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium">{value || <span className="text-muted-foreground/70">—</span>}</dd>
    </div>
  );
}

function IntakeCard({
  name,
  startDate,
  deadline,
  urgency,
}: {
  name: string;
  startDate: Date | null;
  deadline: string | null;
  urgency: IntakeUrgency;
}) {
  const urgencyBadge = {
    urgent: (
      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[11px] font-medium text-destructive">
        <AlertTriangle className="h-3 w-3" aria-hidden /> ≤7 days
      </span>
    ),
    soon: (
      <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning">
        <CalendarClock className="h-3 w-3" aria-hidden /> ≤30 days
      </span>
    ),
    past: (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
        Closed
      </span>
    ),
    none: (
      <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success">
        <CheckCircle2 className="h-3 w-3" aria-hidden /> Open
      </span>
    ),
    normal: (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
        Open
      </span>
    ),
  }[urgency];

  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{name}</p>
        <p className="text-xs text-muted-foreground">
          Starts {startDate ? formatShortDate(startDate) : "—"}
          {" · "}
          Deadline {deadline ? formatShortDate(deadline) : "Open"}
        </p>
      </div>
      {urgencyBadge}
    </li>
  );
}

function DeadlineBanner({
  deadline,
  urgency,
}: {
  deadline: string;
  urgency: IntakeUrgency;
}) {
  const toneCls = {
    urgent: "border-destructive/40 bg-destructive/10 text-destructive",
    soon: "border-warning/40 bg-warning/10 text-warning",
    past: "border-border bg-muted/30 text-muted-foreground",
    normal: "border-border bg-muted/30 text-foreground",
    none: "border-border bg-muted/30 text-foreground",
  }[urgency];

  const hint = {
    urgent: "Less than 7 days left — request counseling now.",
    soon: "Less than 30 days left — start your application soon.",
    normal: "There's still time to apply.",
    past: "This deadline has passed. Ask your counselor about the next intake.",
    none: "No specific deadline — contact your counselor.",
  }[urgency];

  return (
    <div className={cn("rounded-md border p-3", toneCls)}>
      <p className="flex items-center gap-2 text-sm font-medium">
        <CalendarClock className="h-4 w-4" aria-hidden />
        Application deadline: {formatShortDate(deadline)}
      </p>
      <p className="mt-0.5 text-xs opacity-80">{hint}</p>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading course">
      <Skeleton className="h-4 w-20" />
      <MobileCard className="space-y-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-12 w-12 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      </MobileCard>
      <Skeleton className="h-12 w-full rounded-lg" />
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-xl" />
      ))}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────

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
