"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Bookmark,
  CalendarClock,
  ChevronDown,
  ChevronLeft,
  ExternalLink,
  FileCheck,
  Globe,
  GraduationCap,
  Heart,
  Info,
  RefreshCw,
  Star,
  WifiOff,
} from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { Button, Badge } from "@/components/ui";
import { MobilePage, MobileCard } from "@/components/student/ui";
import { Skeleton } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";
import {
  formatApplicationFee,
  rankingTier,
  resolveUniversityLogo,
  universityInitials,
} from "@/lib/constants/universities";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";

// ── Types (mirror the API response shape) ──────────────────────────

type Course = {
  id: string;
  name: string;
  slug: string;
  degreeLevel: string;
  duration: string | null;
  tuitionFee: number | null;
  currency: string;
  applicationFee: number | null;
  academicRequirements: string | null;
  englishRequirements: string | null;
  ieltsRequirement: string | null;
  toeflRequirement: string | null;
  pteRequirement: string | null;
  applicationDeadline: string | null;
  status: string;
};

type IntakeFlattened = {
  id: string;
  name: string;
  month: number;
  year: number;
  deadline: string | null;
  courseName: string;
  degreeLevel: string;
};

type Requirement = {
  id: string;
  name: string;
  description: string | null;
  required: boolean;
  appliesTo?: string;
};

type UniversityDetail = {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  website: string | null;
  logo: string | null;
  description: string | null;
  ranking: number | null;
  applicationFee: number | null;
  status: string;
  country: {
    id: string;
    name: string;
    code: string;
    flag: string | null;
    currency: string | null;
  };
  courses: Course[];
  intakes: IntakeFlattened[];
  documentRequirements: Requirement[];
  visaRequirements: Requirement[];
  isFavorite: boolean;
  counselingRequested: boolean;
  counselingRequestStatus: string | null;
};

// ── Component ──────────────────────────────────────────────────────

/**
 * Mobile-first university detail view for Module 07. Fetches the
 * university via the secure `/api/student/universities/[id]` endpoint
 * (which enforces the student-visibility rule: only ACTIVE universities
 * in ACTIVE countries are returned).
 *
 * Renders 5 sections as expandable cards (accordions on mobile, tabbed
 * on desktop):
 *  - Overview — description + quick-facts grid
 *  - Courses — card list (NOT a table) with expandable details
 *  - Intakes — chronological card list
 *  - Requirements — document + visa requirements with required/optional badges
 *  - Application Information — fee, how-to-apply guidance
 *
 * Student actions (Favorite, Request Counseling, Visit Website) are
 * in a sticky action bar at the bottom on mobile, and inline at the
 * top on desktop.
 */
export function UniversityDetailView({ id }: { id: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const qc = useQueryClient();

  const detailQ = useQuery({
    queryKey: ["student-university-detail", id],
    queryFn: () => apiFetch<UniversityDetail>(`/api/student/universities/${id}`),
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
            {!online ? "You're offline" : "University not found"}
          </h2>
          <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
            {!online
              ? "Check your connection and try again."
              : detailQ.error instanceof Error
                ? detailQ.error.message
                : "This university may have been archived or is no longer available."}
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Button
              variant="outline"
              onClick={() => router.push("/student/universities")}
            >
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

  const uni = detailQ.data;
  const logo = resolveUniversityLogo(uni.logo);
  const tier = rankingTier(uni.ranking);
  const location = [uni.city, uni.country.name].filter(Boolean).join(", ");

  async function toggleFavorite() {
    // Optimistic update
    qc.setQueryData<UniversityDetail>(["student-university-detail", id], (prev) =>
      prev ? { ...prev, isFavorite: !prev.isFavorite } : prev,
    );
    try {
      const result = await apiFetch<{ isFavorite: boolean }>("/api/student/favorites", {
        method: "POST",
        json: { universityId: id },
      });
      qc.setQueryData<UniversityDetail>(["student-university-detail", id], (prev) =>
        prev ? { ...prev, isFavorite: result.isFavorite } : prev,
      );
      qc.invalidateQueries({ queryKey: ["/api/student/universities"] });
      toast({
        title: result.isFavorite ? "Added to favorites" : "Removed from favorites",
        variant: "success",
      });
    } catch (err) {
      // Roll back
      qc.setQueryData<UniversityDetail>(["student-university-detail", id], (prev) =>
        prev ? { ...prev, isFavorite: !prev.isFavorite } : prev,
      );
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
        href="/student/universities"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
      >
        <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> Universities
      </Link>

      {/* Header card */}
      <MobileCard className="space-y-3">
        <div className="flex items-start gap-3">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logo}
              alt={`${uni.name} logo`}
              className="h-16 w-16 shrink-0 rounded-lg object-contain"
              loading="lazy"
            />
          ) : (
            <span
              className="grid h-16 w-16 shrink-0 place-items-center rounded-lg bg-primary/10 text-base font-semibold text-primary"
              aria-hidden
            >
              {universityInitials(uni.name)}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold leading-tight">{uni.name}</h1>
            {location && (
              <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
                <Globe className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {location}
                {uni.country.flag && (
                  <span aria-hidden className="ml-1">{uni.country.flag}</span>
                )}
              </p>
            )}
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {uni.ranking != null && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                  <Star className="h-3 w-3" aria-hidden />#{uni.ranking}
                  {tier === "top" && " · Top 50"}
                  {tier === "leading" && " · Top 200"}
                </span>
              )}
              <Badge tone="success">Active</Badge>
            </div>
          </div>
        </div>
        {uni.description && (
          <p className="line-clamp-3 text-sm text-muted-foreground">{uni.description}</p>
        )}
      </MobileCard>

      {/* Sticky action bar (mobile) / inline actions (desktop) */}
      <div className="sticky top-14 z-20 -mx-4 flex items-center gap-2 border-b border-border bg-card/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-card/80 md:static md:mx-0 md:rounded-lg md:border md:bg-card md:p-3 md:backdrop-blur-none">
        <Button
          variant={uni.isFavorite ? "default" : "outline"}
          size="sm"
          onClick={toggleFavorite}
          className="flex-1 md:flex-none"
        >
          <Heart
            className={cn("h-4 w-4", uni.isFavorite && "fill-current")}
            aria-hidden
          />
          <span className="hidden sm:inline">
            {uni.isFavorite ? "Saved" : "Save"}
          </span>
        </Button>
        {uni.counselingRequested ? (
          <Button variant="outline" size="sm" disabled className="flex-1 md:flex-none">
            <Info className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">
              {uni.counselingRequestStatus === "RESOLVED"
                ? "Counseling done"
                : "Counseling requested"}
            </span>
          </Button>
        ) : (
          <Button
            variant="default"
            size="sm"
            onClick={() => router.push(`/student/universities/${id}?action=counseling`)}
            className="flex-1 md:flex-none"
          >
            Request Counseling
          </Button>
        )}
        {uni.website && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.open(uni.website!, "_blank", "noopener,noreferrer")}
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
          <div className="space-y-3">
            {uni.description ? (
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{uni.description}</p>
            ) : (
              <p className="text-sm text-muted-foreground">No description available.</p>
            )}
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <FactRow label="Country" value={
                <span className="inline-flex items-center gap-1">
                  {uni.country.flag && <span aria-hidden>{uni.country.flag}</span>}
                  {uni.country.name}
                </span>
              } />
              {uni.city && <FactRow label="City" value={uni.city} />}
              {uni.ranking != null && <FactRow label="World ranking" value={`#${uni.ranking}`} />}
              {uni.applicationFee != null && (
                <FactRow
                  label="Application fee"
                  value={formatApplicationFee(uni.applicationFee, uni.country.currency)}
                />
              )}
              {uni.country.currency && (
                <FactRow label="Local currency" value={uni.country.currency} />
              )}
            </dl>
          </div>
        </ExpandableCard>

        {/* Courses */}
        <ExpandableCard
          icon={<GraduationCap className="h-4 w-4 text-primary" aria-hidden />}
          title={`Courses (${uni.courses.length})`}
          badge={<Badge tone="info">{uni.courses.length}</Badge>}
        >
          {uni.courses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No courses published yet.</p>
          ) : (
            <ul className="space-y-2">
              {uni.courses.map((c) => (
                <CourseCard key={c.id} course={c} />
              ))}
            </ul>
          )}
        </ExpandableCard>

        {/* Intakes */}
        <ExpandableCard
          icon={<CalendarClock className="h-4 w-4 text-primary" aria-hidden />}
          title={`Intakes (${uni.intakes.length})`}
          badge={<Badge tone="info">{uni.intakes.length}</Badge>}
        >
          {uni.intakes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No open intakes right now.</p>
          ) : (
            <ul className="space-y-2">
              {uni.intakes.map((i) => (
                <li key={i.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{i.name}</p>
                      <p className="text-xs text-muted-foreground">{i.courseName} · {i.degreeLevel}</p>
                    </div>
                    {i.deadline && (
                      <Badge tone={isDeadlineSoon(i.deadline) ? "warning" : "default"}>
                        Due {fmtDate(i.deadline)}
                      </Badge>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ExpandableCard>

        {/* Requirements */}
        <ExpandableCard
          icon={<FileCheck className="h-4 w-4 text-primary" aria-hidden />}
          title={`Requirements (${uni.documentRequirements.length + uni.visaRequirements.length})`}
          badge={<Badge tone="info">{uni.documentRequirements.length + uni.visaRequirements.length}</Badge>}
        >
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Document Requirements
              </p>
              {uni.documentRequirements.length === 0 ? (
                <p className="text-sm text-muted-foreground">No document requirements configured.</p>
              ) : (
                <ul className="space-y-1.5">
                  {uni.documentRequirements.map((r) => (
                    <RequirementItem key={r.id} req={r} />
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Visa Requirements ({uni.country.name})
              </p>
              {uni.visaRequirements.length === 0 ? (
                <p className="text-sm text-muted-foreground">No visa requirements configured.</p>
              ) : (
                <ul className="space-y-1.5">
                  {uni.visaRequirements.map((r) => (
                    <RequirementItem key={r.id} req={r} />
                  ))}
                </ul>
              )}
            </div>
          </div>
        </ExpandableCard>

        {/* Application Information */}
        <ExpandableCard
          icon={<Bookmark className="h-4 w-4 text-primary" aria-hidden />}
          title="Application Information"
        >
          <div className="space-y-3">
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <FactRow
                label="Application fee"
                value={
                  uni.applicationFee != null
                    ? formatApplicationFee(uni.applicationFee, uni.country.currency)
                    : "—"
                }
              />
              <FactRow label="Courses available" value={String(uni.courses.length)} />
              <FactRow label="Open intakes" value={String(uni.intakes.length)} />
              <FactRow label="Country currency" value={uni.country.currency ?? "—"} />
            </dl>
            <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
              <p className="font-medium">How to apply</p>
              <p className="mt-1 text-muted-foreground">
                Students don&apos;t apply directly through this portal. To start an application
                to <strong>{uni.name}</strong>, request counseling and your assigned counselor
                will guide you through course selection, document collection, and submission.
              </p>
            </div>
          </div>
        </ExpandableCard>
      </div>

      {/* CTA row */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Link
          href="/student/universities"
          className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> Back to list
        </Link>
        <Link
          href="/student/courses"
          className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"
        >
          <GraduationCap className="h-3.5 w-3.5" aria-hidden /> Browse Courses
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

function CourseCard({ course }: { course: Course }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails = !!(
    course.duration ||
    course.tuitionFee != null ||
    course.academicRequirements ||
    course.englishRequirements ||
    course.ieltsRequirement ||
    course.toeflRequirement ||
    course.pteRequirement
  );
  return (
    <li className="rounded-lg border border-border">
      <button
        type="button"
        onClick={() => hasDetails && setExpanded((v) => !v)}
        disabled={!hasDetails}
        aria-expanded={expanded}
        className="flex w-full items-start justify-between gap-2 p-3 text-left focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-default"
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{course.name}</p>
          <p className="text-xs text-muted-foreground">{course.degreeLevel}</p>
        </div>
        {course.tuitionFee != null && (
          <span className="shrink-0 text-sm font-semibold">
            {course.currency} {course.tuitionFee.toLocaleString()}
          </span>
        )}
        {hasDetails && (
          <ChevronDown
            className={cn("mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")}
            aria-hidden
          />
        )}
      </button>
      {expanded && hasDetails && (
        <div className="border-t border-border p-3 text-xs">
          <dl className="grid grid-cols-2 gap-2">
            {course.duration && <FactRow label="Duration" value={course.duration} />}
            {course.applicationFee != null && (
              <FactRow label="App. fee" value={`${course.currency} ${course.applicationFee.toLocaleString()}`} />
            )}
            {course.applicationDeadline && (
              <FactRow label="Deadline" value={fmtDate(course.applicationDeadline)} />
            )}
            {course.academicRequirements && (
              <div className="col-span-2">
                <dt className="text-muted-foreground">Academic requirements</dt>
                <dd className="mt-0.5">{course.academicRequirements}</dd>
              </div>
            )}
            {course.englishRequirements && (
              <div className="col-span-2">
                <dt className="text-muted-foreground">English requirements</dt>
                <dd className="mt-0.5">{course.englishRequirements}</dd>
              </div>
            )}
            {course.ieltsRequirement && (
              <div className="col-span-2">
                <dt className="text-muted-foreground">IELTS</dt>
                <dd className="mt-0.5">{course.ieltsRequirement}</dd>
              </div>
            )}
            {course.toeflRequirement && (
              <div className="col-span-2">
                <dt className="text-muted-foreground">TOEFL</dt>
                <dd className="mt-0.5">{course.toeflRequirement}</dd>
              </div>
            )}
            {course.pteRequirement && (
              <div className="col-span-2">
                <dt className="text-muted-foreground">PTE</dt>
                <dd className="mt-0.5">{course.pteRequirement}</dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </li>
  );
}

function RequirementItem({ req }: { req: Requirement }) {
  return (
    <li className="flex items-start justify-between gap-3 rounded-md border border-border p-2.5">
      <div className="min-w-0">
        <p className="text-sm font-medium">{req.name}</p>
        {req.description && <p className="text-xs text-muted-foreground">{req.description}</p>}
        {req.appliesTo && (
          <p className="mt-0.5 text-[11px] text-muted-foreground">Scope: {req.appliesTo}</p>
        )}
      </div>
      <span
        className={cn(
          "shrink-0 text-xs font-medium",
          req.required ? "text-warning" : "text-muted-foreground",
        )}
      >
        {req.required ? "Required" : "Optional"}
      </span>
    </li>
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

function DetailSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading university">
      <Skeleton className="h-4 w-24" />
      <MobileCard className="space-y-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-16 w-16 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
      </MobileCard>
      <Skeleton className="h-12 w-full rounded-lg" />
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-xl" />
      ))}
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

function isDeadlineSoon(deadline: string): boolean {
  try {
    const date = parseISO(deadline);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000; // within 30 days
  } catch {
    return false;
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
