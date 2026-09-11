"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { SimpleBarChart, SimplePieChart } from "@/components/charts";
import { EmptyState } from "@/components/shared";
import { Button } from "@/components/ui";
import { apiFetch } from "@/lib/api-client";
import {
  REPORT_TYPES,
  REPORT_TYPE_LABELS,
  type ReportType,
  type ReportFilters,
  filtersToQueryString,
} from "@/lib/constants/reports";
import { Download, Printer } from "lucide-react";

type ReportData = {
  kpis?: Record<string, string | number>;
  charts?: Record<string, { name: string; value: number }[]>;
  table?: {
    headers: string[];
    rows: Record<string, unknown>[];
  };
};


/**
 * Admin Reports & Analytics — server-side aggregated analytics with
 * client-side rendering of KPIs, charts, and a data table.
 *
 * 7 report types: Students, Leads, Applications, Visa, Employees,
 * Finance, Documents. Each produces KPIs + charts + a table.
 *
 * Filters: date range, branch, employee, country, university, course,
 * intake, status.
 *
 * Export: CSV download (server-generated, Excel-ready with UTF-8 BOM).
 * Print: browser print dialog (layout is print-friendly).
 */
export function ReportsAdmin() {
  const [reportType, setReportType] = useState<ReportType>("applications");
  const [filters, setFilters] = useState<ReportFilters>({});

  // Build the API query string from the selected report type + filters
  const queryString = useMemo(() => {
    const sp = new URLSearchParams({ type: reportType });
    const filterQs = filtersToQueryString(filters);
    return filterQs ? `${sp.toString()}&${filterQs}` : sp.toString();
  }, [reportType, filters]);

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["/api/reports", queryString],
    queryFn: () => apiFetch<ReportData>(`/api/reports?${queryString}`),
    staleTime: 30_000,
  });

  const reportOptions = REPORT_TYPES.map((t) => ({
    value: t,
    label: REPORT_TYPE_LABELS[t],
  }));

  const updateFilter = (key: keyof ReportFilters, value: string) => {
    setFilters((prev) => {
      const next = { ...prev };
      if (value) {
        (next as Record<string, string>)[key] = value;
      } else {
        delete (next as Record<string, string>)[key];
      }
      return next;
    });
  };

  const exportCsv = () => {
    const qs = new URLSearchParams({ type: reportType });
    const filterQs = filtersToQueryString(filters);
    const fullQs = filterQs ? `${qs.toString()}&${filterQs}` : qs.toString();
    window.open(`/api/reports/export?${fullQs}`, "_blank");
  };

  const kpiEntries = data?.kpis
    ? Object.entries(data.kpis).map(([label, value]) => ({ label, value }))
    : [];
  const chartEntries = data?.charts ? Object.entries(data.charts) : [];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Reports & Analytics</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="h-4 w-4" aria-hidden /> Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4" aria-hidden /> Print
          </Button>
        </div>
      </div>

      {/* Report type selector */}
      <div className="flex flex-wrap gap-2">
        {reportOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setReportType(opt.value as ReportType)}
            className={
              "rounded-full px-3 py-1.5 text-xs font-medium transition-colors " +
              (reportType === opt.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/70")
            }
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 text-sm">
        <div className="space-y-1">
          <label htmlFor="date-from" className="block text-xs text-muted-foreground">From</label>
          <input
            id="date-from"
            type="date"
            value={filters.dateFrom ?? ""}
            onChange={(e) => updateFilter("dateFrom", e.target.value)}
            className="h-9 rounded-md border border-border bg-card px-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="date-to" className="block text-xs text-muted-foreground">To</label>
          <input
            id="date-to"
            type="date"
            value={filters.dateTo ?? ""}
            onChange={(e) => updateFilter("dateTo", e.target.value)}
            className="h-9 rounded-md border border-border bg-card px-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="status-filter" className="block text-xs text-muted-foreground">Status</label>
          <input
            id="status-filter"
            type="text"
            placeholder="e.g. ACTIVE"
            value={filters.status ?? ""}
            onChange={(e) => updateFilter("status", e.target.value)}
            className="h-9 rounded-md border border-border bg-card px-2 text-sm"
          />
        </div>
        {(filters.dateFrom || filters.dateTo || filters.status) && (
          <Button
            variant="outline"
            size="sm"
            className="mb-1.5"
            onClick={() => setFilters({})}
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* KPIs */}
      {isPending && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="space-y-2 p-4">
                <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                <div className="h-7 w-16 animate-pulse rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {!isPending && kpiEntries.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {kpiEntries.map((kpi) => (
            <Card key={kpi.label}>
              <CardContent className="p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {kpi.label.replace(/([A-Z])/g, " $1").trim()}
                </p>
                <p className="mt-1 text-2xl font-semibold">{kpi.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Charts */}
      {isError && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {(error as Error).message}
          <Button variant="outline" size="sm" className="ml-3" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      )}
      {!isPending && !isError && chartEntries.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          {chartEntries.map(([title, chartData]) => (
            <Card key={title}>
              <CardHeader>
                <CardTitle>
                  {title.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()).trim()}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {chartData.length === 0 ? (
                  <EmptyState title="No data" />
                ) : title.toLowerCase().includes("country") ||
                  title.toLowerCase().includes("source") ||
                  title.toLowerCase().includes("method") ||
                  title.toLowerCase().includes("approvalvs") ||
                  title.toLowerCase().includes("completion") ? (
                  <SimplePieChart data={chartData} />
                ) : (
                  <SimpleBarChart data={chartData} />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Data table */}
      {!isPending && !isError && data?.table && data.table.rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Data Table</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    {data.table.headers.map((h) => (
                      <th key={h} className="whitespace-nowrap px-4 py-2.5 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.table.rows.map((row, i) => (
                    <tr key={i} className="hover:bg-muted/40">
                      {data.table!.headers.map((h) => (
                        <td key={h} className="px-4 py-2.5">
                          {String(row[h] ?? "—")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {!isPending && !isError && !data?.kpis && !data?.charts && (
        <EmptyState title="No data available" description="Try selecting a different report type or adjusting filters." />
      )}
    </>
  );
}
