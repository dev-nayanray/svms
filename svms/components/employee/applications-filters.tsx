"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Filter, LayoutList, Columns3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, Input, Select, Label, Badge } from "@/components/ui";
import { APPLICATION_STAGES } from "@/lib/services/employee-dashboard";

const PRIORITY_OPTIONS = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const STATUS_OPTIONS = ["NEW", "IN_PROGRESS", "COMPLETED", "ON_HOLD", "CANCELLED"];

export function ApplicationFilters({
  initialSearch,
  initialFilters,
  countries,
  universities,
  courses,
  intakes,
  employees,
  view,
}: {
  initialSearch?: string;
  initialFilters: Record<string, string | undefined>;
  countries: { id: string; name: string }[];
  universities: { id: string; name: string }[];
  courses: { id: string; name: string }[];
  intakes: { id: string; name: string }[];
  employees: { id: string; name: string }[];
  view: "list" | "kanban";
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(initialSearch ?? "");
  const [filters, setFilters] = useState(initialFilters);

  const submitFilters = (next: Record<string, string | undefined>) => {
    const params = new URLSearchParams(sp.toString());
    ["stage", "status", "priority", "countryId", "universityId", "courseId", "intakeId", "assignedEmployeeId", "deadlineFrom", "deadlineTo", "archived"].forEach((k) => params.delete(k));
    for (const [k, v] of Object.entries(next)) {
      if (v) params.set(k, v);
    }
    if (search) params.set("search", search);
    else params.delete("search");
    params.set("view", view);
    router.push(`/employee/applications?${params.toString()}`);
  };

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <form
          className="flex min-w-[200px] flex-1 items-center gap-2"
          action={() => {
            const params = new URLSearchParams(sp.toString());
            if (search) params.set("search", search);
            else params.delete("search");
            params.set("view", view);
            router.push(`/employee/applications?${params.toString()}`);
          }}
        >
          <Input
            type="search"
            placeholder="Search application #, student…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9"
            aria-label="Search applications"
          />
          <Button type="submit" size="sm">Search</Button>
        </form>

        {/* Filter button */}
        <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
          <Filter className="h-3.5 w-3.5" aria-hidden /> Filters
          {activeFilterCount > 0 && <Badge tone="info">{activeFilterCount}</Badge>}
        </Button>

        {/* View toggle */}
        <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
          <Link
            href={buildViewUrl(sp.toString(), "list")}
            className={cn(
              "flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors",
              view === "list" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <LayoutList className="h-3.5 w-3.5" aria-hidden /> List
          </Link>
          <Link
            href={buildViewUrl(sp.toString(), "kanban")}
            className={cn(
              "flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors",
              view === "kanban" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Columns3 className="h-3.5 w-3.5" aria-hidden /> Kanban
          </Link>
        </div>
      </div>

      {/* Filter panel */}
      {open && (
        <div className="rounded-md border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold">Filters</p>
            <button
              onClick={() => { setFilters({}); submitFilters({}); setOpen(false); }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear all
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {view === "list" && (
              <FilterField label="Stage">
                <Select value={filters.stage ?? ""} onChange={(e) => setFilters({ ...filters, stage: e.target.value || undefined })}>
                  <option value="">All</option>
                  {APPLICATION_STAGES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ").toLowerCase()}</option>)}
                </Select>
              </FilterField>
            )}
            <FilterField label="Status">
              <Select value={filters.status ?? ""} onChange={(e) => setFilters({ ...filters, status: e.target.value || undefined })}>
                <option value="">All</option>
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </FilterField>
            <FilterField label="Priority">
              <Select value={filters.priority ?? ""} onChange={(e) => setFilters({ ...filters, priority: e.target.value || undefined })}>
                <option value="">All</option>
                {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
              </Select>
            </FilterField>
            <FilterField label="Country">
              <Select value={filters.countryId ?? ""} onChange={(e) => setFilters({ ...filters, countryId: e.target.value || undefined })}>
                <option value="">All</option>
                {countries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </FilterField>
            <FilterField label="University">
              <Select value={filters.universityId ?? ""} onChange={(e) => setFilters({ ...filters, universityId: e.target.value || undefined })}>
                <option value="">All</option>
                {universities.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </Select>
            </FilterField>
            <FilterField label="Course">
              <Select value={filters.courseId ?? ""} onChange={(e) => setFilters({ ...filters, courseId: e.target.value || undefined })}>
                <option value="">All</option>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </FilterField>
            <FilterField label="Intake">
              <Select value={filters.intakeId ?? ""} onChange={(e) => setFilters({ ...filters, intakeId: e.target.value || undefined })}>
                <option value="">All</option>
                {intakes.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </Select>
            </FilterField>
            <FilterField label="Assigned employee">
              <Select value={filters.assignedEmployeeId ?? ""} onChange={(e) => setFilters({ ...filters, assignedEmployeeId: e.target.value || undefined })}>
                <option value="">All</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </Select>
            </FilterField>
            <FilterField label="Deadline from">
              <Input type="date" value={filters.deadlineFrom ?? ""} onChange={(e) => setFilters({ ...filters, deadlineFrom: e.target.value || undefined })} />
            </FilterField>
            <FilterField label="Deadline to">
              <Input type="date" value={filters.deadlineTo ?? ""} onChange={(e) => setFilters({ ...filters, deadlineTo: e.target.value || undefined })} />
            </FilterField>
            <FilterField label="Archived">
              <Select value={filters.archived ?? ""} onChange={(e) => setFilters({ ...filters, archived: e.target.value || undefined })}>
                <option value="">No (active only)</option>
                <option value="true">Yes — archived only</option>
              </Select>
            </FilterField>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={() => { submitFilters(filters); setOpen(false); }}>Apply filters</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function buildViewUrl(currentQuery: string, view: "list" | "kanban"): string {
  const params = new URLSearchParams(currentQuery);
  params.set("view", view);
  return `/employee/applications?${params.toString()}`;
}

// Need Link import
import Link from "next/link";

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
