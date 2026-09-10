"use client";

import { useMemo, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { apiFetch, type Paged } from "@/lib/api-client";
import { Button, Input, Select } from "@/components/ui";
import { Skeleton } from "@/components/ui/overlays";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  ChevronUp,
  Columns3,
  Search,
} from "lucide-react";

export type Column<T> = {
  key: string;
  header: string;
  sortable?: boolean;
  className?: string;
  render: (row: T) => React.ReactNode;
};

export type RowAction<T> = {
  label: string;
  onClick: (row: T) => void;
  destructive?: boolean;
};

export function DataTable<T extends { id: string }>({
  endpoint,
  columns,
  rowActions,
  searchPlaceholder = "Search…",
  filters,
  toolbar,
  staticParams,
  emptyMessage = "No records found.",
}: {
  endpoint: string;
  columns: Column<T>[];
  rowActions?: RowAction<T>[];
  searchPlaceholder?: string;
  filters?: { key: string; label: string; options: { value: string; label: string }[] }[];
  toolbar?: React.ReactNode;
  /** Extra query params always applied (e.g. date-range filters). */
  staticParams?: Record<string, string>;
  emptyMessage?: string;
}) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [hiddenCols, setHiddenCols] = useState<string[]>([]);
  const [colsOpen, setColsOpen] = useState(false);

  const query = useMemo(() => {
    const sp = new URLSearchParams({ page: String(page), pageSize: "10", ...(staticParams ?? {}) });
    if (search) sp.set("search", search);
    if (sortKey) {
      sp.set("sortBy", sortKey);
      sp.set("sortOrder", sortOrder);
    }
    for (const [k, v] of Object.entries(filterValues)) if (v) sp.set(k, v);
    return sp.toString();
  }, [page, search, sortKey, sortOrder, filterValues, staticParams]);

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: [endpoint, query],
    queryFn: () => apiFetch<Paged<T>>(`${endpoint}?${query}`),
    placeholderData: keepPreviousData,
  });

  const rows = data?.data ?? [];
  const pg = data?.pagination;
  const visibleColumns = columns.filter((c) => !hiddenCols.includes(c.key));

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={searchPlaceholder}
            className="pl-8"
            aria-label={searchPlaceholder}
          />
        </div>
        {filters?.map((f) => (
          <Select
            key={f.key}
            value={filterValues[f.key] ?? ""}
            aria-label={f.label}
            onChange={(e) => {
              setFilterValues((prev) => ({ ...prev, [f.key]: e.target.value }));
              setPage(1);
            }}
            className="w-40"
          >
            <option value="">{f.label}</option>
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        ))}
        <div className="relative">
          <Button variant="outline" size="sm" onClick={() => setColsOpen(!colsOpen)} aria-expanded={colsOpen}>
            <Columns3 className="h-4 w-4" aria-hidden /> Columns
          </Button>
          {colsOpen && (
            <div className="absolute right-0 z-30 mt-1 w-48 rounded-md border border-border bg-card p-2 shadow-lg">
              {columns.map((c) => (
                <label key={c.key} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted">
                  <input
                    type="checkbox"
                    checked={!hiddenCols.includes(c.key)}
                    onChange={() =>
                      setHiddenCols((prev) =>
                        prev.includes(c.key) ? prev.filter((k) => k !== c.key) : [...prev, c.key]
                      )
                    }
                  />
                  {c.header}
                </label>
              ))}
            </div>
          )}
        </div>
        {toolbar}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-left text-xs font-medium text-muted-foreground">
            <tr>
              {visibleColumns.map((c) => (
                <th key={c.key} className={cn("whitespace-nowrap px-3 py-2.5 font-medium", c.className)}>
                  {c.sortable ? (
                    <button
                      className="inline-flex items-center gap-1 hover:text-foreground"
                      onClick={() => toggleSort(c.key)}
                      aria-label={`Sort by ${c.header}`}
                    >
                      {c.header}
                      {sortKey === c.key ? (
                        sortOrder === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                      ) : (
                        <ChevronsUpDown className="h-3 w-3 opacity-50" />
                      )}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              ))}
              {rowActions && rowActions.length > 0 && <th className="px-4 py-2.5 text-right font-medium">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isPending &&
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  {visibleColumns.map((c) => (
                    <td key={c.key} className="px-3 py-2.5">
                      <Skeleton className="h-4 w-full" />
                    </td>
                  ))}
                  {rowActions && <td />}
                </tr>
              ))}
            {!isPending && rows.length === 0 && (
              <tr>
                <td colSpan={visibleColumns.length + (rowActions ? 1 : 0)} className="px-3 py-12 text-center text-sm text-muted-foreground">
                  {emptyMessage}
                </td>
              </tr>
            )}
            {!isPending &&
              rows.map((row) => (
                <tr key={row.id} className="border-b border-border last:border-0 transition-colors hover:bg-muted/30">
                  {visibleColumns.map((c) => (
                    <td key={c.key} className={cn("px-3 py-2.5", c.className)}>
                      {c.render(row)}
                    </td>
                  ))}
                  {rowActions && rowActions.length > 0 && (
                    <td className="px-3 py-2.5 text-right">
                      <div className="inline-flex gap-0.5">
                        {rowActions.map((a) => (
                          <button
                            key={a.label}
                            onClick={() => a.onClick(row)}
                            className={cn(
                              "rounded-md border border-border px-2 py-1 text-xs font-medium transition-colors hover:bg-muted",
                              a.destructive && "text-destructive hover:bg-destructive/10 border-destructive/20",
                            )}
                          >
                            {a.label}
                          </button>
                        ))}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Error */}
      {isError && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {(error as Error).message}
          <Button variant="outline" size="sm" className="ml-3" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      )}

      {/* Pagination */}
      {pg && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {pg.total} record{pg.total === 1 ? "" : "s"} · page {pg.page} of {pg.totalPages}
          </span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={pg.page <= 1} onClick={() => setPage(page - 1)} aria-label="Previous page">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={pg.page >= pg.totalPages} onClick={() => setPage(page + 1)} aria-label="Next page">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
