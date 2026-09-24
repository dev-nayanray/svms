"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Columns3, Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, Input, Select, Label, Badge } from "@/components/ui";
import { APPLICATION_STAGES } from "@/lib/services/employee-dashboard";

/**
 * Students filter panel — client component so the user can toggle filters
 * without a full page reload. On apply, we push the filter values into the
 * URL so the page server-side re-renders with the new where-clause.
 *
 * The component is intentionally dumb: it reads the current query params on
 * mount, lets the user edit them, and on submit pushes a single URL update.
 * The server is the source of truth for the data.
 */

const COUNTRY_OPTIONS = [
  "Bangladesh", "India", "Pakistan", "Nepal", "Sri Lanka",
  "United States", "United Kingdom", "Germany", "France", "Italy",
  "Spain", "Netherlands", "Sweden", "Finland", "Ireland",
];

const VISA_STAGE_OPTIONS = ["PREPARATION", "SUBMITTED", "BIOMETRICS", "INTERVIEW", "PROCESSING", "APPROVED", "REFUSED"];

const PRIORITY_OPTIONS = ["LOW", "MEDIUM", "HIGH", "URGENT"];

const DENSITY_LABELS: Record<"comfortable" | "compact", string> = {
  comfortable: "Comfortable",
  compact: "Compact",
};

const COLUMN_OPTIONS = [
  { key: "name", label: "Name" },
  { key: "applicationNumber", label: "Application #" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "country", label: "Country" },
  { key: "university", label: "University" },
  { key: "stage", label: "Stage" },
  { key: "applicationStatus", label: "App status" },
  { key: "visaStatus", label: "Visa status" },
  { key: "nextDeadline", label: "Next deadline" },
  { key: "assignedDate", label: "Assigned date" },
  { key: "priority", label: "Priority" },
];

export function StudentsFilters({
  initialSearch,
  initialFilters,
  initialColumns,
  initialDensity,
}: {
  initialSearch?: string;
  initialFilters: Record<string, string | undefined>;
  initialColumns: string[];
  initialDensity: "comfortable" | "compact";
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [open, setOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [search, setSearch] = useState(initialSearch ?? "");
  const [filters, setFilters] = useState(initialFilters);
  const [columns, setColumns] = useState<Set<string>>(new Set(initialColumns));
  const [density, setDensity] = useState<"comfortable" | "compact">(initialDensity);

  const submitFilters = (next: Record<string, string | undefined>) => {
    const params = new URLSearchParams(sp.toString());
    // Clear existing filter keys first so removed values don't linger.
    ["stage", "country", "universityId", "visaStage", "priority", "status", "archived", "createdFrom", "createdTo"].forEach((k) => params.delete(k));
    for (const [k, v] of Object.entries(next)) {
      if (v) params.set(k, v);
    }
    if (search) params.set("search", search);
    else params.delete("search");
    router.push(`/employee/students?${params.toString()}`);
  };

  const toggleColumn = (key: string) => {
    const next = new Set(columns);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setColumns(next);
    const params = new URLSearchParams(sp.toString());
    params.set("columns", Array.from(next).join(","));
    router.push(`/employee/students?${params.toString()}`);
  };

  const changeDensity = (next: "comfortable" | "compact") => {
    setDensity(next);
    const params = new URLSearchParams(sp.toString());
    params.set("density", next);
    router.push(`/employee/students?${params.toString()}`);
  };

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <div className="space-y-3">
      {/* Search + filter button + density + column visibility */}
      <div className="flex flex-wrap items-center gap-2">
        <form
          className="flex min-w-[200px] flex-1 items-center gap-2"
          action={() => {
            const params = new URLSearchParams(sp.toString());
            if (search) params.set("search", search);
            else params.delete("search");
            router.push(`/employee/students?${params.toString()}`);
          }}
        >
          <Input
            type="search"
            placeholder="Search by name, ID, email, phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9"
            aria-label="Search students"
          />
          <Button type="submit" size="sm">Search</Button>
        </form>

        <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
          <Filter className="h-3.5 w-3.5" aria-hidden /> Filters
          {activeFilterCount > 0 && <Badge tone="info">{activeFilterCount}</Badge>}
        </Button>

        <Button variant="outline" size="sm" onClick={() => setColumnsOpen((v) => !v)}>
          <Columns3 className="h-3.5 w-3.5" aria-hidden /> Columns
        </Button>

        <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
          {(["comfortable", "compact"] as const).map((d) => (
            <button
              key={d}
              onClick={() => changeDensity(d)}
              aria-pressed={density === d}
              className={cn(
                "rounded px-2 py-1 text-xs font-medium transition-colors",
                density === d ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {DENSITY_LABELS[d]}
            </button>
          ))}
        </div>
      </div>

      {/* Filter panel */}
      {open && (
        <div className="rounded-md border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold">Filters</p>
            <button
              onClick={() => {
                setFilters({});
                submitFilters({});
                setOpen(false);
              }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear all
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FilterField label="Stage">
              <Select
                value={filters.stage ?? ""}
                onChange={(e) => setFilters({ ...filters, stage: e.target.value || undefined })}
              >
                <option value="">All</option>
                {APPLICATION_STAGES.map((s) => (
                  <option key={s} value={s}>{s.replace(/_/g, " ").toLowerCase()}</option>
                ))}
              </Select>
            </FilterField>
            <FilterField label="Country">
              <Select
                value={filters.country ?? ""}
                onChange={(e) => setFilters({ ...filters, country: e.target.value || undefined })}
              >
                <option value="">All</option>
                {COUNTRY_OPTIONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </FilterField>
            <FilterField label="Visa stage">
              <Select
                value={filters.visaStage ?? ""}
                onChange={(e) => setFilters({ ...filters, visaStage: e.target.value || undefined })}
              >
                <option value="">All</option>
                {VISA_STAGE_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Select>
            </FilterField>
            <FilterField label="Priority">
              <Select
                value={filters.priority ?? ""}
                onChange={(e) => setFilters({ ...filters, priority: e.target.value || undefined })}
              >
                <option value="">All</option>
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </Select>
            </FilterField>
            <FilterField label="Status">
              <Select
                value={filters.status ?? ""}
                onChange={(e) => setFilters({ ...filters, status: e.target.value || undefined })}
              >
                <option value="">Active</option>
                <option value="ACTIVE">Active only</option>
                <option value="INACTIVE">Inactive</option>
                <option value="SUSPENDED">Suspended</option>
                <option value="PENDING">Pending</option>
              </Select>
            </FilterField>
            <FilterField label="Created from">
              <Input
                type="date"
                value={filters.createdFrom ?? ""}
                onChange={(e) => setFilters({ ...filters, createdFrom: e.target.value || undefined })}
              />
            </FilterField>
            <FilterField label="Created to">
              <Input
                type="date"
                value={filters.createdTo ?? ""}
                onChange={(e) => setFilters({ ...filters, createdTo: e.target.value || undefined })}
              />
            </FilterField>
            <FilterField label="Archived">
              <Select
                value={filters.archived ?? ""}
                onChange={(e) => setFilters({ ...filters, archived: e.target.value || undefined })}
              >
                <option value="">No</option>
                <option value="true">Yes — show archived only</option>
              </Select>
            </FilterField>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              size="sm"
              onClick={() => {
                submitFilters(filters);
                setOpen(false);
              }}
            >
              Apply filters
            </Button>
          </div>
        </div>
      )}

      {/* Column visibility panel */}
      {columnsOpen && (
        <div className="rounded-md border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold">Visible columns</p>
            <button onClick={() => setColumnsOpen(false)} className="text-muted-foreground hover:text-foreground" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {COLUMN_OPTIONS.map((col) => (
              <label key={col.key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={columns.has(col.key)}
                  onChange={() => toggleColumn(col.key)}
                  className="h-4 w-4 rounded border-input"
                />
                {col.label}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
