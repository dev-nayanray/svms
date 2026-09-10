"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  formatApplicationFee,
  rankingTier,
  resolveUniversityLogo,
  universityInitials,
  type StudentUniversitySort,
} from "@/lib/constants/universities";
import {
  ChevronLeft,
  ChevronRight,
  Globe,
  Heart,
  ExternalLink,
  SlidersHorizontal,
  Search,
  Star,
  Bookmark,
  X,
} from "lucide-react";

type Country = { id: string; name: string; flag: string | null };
type University = {
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
  country: { id: string; name: string; flag: string | null };
  courseCount: number;
  isFavorite: boolean;
};

type Meta = {
  countries: Country[];
  cities: string[];
  maxRanking: number | null;
};

type Filters = {
  search: string;
  countryId: string;
  city: string;
  rankingMax: string;
  favoriteOnly: boolean;
  sortBy: StudentUniversitySort | "";
};

const EMPTY_FILTERS: Filters = {
  search: "",
  countryId: "",
  city: "",
  rankingMax: "",
  favoriteOnly: false,
  sortBy: "",
};

const SORT_OPTIONS: { value: StudentUniversitySort; label: string }[] = [
  { value: "name", label: "Name (A→Z)" },
  { value: "ranking", label: "Top ranked" },
  { value: "applicationFee", label: "Highest fee" },
  { value: "createdAt", label: "Newest" },
];

/**
 * Student-facing mobile-first university discovery list.
 *
 * Layout:
 *  - sticky search bar with filter-sheet trigger and sort dropdown
 *  - active filter chips (one per applied filter, removable inline)
 *  - vertically-stacked card list (mobile) → 2-col grid on sm+ screens
 *  - each card: logo/initials avatar, name, country+city, ranking chip,
 *    application fee, course count, description excerpt, favorite heart,
 *    "View details" + "Save" actions
 *  - server-side pagination via prev/next buttons
 *
 * All filters + search hit the server — no client-side filtering of the
 * result set — so we never leak archived or inactive universities even
 * if the network response is stale.
 */
export function StudentUniversitiesList({ basePath }: { basePath: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [pendingFilters, setPendingFilters] = useState<Filters>(EMPTY_FILTERS);
  const [counselingFor, setCounselingFor] = useState<University | null>(null);

  // Pull filter metadata once on mount.
  const { data: meta } = useQuery({
    queryKey: ["/api/student/universities/meta"],
    queryFn: () => apiFetch<Meta>("/api/student/universities/meta"),
    staleTime: 5 * 60_000,
  });

  const queryString = useMemo(() => {
    const sp = new URLSearchParams({ page: String(page), pageSize: "12" });
    if (filters.search) sp.set("search", filters.search);
    if (filters.countryId) sp.set("countryId", filters.countryId);
    if (filters.city) sp.set("city", filters.city);
    if (filters.rankingMax) sp.set("rankingMax", filters.rankingMax);
    if (filters.favoriteOnly) sp.set("favoriteOnly", "true");
    if (filters.sortBy) sp.set("sortBy", filters.sortBy);
    return sp.toString();
  }, [page, filters]);

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["/api/student/universities", queryString],
    queryFn: () =>
      apiFetch<Paged<University>>(`/api/student/universities?${queryString}`),
    placeholderData: (prev) => prev,
  });

  const rows = data?.data ?? [];
  const pg = data?.pagination;

  // Update filters AND reset to page 1 in one shot — avoids the
  // cascading-render pattern of resetting page inside an effect.
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
    filters.city,
    filters.rankingMax,
    filters.favoriteOnly ? "fav" : "",
    filters.sortBy,
  ].filter(Boolean).length;

  const toggleFavorite = async (u: University) => {
    // Optimistic local update via queryClient so the heart flips instantly.
    qc.setQueryData<Paged<University>>(
      ["/api/student/universities", queryString],
      (prev) =>
        prev
          ? {
              ...prev,
              data: prev.data.map((r) =>
                r.id === u.id ? { ...r, isFavorite: !r.isFavorite } : r,
              ),
            }
          : prev,
    );
    try {
      await apiFetch<{ isFavorite: boolean }>("/api/student/favorites", {
        method: "POST",
        json: { universityId: u.id },
      });
    } catch (err) {
      // Roll back on failure.
      qc.invalidateQueries({ queryKey: ["/api/student/universities"] });
      toast({ title: "Failed", description: (err as Error).message, variant: "error" });
    }
  };

  return (
    <div className="space-y-4">
      {/* Search bar — sticky on mobile so it survives scroll. */}
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
              placeholder="Search by name, country, or city…"
              className="pl-9"
              aria-label="Search universities"
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

        {/* Sort dropdown inline — students change sort often, so we don't hide it. */}
        <div className="mt-2 flex items-center gap-2">
          <Label htmlFor="sort" className="text-xs text-muted-foreground">
            Sort by
          </Label>
          <Select
            id="sort"
            value={filters.sortBy}
            onChange={(e) =>
              updateFilters({
                sortBy: e.target.value as StudentUniversitySort | "",
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

      {/* Active filter chips — horizontal scroll on mobile. */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {filters.countryId && (
            <FilterChip
              label={meta?.countries.find((c) => c.id === filters.countryId)?.name ?? "Country"}
              onRemove={() => updateFilters({ countryId: "" })}
            />
          )}
          {filters.city && (
            <FilterChip label={filters.city} onRemove={() => updateFilters({ city: "" })} />
          )}
          {filters.rankingMax && (
            <FilterChip
              label={`Ranking ≤ ${filters.rankingMax}`}
              onRemove={() => updateFilters({ rankingMax: "" })}
            />
          )}
          {filters.favoriteOnly && (
            <FilterChip
              label="Favorites only"
              onRemove={() => updateFilters({ favoriteOnly: false })}
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

      {/* Result count summary */}
      {pg && (
        <p className="text-xs text-muted-foreground">
          {pg.total === 0
            ? "No universities match your filters."
            : `${pg.total} universit${pg.total === 1 ? "y" : "ies"}${
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
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 animate-pulse rounded-lg bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
                  </div>
                </div>
                <div className="h-3 w-full animate-pulse rounded bg-muted" />
                <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isPending && rows.length === 0 && !isError && (
        <EmptyState
          title="No universities found"
          description={
            activeFilterCount
              ? "Try clearing filters or widening your search."
              : "Your counselor hasn't published any universities yet."
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

      {/* Cards grid — 1 column on mobile, 2 on sm+. */}
      {!isPending && rows.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {rows.map((u) => (
            <UniversityCard
              key={u.id}
              university={u}
              basePath={basePath}
              onToggleFavorite={() => toggleFavorite(u)}
              onRequestCounseling={() => setCounselingFor(u)}
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

      {/* Filter bottom sheet (mobile) / dialog (desktop) */}
      <Drawer
        open={filterSheetOpen}
        onOpenChange={setFilterSheetOpen}
        title="Filter universities"
      >
        <div className="space-y-5">
          <FilterGroup label="Country">
            <Select
              value={pendingFilters.countryId}
              onChange={(e) =>
                setPendingFilters((f) => ({ ...f, countryId: e.target.value, city: "" }))
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

          <FilterGroup label="City">
            <Select
              value={pendingFilters.city}
              onChange={(e) =>
                setPendingFilters((f) => ({ ...f, city: e.target.value }))
              }
              disabled={!pendingFilters.countryId && (meta?.cities.length ?? 0) === 0}
            >
              <option value="">All cities</option>
              {(meta?.cities ?? []).map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </Select>
          </FilterGroup>

          <FilterGroup
            label={`Top ranking ${meta?.maxRanking ? `(1–${meta.maxRanking})` : ""}`}
            hint="Show universities ranked at or above this number."
          >
            <Input
              type="number"
              min={1}
              max={meta?.maxRanking ?? undefined}
              value={pendingFilters.rankingMax}
              onChange={(e) =>
                setPendingFilters((f) => ({ ...f, rankingMax: e.target.value }))
              }
              placeholder="e.g. 100"
            />
          </FilterGroup>

          <FilterGroup label="Favorites">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={pendingFilters.favoriteOnly}
                onChange={(e) =>
                  setPendingFilters((f) => ({ ...f, favoriteOnly: e.target.checked }))
                }
              />
              Show only universities I&apos;ve saved
            </label>
          </FilterGroup>

          <div className="flex justify-between gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear
            </Button>
            <Button onClick={applyFilters}>
              Show results
            </Button>
          </div>
        </div>
      </Drawer>

      {/* Counseling request dialog */}
      {counselingFor && (
        <CounselingRequestDialog
          university={counselingFor}
          onClose={() => setCounselingFor(null)}
          onDone={() => {
            qc.invalidateQueries({ queryKey: ["/api/student/universities"] });
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

function UniversityCard({
  university,
  basePath,
  onToggleFavorite,
  onRequestCounseling,
}: {
  university: University;
  basePath: string;
  onToggleFavorite: () => void;
  onRequestCounseling: () => void;
}) {
  const logo = resolveUniversityLogo(university.logo);
  const tier = rankingTier(university.ranking);
  const location = [university.city, university.country.name]
    .filter(Boolean)
    .join(", ");

  return (
    <Card className="flex flex-col overflow-hidden">
      <CardContent className="flex flex-1 flex-col gap-3 p-4">
        {/* Header row: avatar + name + favorite */}
        <div className="flex items-start gap-3">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logo}
              alt={`${university.name} logo`}
              className="h-12 w-12 shrink-0 rounded-lg object-contain"
              loading="lazy"
            />
          ) : (
            <div
              className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-primary/10 text-sm font-semibold text-primary"
              aria-hidden
            >
              {universityInitials(university.name)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <Link
              href={`${basePath}/${university.id}`}
              className="block truncate font-semibold leading-tight hover:text-primary hover:underline"
            >
              {university.name}
            </Link>
            {location && (
              <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                <Globe className="h-3 w-3 shrink-0" aria-hidden />
                {location}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onToggleFavorite}
            aria-pressed={university.isFavorite}
            aria-label={university.isFavorite ? "Remove from favorites" : "Add to favorites"}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-primary"
          >
            <Heart
              className={university.isFavorite ? "h-4 w-4 fill-primary text-primary" : "h-4 w-4"}
              aria-hidden
            />
          </button>
        </div>

        {/* Chips row: ranking tier + course count */}
        <div className="flex flex-wrap gap-1.5">
          {university.ranking != null && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
              <Star className="h-3 w-3" aria-hidden />
              #{university.ranking}
              {tier === "top" && " · Top 50"}
              {tier === "leading" && " · Top 200"}
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            <Bookmark className="h-3 w-3" aria-hidden />
            {university.courseCount} course{university.courseCount === 1 ? "" : "s"}
          </span>
          {university.applicationFee != null && (
            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
              Fee {formatApplicationFee(university.applicationFee)}
            </span>
          )}
        </div>

        {/* Description excerpt */}
        {university.description && (
          <p className="line-clamp-3 text-sm text-muted-foreground">
            {university.description}
          </p>
        )}

        {/* Actions */}
        <div className="mt-auto flex items-center gap-2 pt-2">
          <Link
            href={`${basePath}/${university.id}`}
            className="flex-1"
          >
            <Button size="sm" className="w-full">
              View details
            </Button>
          </Link>
          <Button
            size="sm"
            variant="outline"
            onClick={onRequestCounseling}
            aria-label={`Request counseling for ${university.name}`}
          >
            Request counseling
          </Button>
        </div>

        {university.website && (
          <a
            href={university.website}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
          >
            <ExternalLink className="h-3 w-3" aria-hidden />
            {university.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
          </a>
        )}
      </CardContent>
    </Card>
  );
}

function CounselingRequestDialog({
  university,
  onClose,
  onDone,
}: {
  university: University;
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
        json: { universityId: university.id, message: message.trim() || undefined },
      });
      toast({
        title: "Request sent",
        description: `Your counselor will reach out about ${university.name}.`,
        variant: "success",
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
      <DialogContent title={`Request counseling — ${university.name}`} className="max-w-md">
        <form onSubmit={submit} className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Tell your counselor what you&apos;d like to discuss. They&apos;ll see the university
            and your student profile.
          </p>
          <textarea
            autoFocus
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="I'm interested in this university's MSc program — can we discuss entry requirements?"
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
