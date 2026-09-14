"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  Card,
  CardContent,
  Input,
  Label,
  Select,
} from "@/components/ui";
import { EmptyState } from "@/components/shared";
import { Drawer, Dialog, DialogContent } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";
import { apiFetch, type Paged } from "@/lib/api-client";
import {
  COURSE_DEGREE_LABELS,
  formatTuitionFee,
  type StudentCourseSort,
} from "@/lib/constants/courses";
import {
  ChevronLeft,
  ChevronRight,
  Globe,
  GraduationCap,
  SlidersHorizontal,
  Search,
  Clock,
  X,
  Building2,
  BookOpen,
} from "lucide-react";

type Country = { id: string; name: string; flag: string | null };
type University = { id: string; name: string; logo: string | null };
type EnglishReq = { test: string; label: string; value: string };

type Course = {
  id: string;
  name: string;
  degreeLevel: string;
  duration: string | null;
  tuitionFee: number | null;
  currency: string;
  applicationFee: number | null;
  applicationDeadline: string | null;
  academicRequirements: string | null;
  ieltsRequirement: string | null;
  toeflRequirement: string | null;
  pteRequirement: string | null;
  englishRequirementsList: EnglishReq[];
  hasOpenIntake: boolean;
  activeIntakeCount: number;
  university: { id: string; name: string; logo: string | null; country: Country };
};

type Meta = {
  countries: Country[];
  universities: University[];
  degreeLevels: readonly string[];
  intakes: {
    id: string;
    name: string;
    month: number;
    year: number;
    deadline: string | null;
    courseName: string;
    universityName: string;
  }[];
  tuitionMin: number | null;
  tuitionMax: number | null;
};

type Filters = {
  search: string;
  countryId: string;
  universityId: string;
  degreeLevel: string;
  tuitionMin: string;
  tuitionMax: string;
  intakeId: string;
  englishTest: string;
  sortBy: StudentCourseSort | "";
};

const EMPTY_FILTERS: Filters = {
  search: "",
  countryId: "",
  universityId: "",
  degreeLevel: "",
  tuitionMin: "",
  tuitionMax: "",
  intakeId: "",
  englishTest: "",
  sortBy: "",
};

const SORT_OPTIONS: { value: StudentCourseSort; label: string }[] = [
  { value: "name", label: "Name (A→Z)" },
  { value: "tuitionFee", label: "Lowest tuition" },
  { value: "degreeLevel", label: "Degree level" },
  { value: "createdAt", label: "Newest" },
];

const ENGLISH_TEST_OPTIONS = [
  { value: "", label: "Any" },
  { value: "ielts", label: "IELTS" },
  { value: "toefl", label: "TOEFL" },
  { value: "pte", label: "PTE Academic" },
  { value: "any", label: "Has any English test" },
];

/**
 * Student-facing mobile-first course discovery list.
 *
 * Layout mirrors the universities list (Module 07): sticky search, sort
 * dropdown inline, filter bottom sheet, active-filter chips, card grid
 * (1-col mobile → 2-col sm+). Server-side filtering + pagination so
 * invisible courses never leak to the client.
 */
export function StudentCoursesList({ basePath }: { basePath: string }) {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [pendingFilters, setPendingFilters] = useState<Filters>(EMPTY_FILTERS);
  const [counselingFor, setCounselingFor] = useState<Course | null>(null);

  const { data: meta } = useQuery({
    queryKey: ["/api/student/courses/meta"],
    queryFn: () => apiFetch<Meta>("/api/student/courses/meta"),
    staleTime: 5 * 60_000,
  });

  const queryString = useMemo(() => {
    const sp = new URLSearchParams({ page: String(page), pageSize: "12" });
    if (filters.search) sp.set("search", filters.search);
    if (filters.countryId) sp.set("countryId", filters.countryId);
    if (filters.universityId) sp.set("universityId", filters.universityId);
    if (filters.degreeLevel) sp.set("degreeLevel", filters.degreeLevel);
    if (filters.tuitionMin) sp.set("tuitionMin", filters.tuitionMin);
    if (filters.tuitionMax) sp.set("tuitionMax", filters.tuitionMax);
    if (filters.intakeId) sp.set("intakeId", filters.intakeId);
    if (filters.englishTest) sp.set("englishTest", filters.englishTest);
    if (filters.sortBy) sp.set("sortBy", filters.sortBy);
    return sp.toString();
  }, [page, filters]);

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["/api/student/courses", queryString],
    queryFn: () =>
      apiFetch<Paged<Course>>(`/api/student/courses?${queryString}`),
    placeholderData: (prev) => prev,
  });

  const rows = data?.data ?? [];
  const pg = data?.pagination;

  const updateFilters = (next: Partial<Filters>) => {
    setFilters((prev) => ({ ...prev, ...next }));
    setPage(1);
  };

  const openFilterSheet = () => {
    setPendingFilters(filters);
    setFilterSheetOpen(true);
  };

  const applyFilters = () => {
    setFilters(pendingFilters);
    setFilterSheetOpen(false);
  };

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setPendingFilters(EMPTY_FILTERS);
    setFilterSheetOpen(false);
  };

  const activeFilterCount = [
    filters.countryId,
    filters.universityId,
    filters.degreeLevel,
    filters.tuitionMin,
    filters.tuitionMax,
    filters.intakeId,
    filters.englishTest,
  ].filter(Boolean).length;

  return (
    <div className="space-y-4">
      {/* Sticky search bar */}
      <div className="sticky top-0 z-20 -mx-4 bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/75 md:static md:mx-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={filters.search}
              onChange={(e) => updateFilters({ search: e.target.value })}
              placeholder="Search by course, university, or country…"
              className="pl-9"
              aria-label="Search courses"
            />
            {filters.search && (
              <button
                type="button"
                onClick={() => updateFilters({ search: "" })}
                className="absolute right-2 top-1.5 rounded p-1 text-muted-foreground hover:bg-muted"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={openFilterSheet}
            aria-label={`Open filters${activeFilterCount ? ` (${activeFilterCount} active)` : ""}`}
            className="relative shrink-0"
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden />
            {activeFilterCount > 0 && (
              <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <Label htmlFor="course-sort" className="text-xs text-muted-foreground">
            Sort by
          </Label>
          <Select
            id="course-sort"
            value={filters.sortBy}
            onChange={(e) =>
              updateFilters({
                sortBy: e.target.value as StudentCourseSort | "",
              })
            }
            className="h-8 w-auto text-xs"
          >
            <option value="">Default</option>
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Active filter chips */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {filters.countryId && (
            <FilterChip
              label={meta?.countries.find((c) => c.id === filters.countryId)?.name ?? "Country"}
              onRemove={() => updateFilters({ countryId: "" })}
            />
          )}
          {filters.universityId && (
            <FilterChip
              label={meta?.universities.find((u) => u.id === filters.universityId)?.name ?? "University"}
              onRemove={() => updateFilters({ universityId: "" })}
            />
          )}
          {filters.degreeLevel && (
            <FilterChip
              label={COURSE_DEGREE_LABELS[filters.degreeLevel as keyof typeof COURSE_DEGREE_LABELS] ?? filters.degreeLevel}
              onRemove={() => updateFilters({ degreeLevel: "" })}
            />
          )}
          {(filters.tuitionMin || filters.tuitionMax) && (
            <FilterChip
              label={`Tuition ${filters.tuitionMin ? `${filters.tuitionMin}` : "0"}–${filters.tuitionMax || "∞"}`}
              onRemove={() => updateFilters({ tuitionMin: "", tuitionMax: "" })}
            />
          )}
          {filters.intakeId && (
            <FilterChip
              label={meta?.intakes.find((i) => i.id === filters.intakeId)?.name ?? "Intake"}
              onRemove={() => updateFilters({ intakeId: "" })}
            />
          )}
          {filters.englishTest && (
            <FilterChip
              label={ENGLISH_TEST_OPTIONS.find((o) => o.value === filters.englishTest)?.label ?? "English test"}
              onRemove={() => updateFilters({ englishTest: "" })}
            />
          )}
          <button
            type="button"
            onClick={clearFilters}
            className="ml-auto shrink-0 text-xs text-muted-foreground hover:text-foreground"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Result count */}
      {pg && (
        <p className="text-xs text-muted-foreground">
          {pg.total === 0
            ? "No courses match your filters."
            : `${pg.total} course${pg.total === 1 ? "" : "s"}${
                pg.totalPages > 1 ? ` · page ${pg.page} of ${pg.totalPages}` : ""
              }`}
        </p>
      )}

      {/* Loading skeletons */}
      {isPending && (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="space-y-3 p-4">
                <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
                <div className="flex gap-2">
                  <div className="h-6 w-16 animate-pulse rounded-full bg-muted" />
                  <div className="h-6 w-20 animate-pulse rounded-full bg-muted" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isPending && rows.length === 0 && !isError && (
        <EmptyState
          title="No courses found"
          description={
            activeFilterCount
              ? "Try clearing filters or widening your tuition range."
              : "Your counselor hasn't published any courses yet."
          }
          action={
            activeFilterCount ? (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      )}

      {/* Error state */}
      {isError && (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {(error as Error).message}
          <Button variant="outline" size="sm" className="ml-3" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      )}

      {/* Cards grid */}
      {!isPending && rows.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {rows.map((c) => (
            <CourseCard
              key={c.id}
              course={c}
              basePath={basePath}
              universityName={meta?.universities.find((u) => u.id === c.university.id)?.name ?? c.university.name}
              onRequestCounseling={() => setCounselingFor(c)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pg && pg.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            disabled={pg.page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden /> Prev
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {pg.page} of {pg.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={pg.page >= pg.totalPages}
            onClick={() => setPage((p) => Math.min(pg.totalPages, p + 1))}
            aria-label="Next page"
          >
            Next <ChevronRight className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      )}

      {/* Filter bottom sheet */}
      <Drawer
        open={filterSheetOpen}
        onOpenChange={setFilterSheetOpen}
        title="Filter courses"
      >
        <div className="space-y-5">
          <FilterGroup label="Country">
            <Select
              value={pendingFilters.countryId}
              onChange={(e) =>
                setPendingFilters((f) => ({ ...f, countryId: e.target.value, universityId: "" }))
              }
            >
              <option value="">All countries</option>
              {(meta?.countries ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.flag ? `${c.flag} ` : ""}
                  {c.name}
                </option>
              ))}
            </Select>
          </FilterGroup>

          <FilterGroup label="University">
            <Select
              value={pendingFilters.universityId}
              onChange={(e) =>
                setPendingFilters((f) => ({ ...f, universityId: e.target.value }))
              }
            >
              <option value="">All universities</option>
              {(meta?.universities ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </FilterGroup>

          <FilterGroup label="Degree level">
            <Select
              value={pendingFilters.degreeLevel}
              onChange={(e) =>
                setPendingFilters((f) => ({ ...f, degreeLevel: e.target.value }))
              }
            >
              <option value="">All levels</option>
              {(meta?.degreeLevels ?? []).map((d) => (
                <option key={d} value={d}>
                  {COURSE_DEGREE_LABELS[d as keyof typeof COURSE_DEGREE_LABELS] ?? d}
                </option>
              ))}
            </Select>
          </FilterGroup>

          <FilterGroup
            label="Tuition range"
            hint={
              meta?.tuitionMin != null && meta?.tuitionMax != null
                ? `Available range: ${formatTuitionFee(meta.tuitionMin)} – ${formatTuitionFee(meta.tuitionMax)}`
                : undefined
            }
          >
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                value={pendingFilters.tuitionMin}
                onChange={(e) =>
                  setPendingFilters((f) => ({ ...f, tuitionMin: e.target.value }))
                }
                placeholder="Min"
                aria-label="Minimum tuition"
              />
              <span className="text-muted-foreground">–</span>
              <Input
                type="number"
                min={0}
                value={pendingFilters.tuitionMax}
                onChange={(e) =>
                  setPendingFilters((f) => ({ ...f, tuitionMax: e.target.value }))
                }
                placeholder="Max"
                aria-label="Maximum tuition"
              />
            </div>
          </FilterGroup>

          <FilterGroup label="Intake">
            <Select
              value={pendingFilters.intakeId}
              onChange={(e) =>
                setPendingFilters((f) => ({ ...f, intakeId: e.target.value }))
              }
            >
              <option value="">All intakes</option>
              {(meta?.intakes ?? []).map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} — {i.courseName} ({i.universityName})
                </option>
              ))}
            </Select>
          </FilterGroup>

          <FilterGroup
            label="English requirement"
            hint="Filter to courses that publish a specific English-test requirement."
          >
            <Select
              value={pendingFilters.englishTest}
              onChange={(e) =>
                setPendingFilters((f) => ({ ...f, englishTest: e.target.value }))
              }
            >
              {ENGLISH_TEST_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </FilterGroup>

          <div className="flex justify-between gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear
            </Button>
            <Button onClick={applyFilters}>Show results</Button>
          </div>
        </div>
      </Drawer>

      {/* Counseling request dialog */}
      {counselingFor && (
        <CourseCounselingDialog
          course={counselingFor}
          onClose={() => setCounselingFor(null)}
          onDone={() => {
            toast({
              title: "Request sent",
              description: `Your counselor will reach out about ${counselingFor.university.name}.`,
              variant: "success",
            });
          }}
        />
      )}
    </div>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove filter ${label}`}
        className="grid h-4 w-4 place-items-center rounded-full hover:bg-primary/20"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

function FilterGroup({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function CourseCard({
  course,
  basePath,
  universityName,
  onRequestCounseling,
}: {
  course: Course;
  basePath: string;
  universityName: string;
  onRequestCounseling: () => void;
}) {
  const degreeLabel =
    COURSE_DEGREE_LABELS[course.degreeLevel as keyof typeof COURSE_DEGREE_LABELS] ??
    course.degreeLevel;

  return (
    <Card className="flex flex-col overflow-hidden">
      <CardContent className="flex flex-1 flex-col gap-3 p-4">
        {/* Header: degree chip + course name */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              <GraduationCap className="h-3 w-3" aria-hidden />
              {degreeLabel}
            </span>
            <Link
              href={`${basePath}/${course.id}`}
              className="mt-1.5 block font-semibold leading-tight hover:text-primary hover:underline"
            >
              {course.name}
            </Link>
          </div>
        </div>

        {/* University + country */}
        <Link
          href={`/student/universities/${course.university.id}`}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
        >
          <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="truncate">{universityName}</span>
        </Link>
        <p className="-mt-1.5 flex items-center gap-1.5 pl-5 text-xs text-muted-foreground">
          <Globe className="h-3 w-3 shrink-0" aria-hidden />
          {course.university.country.flag ? `${course.university.country.flag} ` : ""}
          {course.university.country.name}
        </p>

        {/* Chips: tuition + duration + intake status */}
        <div className="flex flex-wrap gap-1.5">
          {course.tuitionFee != null && (
            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
              {formatTuitionFee(course.tuitionFee, course.currency)}
            </span>
          )}
          {course.duration && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
              <Clock className="h-3 w-3" aria-hidden />
              {course.duration}
            </span>
          )}
          {course.hasOpenIntake ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
              <BookOpen className="h-3 w-3" aria-hidden />
              Open · {course.activeIntakeCount} intake{course.activeIntakeCount === 1 ? "" : "s"}
            </span>
          ) : course.activeIntakeCount > 0 ? (
            <span className="inline-flex items-center rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning">
              {course.activeIntakeCount} intake{course.activeIntakeCount === 1 ? "" : "s"} (closed)
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              No intakes
            </span>
          )}
        </div>

        {/* English requirements preview (first 2) */}
        {course.englishRequirementsList.length > 0 && (
          <div className="space-y-1">
            {course.englishRequirementsList.slice(0, 2).map((er) => (
              <p key={er.test} className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{er.label}:</span> {er.value}
              </p>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="mt-auto flex items-center gap-2 pt-2">
          <Link href={`${basePath}/${course.id}`} className="flex-1">
            <Button size="sm" className="w-full">
              View details
            </Button>
          </Link>
          <Button size="sm" variant="outline" onClick={onRequestCounseling}>
            Request counseling
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CourseCounselingDialog({
  course,
  onClose,
  onDone,
}: {
  course: Course;
  onClose: () => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await apiFetch("/api/student/counseling-requests", {
        method: "POST",
        json: {
          universityId: course.university.id,
          courseId: course.id,
          message: message.trim() || undefined,
        },
      });
      onDone();
      onClose();
    } catch (err) {
      toast({ title: "Failed", description: (err as Error).message, variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        title={`Request counseling — ${course.name}`}
        description={`At ${course.university.name}`}
        className="max-w-md"
      >
        <form onSubmit={submit} className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Tell your counselor what you&apos;d like to discuss about this course. They&apos;ll
            see the course and your student profile.
          </p>
          <textarea
            autoFocus
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="I'm interested in this course — can we discuss entry requirements and tuition?"
            className="min-h-[100px] w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
            aria-label="Message to counselor"
            maxLength={2000}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Sending…" : "Send request"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
