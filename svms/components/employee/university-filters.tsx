"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Filter, Search } from "lucide-react";
import { Button, Input, Select, Label, Badge } from "@/components/ui";

export function UniversityFilters({
  initialSearch,
  initialFilters,
  countries,
}: {
  initialSearch?: string;
  initialFilters: Record<string, string | undefined>;
  countries: { id: string; name: string }[];
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(initialSearch ?? "");
  const [filters, setFilters] = useState(initialFilters);

  const submitSearch = () => {
    const params = new URLSearchParams(sp.toString());
    if (search) params.set("search", search);
    else params.delete("search");
    router.push(`/employee/universities?${params.toString()}`);
  };

  const submitFilters = (next: Record<string, string | undefined>) => {
    const params = new URLSearchParams(sp.toString());
    ["countryId", "status", "rankingMax", "intakeAvailable"].forEach((k) => params.delete(k));
    for (const [k, v] of Object.entries(next)) {
      if (v) params.set(k, v);
    }
    router.push(`/employee/universities?${params.toString()}`);
  };

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-[200px] flex-1 items-center gap-2">
          <Input
            type="search"
            placeholder="Search by name, city, country, code…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submitSearch(); }}
            className="h-9"
            aria-label="Search universities"
          />
          <Button onClick={submitSearch} size="sm"><Search className="h-3.5 w-3.5" aria-hidden /> Search</Button>
        </div>
        <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
          <Filter className="h-3.5 w-3.5" aria-hidden /> Filters
          {activeFilterCount > 0 && <Badge tone="info">{activeFilterCount}</Badge>}
        </Button>
      </div>

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
            <div className="space-y-1">
              <Label className="text-xs">Country</Label>
              <Select value={filters.countryId ?? ""} onChange={(e) => setFilters({ ...filters, countryId: e.target.value || undefined })}>
                <option value="">All</option>
                {countries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select value={filters.status ?? ""} onChange={(e) => setFilters({ ...filters, status: e.target.value || undefined })}>
                <option value="">Active only</option>
                <option value="">All</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Max ranking</Label>
              <Input
                type="number"
                placeholder="e.g. 100"
                value={filters.rankingMax ?? ""}
                onChange={(e) => setFilters({ ...filters, rankingMax: e.target.value || undefined })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Intake availability</Label>
              <Select value={filters.intakeAvailable ?? ""} onChange={(e) => setFilters({ ...filters, intakeAvailable: e.target.value || undefined })}>
                <option value="">All</option>
                <option value="true">Has active intakes</option>
              </Select>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={() => { submitFilters(filters); setOpen(false); }}>Apply</Button>
          </div>
        </div>
      )}
    </div>
  );
}
