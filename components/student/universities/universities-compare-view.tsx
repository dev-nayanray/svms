"use client";

import Link from "next/link";
import { useQueries } from "@tanstack/react-query";
import {
  Building2,
  CalendarClock,
  Check,
  ChevronRight,
  CreditCard,
  ExternalLink,
  FileCheck,
  Globe,
  GraduationCap,
  Minus,
  Star,
  Stamp,
} from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui";
import { MobileCard, StudentErrorState, StatusBadge } from "@/components/student/ui";
import { Skeleton } from "@/components/ui/overlays";
import { cn } from "@/lib/utils";
import {
  formatApplicationFee,
  resolveUniversityLogo,
  universityInitials,
} from "@/lib/constants/universities";
import { useOnlineStatus } from "@/lib/hooks/use-online-status";

// ── Types (mirror the API response shape from /api/student/universities/[id]) ──

type Course = {
  id: string;
  name: string;
  slug: string;
  degreeLevel: string;
  duration: string | null;
  tuitionFee: number | null;
  currency: string;
  applicationFee: number | null;
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
 * Universities Compare — fetches each university by id in parallel
 * (uses the existing /api/student/universities/[id] endpoint ×N)
 * and renders a side-by-side / stacked comparison.
 *
 * Layout (mobile-first):
 *  - On md+ screens: a 3-column layout with sticky attribute labels on
 *    the left and per-university columns stacked horizontally
 *  - On mobile: a vertical stack of "attribute cards" — each card
 *    shows the attribute name + one row per university's value
 *
 * Per-university loading + error states are independent — if one of
 * the universities 404s, the others still render. This is important
 * because students may swap one university in/out mid-comparison.
 *
 * Row highlights:
 *  - "best" (lowest fee, lowest ranking number, most courses) → green
 *  - "worst" (highest fee, highest ranking number, fewest courses) → red
 *  - others → neutral
 */
export function UniversitiesCompareView({ ids }: { ids: string[] }) {
  const online = useOnlineStatus();

  // Fire all detail fetches in parallel via useQueries — designed
  // for dynamic-length query arrays, calls hooks unconditionally.
  // Each query tracks its own loading + error state independently so
  // a slow/failed fetch doesn't block the others.
  const queries = useQueries({
    queries: ids.map((id) => ({
      queryKey: ["student-university-compare", id],
      queryFn: () => apiFetch<UniversityDetail>(`/api/student/universities/${id}`),
      retry: false,
      staleTime: 60_000,
    })),
  });

  const allLoading = queries.every((q) => q.isLoading && !q.data);
  const allErrored = queries.every((q) => q.isError && !q.data);

  if (allLoading) {
    return <CompareSkeleton count={ids.length} />;
  }

  if (allErrored) {
    return (
      <StudentErrorState
        online={online}
        title={!online ? "You're offline" : "Couldn't load universities"}
        description={!online ? "Check your connection and try again." : "Please try again in a moment."}
        onRetry={() => queries.forEach((q) => q.refetch())}
      />
    );
  }

  const universities = queries.map((q, i) => ({
    id: ids[i],
    data: q.data,
    isLoading: q.isLoading,
    error: q.error,
  }));

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-base font-semibold">
          <GraduationCap className="h-4 w-4 text-primary" aria-hidden />
          Compare universities
        </h1>
        <Link
          href="/student/universities"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          Back to list <ChevronRight className="h-3 w-3" aria-hidden />
        </Link>
      </div>

      {/* Per-university error banner — if any university failed to load */}
      {universities.some((u) => u.error && !u.data) && (
        <MobileCard className="border-amber-300/60 bg-amber-50/40 dark:bg-amber-950/10">
          <p className="text-sm font-medium text-amber-600">
            {universities.filter((u) => u.error && !u.data).length} of {ids.length} universities couldn&rsquo;t load
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            The other universities are still shown for comparison. Tap retry to re-fetch the failed ones.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="mt-2"
            onClick={() => {
              // Refetch every failed query — useQueries returns
              // results in the same order as the input array, so
              // index 0 = first id, etc.
              queries.forEach((q, i) => {
                if (q.isError) queries[i]?.refetch();
              });
            }}
          >
            Retry failed
          </Button>
        </MobileCard>
      )}

      {/* Mobile layout: stacked attribute cards */}
      <div className="space-y-3 md:hidden">
        <CompareMobileStack universities={universities} />
      </div>

      {/* Desktop layout: side-by-side columns */}
      <div className="hidden md:block">
        <CompareDesktopGrid universities={universities} />
      </div>
    </>
  );
}

// ── Mobile: stacked attribute cards ───────────────────────────────

function CompareMobileStack({
  universities,
}: {
  universities: { id: string; data?: UniversityDetail; isLoading: boolean; error: unknown }[];
}) {
  return (
    <>
      {/* Top: one card per university — basic info */}
      {universities.map((u) => (
        <MobileCard key={u.id} className="space-y-3">
          {u.isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : u.data ? (
            <CompareUniversityHeaderMobile data={u.data} />
          ) : (
            <div className="py-4 text-center text-xs text-muted-foreground">
              Failed to load.
            </div>
          )}
        </MobileCard>
      ))}

      {/* Attribute comparison cards */}
      <CompareAttributeCard
        title="Ranking"
        icon={<Star className="h-4 w-4 text-amber-500" aria-hidden />}
        bestIsLowest
        universities={universities}
        value={(u) => (u.ranking != null ? `#${u.ranking}` : "—")}
      />
      <CompareAttributeCard
        title="Application fee"
        icon={<CreditCard className="h-4 w-4 text-primary" aria-hidden />}
        bestIsLowest
        universities={universities}
        value={(u) =>
          u.applicationFee != null ? formatApplicationFee(u.applicationFee) : "—"
        }
      />
      <CompareAttributeCard
        title="Country"
        icon={<Globe className="h-4 w-4 text-blue-600" aria-hidden />}
        universities={universities}
        value={(u) => `${u.country.flag ?? ""} ${u.country.name}`.trim()}
      />
      <CompareAttributeCard
        title="City"
        icon={<Building2 className="h-4 w-4 text-muted-foreground" aria-hidden />}
        universities={universities}
        value={(u) => u.city ?? "—"}
      />
      <CompareAttributeCard
        title="Courses"
        icon={<GraduationCap className="h-4 w-4 text-primary" aria-hidden />}
        bestIsLowest={false}
        universities={universities}
        value={(u) => `${u.courses.length} course${u.courses.length === 1 ? "" : "s"}`}
      />
      <CompareAttributeCard
        title="Active intakes"
        icon={<CalendarClock className="h-4 w-4 text-blue-600" aria-hidden />}
        bestIsLowest={false}
        universities={universities}
        value={(u) => `${u.intakes.length} intake${u.intakes.length === 1 ? "" : "s"}`}
      />
      <CompareAttributeCard
        title="Document requirements"
        icon={<FileCheck className="h-4 w-4 text-emerald-600" aria-hidden />}
        bestIsLowest={false}
        universities={universities}
        value={(u) =>
          `${u.documentRequirements.length} required (${u.documentRequirements.filter((r) => r.required).length})`
        }
      />
      <CompareAttributeCard
        title="Visa requirements"
        icon={<Stamp className="h-4 w-4 text-amber-600" aria-hidden />}
        bestIsLowest={false}
        universities={universities}
        value={(u) => `${u.visaRequirements.length} item${u.visaRequirements.length === 1 ? "" : "s"}`}
      />

      {/* Tuition range — min/max across all courses */}
      <CompareAttributeCard
        title="Tuition range"
        icon={<CreditCard className="h-4 w-4 text-emerald-600" aria-hidden />}
        bestIsLowest
        universities={universities}
        value={(u) => {
          const fees = u.courses
            .map((c) => c.tuitionFee)
            .filter((f): f is number => typeof f === "number");
          if (fees.length === 0) return "—";
          const min = Math.min(...fees);
          const max = Math.max(...fees);
          const fmt = (n: number) => `${u.country.currency ?? "$"} ${n.toLocaleString()}`;
          return min === max ? fmt(min) : `${fmt(min)} – ${fmt(max)}`;
        }}
      />

      {/* CTA row */}
      <div className="space-y-2">
        {universities.map((u) => (
          <Link
            key={u.id}
            href={u.data ? `/student/universities/${u.data.id}` : "#"}
            className="flex min-h-[44px] items-center justify-center rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            View {u.data?.name ?? "—"} details <ChevronRight className="ml-1 h-3.5 w-3.5" aria-hidden />
          </Link>
        ))}
      </div>
    </>
  );
}

function CompareUniversityHeaderMobile({ data }: { data: UniversityDetail }) {
  const logo = resolveUniversityLogo(data.logo);
  return (
    <div className="flex items-center gap-3">
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logo}
          alt={data.name}
          className="h-12 w-12 shrink-0 rounded-lg object-contain"
        />
      ) : (
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
          {universityInitials(data.name)}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <Link
          href={`/student/universities/${data.id}`}
          className="block truncate text-sm font-semibold leading-tight hover:text-primary"
        >
          {data.name}
        </Link>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {data.country.flag ?? ""} {data.country.name}
          {data.city ? ` · ${data.city}` : ""}
        </p>
        {data.website && (
          <a
            href={data.website}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary"
          >
            <ExternalLink className="h-3 w-3" aria-hidden />
            Visit website
          </a>
        )}
      </div>
      {data.ranking != null && (
        <StatusBadge tone="info">#{data.ranking}</StatusBadge>
      )}
    </div>
  );
}

// ── Mobile: attribute card with one row per university ─────────────

function CompareAttributeCard({
  title,
  icon,
  universities,
  value,
  bestIsLowest,
}: {
  title: string;
  icon: React.ReactNode;
  universities: { id: string; data?: UniversityDetail; isLoading: boolean; error: unknown }[];
  value: (u: UniversityDetail) => string;
  bestIsLowest?: boolean;
}) {
  // Compute numeric values for highlighting — only if every loaded
  // university has a value the helper can extract a number from.
  const numericValues: { id: string; n: number }[] = [];
  for (const u of universities) {
    if (!u.data) continue;
    const raw = value(u.data);
    const match = raw.match(/[\d,.]+/);
    if (match) {
      const n = Number(match[0].replace(/,/g, ""));
      if (!isNaN(n)) numericValues.push({ id: u.id, n });
    }
  }

  // Determine best/worst — only when 2+ numeric values
  let bestId: string | null = null;
  let worstId: string | null = null;
  if (numericValues.length >= 2) {
    const sorted = [...numericValues].sort((a, b) => a.n - b.n);
    bestId = bestIsLowest ? sorted[0].id : sorted[sorted.length - 1].id;
    worstId = bestIsLowest ? sorted[sorted.length - 1].id : sorted[0].id;
  }

  return (
    <MobileCard className="p-0">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        {icon}
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h3>
      </div>
      <ul className="divide-y divide-border">
        {universities.map((u) => {
          if (u.isLoading) {
            return (
              <li key={u.id} className="px-3 py-2">
                <Skeleton className="h-4 w-2/3" />
              </li>
            );
          }
          if (!u.data) {
            return (
              <li key={u.id} className="px-3 py-2 text-xs text-muted-foreground">
                Failed to load
              </li>
            );
          }
          const val = value(u.data);
          const isBest = u.id === bestId;
          const isWorst = u.id === worstId;
          return (
            <li key={u.id} className="flex items-center justify-between gap-2 px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {u.data.name}
              </span>
              <span
                className={cn(
                  "shrink-0 text-sm font-bold tabular-nums",
                  isBest && "text-emerald-600",
                  isWorst && "text-red-600",
                  !isBest && !isWorst && "text-foreground",
                )}
              >
                {val}
              </span>
              {isBest && <Check className="h-3 w-3 text-emerald-600" aria-hidden />}
              {isWorst && <Minus className="h-3 w-3 text-red-600" aria-hidden />}
            </li>
          );
        })}
      </ul>
    </MobileCard>
  );
}

// ── Desktop: side-by-side grid ─────────────────────────────────────

function CompareDesktopGrid({
  universities,
}: {
  universities: { id: string; data?: UniversityDetail; isLoading: boolean; error: unknown }[];
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full table-fixed border-collapse">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="w-1/4 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Attribute
            </th>
            {universities.map((u) => (
              <th key={u.id} className="px-3 py-2 text-left align-top">
                {u.isLoading ? (
                  <Skeleton className="h-12 w-full" />
                ) : u.data ? (
                  <div className="flex items-start gap-2">
                    {(() => {
                      const logo = resolveUniversityLogo(u.data.logo);
                      return logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={logo} alt={u.data.name} className="h-10 w-10 rounded-lg object-contain" />
                      ) : (
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                          {universityInitials(u.data.name)}
                        </div>
                      );
                    })()}
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/student/universities/${u.data.id}`}
                        className="block truncate text-sm font-semibold hover:text-primary"
                      >
                        {u.data.name}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">
                        {u.data.country.flag ?? ""} {u.data.country.name}
                        {u.data.city ? ` · ${u.data.city}` : ""}
                      </p>
                    </div>
                  </div>
                ) : (
                  <span className="text-xs text-red-600">Failed</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <CompareRow
            label="Ranking"
            universities={universities}
            value={(u) => (u.ranking != null ? `#${u.ranking}` : "—")}
            bestIsLowest
          />
          <CompareRow
            label="Application fee"
            universities={universities}
            value={(u) => (u.applicationFee != null ? formatApplicationFee(u.applicationFee) : "—")}
            bestIsLowest
          />
          <CompareRow
            label="Country"
            universities={universities}
            value={(u) => `${u.country.flag ?? ""} ${u.country.name}`.trim()}
          />
          <CompareRow
            label="City"
            universities={universities}
            value={(u) => u.city ?? "—"}
          />
          <CompareRow
            label="Courses"
            universities={universities}
            value={(u) => `${u.courses.length} course${u.courses.length === 1 ? "" : "s"}`}
            bestIsLowest={false}
          />
          <CompareRow
            label="Active intakes"
            universities={universities}
            value={(u) => `${u.intakes.length} intake${u.intakes.length === 1 ? "" : "s"}`}
            bestIsLowest={false}
          />
          <CompareRow
            label="Tuition range"
            universities={universities}
            value={(u) => {
              const fees = u.courses
                .map((c) => c.tuitionFee)
                .filter((f): f is number => typeof f === "number");
              if (fees.length === 0) return "—";
              const min = Math.min(...fees);
              const max = Math.max(...fees);
              const fmt = (n: number) => `${u.country.currency ?? "$"} ${n.toLocaleString()}`;
              return min === max ? fmt(min) : `${fmt(min)} – ${fmt(max)}`;
            }}
            bestIsLowest
          />
          <CompareRow
            label="Document requirements"
            universities={universities}
            value={(u) => `${u.documentRequirements.length} (${u.documentRequirements.filter((r) => r.required).length} required)`}
            bestIsLowest={false}
          />
          <CompareRow
            label="Visa requirements"
            universities={universities}
            value={(u) => `${u.visaRequirements.length} item${u.visaRequirements.length === 1 ? "" : "s"}`}
            bestIsLowest={false}
          />
          <tr className="border-t border-border">
            <td className="px-3 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Actions
            </td>
            {universities.map((u) => (
              <td key={u.id} className="px-3 py-3">
                {u.data ? (
                  <Link
                    href={`/student/universities/${u.data.id}`}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    View details <ChevronRight className="h-3 w-3" aria-hidden />
                  </Link>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function CompareRow({
  label,
  universities,
  value,
  bestIsLowest,
}: {
  label: string;
  universities: { id: string; data?: UniversityDetail; isLoading: boolean; error: unknown }[];
  value: (u: UniversityDetail) => string;
  bestIsLowest?: boolean;
}) {
  const numericValues: { id: string; n: number }[] = [];
  for (const u of universities) {
    if (!u.data) continue;
    const raw = value(u.data);
    const match = raw.match(/[\d,.]+/);
    if (match) {
      const n = Number(match[0].replace(/,/g, ""));
      if (!isNaN(n)) numericValues.push({ id: u.id, n });
    }
  }
  let bestId: string | null = null;
  let worstId: string | null = null;
  if (numericValues.length >= 2) {
    const sorted = [...numericValues].sort((a, b) => a.n - b.n);
    bestId = bestIsLowest ? sorted[0].id : sorted[sorted.length - 1].id;
    worstId = bestIsLowest ? sorted[sorted.length - 1].id : sorted[0].id;
  }

  return (
    <tr className="border-b border-border last:border-0">
      <td className="bg-muted/20 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </td>
      {universities.map((u) => {
        if (u.isLoading) {
          return (
            <td key={u.id} className="px-3 py-2">
              <Skeleton className="h-4 w-2/3" />
            </td>
          );
        }
        if (!u.data) {
          return (
            <td key={u.id} className="px-3 py-2 text-xs text-muted-foreground">
              Failed
            </td>
          );
        }
        const val = value(u.data);
        const isBest = u.id === bestId;
        const isWorst = u.id === worstId;
        return (
          <td key={u.id} className="px-3 py-2">
            <span
              className={cn(
                "inline-flex items-center gap-1 text-sm font-semibold tabular-nums",
                isBest && "text-emerald-600",
                isWorst && "text-red-600",
                !isBest && !isWorst && "text-foreground",
              )}
            >
              {val}
              {isBest && <Check className="h-3 w-3" aria-hidden />}
              {isWorst && <Minus className="h-3 w-3" aria-hidden />}
            </span>
          </td>
        );
      })}
    </tr>
  );
}

// ── Loading skeleton ───────────────────────────────────────────────

function CompareSkeleton({ count }: { count: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading comparison">
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        {Array.from({ length: count }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-32 w-full rounded-lg" />
      <Skeleton className="h-32 w-full rounded-lg" />
      <Skeleton className="h-32 w-full rounded-lg" />
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────

