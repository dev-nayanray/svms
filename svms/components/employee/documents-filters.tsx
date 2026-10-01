"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Filter } from "lucide-react";
import { Button, Input, Select, Label, Badge } from "@/components/ui";
import { DOCUMENT_STATUSES, DOCUMENT_TYPES } from "@/lib/constants/documents";

const STATUS_OPTIONS = DOCUMENT_STATUSES;
const TYPE_OPTIONS = DOCUMENT_TYPES;

export function DocumentFilters({
  initialSearch,
  initialFilters,
}: {
  initialSearch?: string;
  initialFilters: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(initialSearch ?? "");
  const [filters, setFilters] = useState(initialFilters);

  const submitFilters = (next: Record<string, string | undefined>) => {
    const params = new URLSearchParams(sp.toString());
    ["status", "documentType", "studentId", "applicationId", "expiryFrom", "expiryTo", "uploadedFrom", "uploadedTo"].forEach((k) => params.delete(k));
    for (const [k, v] of Object.entries(next)) {
      if (v) params.set(k, v);
    }
    if (search) params.set("search", search);
    else params.delete("search");
    router.push(`/employee/documents?${params.toString()}`);
  };

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <form
          className="flex min-w-[200px] flex-1 items-center gap-2"
          action={() => {
            const params = new URLSearchParams(sp.toString());
            if (search) params.set("search", search);
            else params.delete("search");
            router.push(`/employee/documents?${params.toString()}`);
          }}
        >
          <Input
            type="search"
            placeholder="Search documents…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9"
            aria-label="Search documents"
          />
          <Button type="submit" size="sm">Search</Button>
        </form>
        <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
          <Filter className="h-3.5 w-3.5" aria-hidden /> Filters
          {activeFilterCount > 0 && <Badge tone="info">{activeFilterCount}</Badge>}
        </Button>
      </div>

      {open && (
        <div className="rounded-md border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold">Filters</p>
            <button onClick={() => { setFilters({}); submitFilters({}); setOpen(false); }} className="text-xs text-muted-foreground hover:text-foreground">
              Clear all
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FilterField label="Status">
              <Select value={filters.status ?? ""} onChange={(e) => setFilters({ ...filters, status: e.target.value || undefined })}>
                <option value="">All</option>
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </FilterField>
            <FilterField label="Document type">
              <Select value={filters.documentType ?? ""} onChange={(e) => setFilters({ ...filters, documentType: e.target.value || undefined })}>
                <option value="">All</option>
                {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            </FilterField>
            <FilterField label="Student ID">
              <Input value={filters.studentId ?? ""} onChange={(e) => setFilters({ ...filters, studentId: e.target.value || undefined })} placeholder="stu-…" />
            </FilterField>
            <FilterField label="Application ID">
              <Input value={filters.applicationId ?? ""} onChange={(e) => setFilters({ ...filters, applicationId: e.target.value || undefined })} placeholder="app-…" />
            </FilterField>
            <FilterField label="Expiry from">
              <Input type="date" value={filters.expiryFrom ?? ""} onChange={(e) => setFilters({ ...filters, expiryFrom: e.target.value || undefined })} />
            </FilterField>
            <FilterField label="Expiry to">
              <Input type="date" value={filters.expiryTo ?? ""} onChange={(e) => setFilters({ ...filters, expiryTo: e.target.value || undefined })} />
            </FilterField>
            <FilterField label="Uploaded from">
              <Input type="date" value={filters.uploadedFrom ?? ""} onChange={(e) => setFilters({ ...filters, uploadedFrom: e.target.value || undefined })} />
            </FilterField>
            <FilterField label="Uploaded to">
              <Input type="date" value={filters.uploadedTo ?? ""} onChange={(e) => setFilters({ ...filters, uploadedTo: e.target.value || undefined })} />
            </FilterField>
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

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
