"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronRight,
  FileText,
  RefreshCw,
  Wallet,
  WifiOff,
} from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui";
import {
  MobilePage,
  MobileCard,
  StudentEmptyState,
  StudentErrorState,
  StatusBadge,
} from "@/components/student/ui";
import { Skeleton } from "@/components/ui/overlays";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { useOnlineStatus } from "@/lib/hooks/use-online-status";

// ── Types ──────────────────────────────────────────────────────────

type Invoice = {
  id: string;
  invoiceNumber: string;
  status: string;
  statusLabel: string;
  total: number;
  paidAmount: number;
  dueAmount: number;
  discount: number;
  issueDate: string | null;
  dueDate: string | null;
  application: { id: string; applicationNumber: string } | null;
  createdAt: string;
};

type ListResponse = { invoices: Invoice[] };

// ── Status → tone mapping ──────────────────────────────────────────

const STATUS_TONE: Record<string, "default" | "info" | "warning" | "destructive" | "success"> = {
  ISSUED: "info",
  PARTIAL: "warning",
  PAID: "success",
  OVERDUE: "destructive",
  CANCELLED: "default",
};

// ── Component ──────────────────────────────────────────────────────

export function InvoicesView() {
  const online = useOnlineStatus();

  const listQ = useQuery<ListResponse>({
    queryKey: ["student-invoices"],
    queryFn: () => apiFetch<ListResponse>("/api/student/invoices"),
    retry: false,
    staleTime: 15_000,
  });

  if (listQ.isLoading && !listQ.data) {
    return (
      <MobilePage>
        <InvoicesSkeleton />
      </MobilePage>
    );
  }

  if (listQ.isError && !listQ.data) {
    return (
      <MobilePage>
        <StudentErrorState
          online={online}
          title={!online ? "You're offline" : "Couldn't load your invoices"}
          description={!online ? "Check your connection and try again." : "Please try again in a moment."}
          onRetry={() => listQ.refetch()}
        />
      </MobilePage>
    );
  }

  const invoices = listQ.data?.invoices ?? [];

  // Compute summary from the server data
  const totalAmount = invoices
    .filter((i) => i.status !== "CANCELLED")
    .reduce((s, i) => s + i.total, 0);
  const totalPaid = invoices
    .filter((i) => i.status !== "CANCELLED")
    .reduce((s, i) => s + i.paidAmount, 0);
  const totalDue = invoices
    .filter((i) => i.status !== "CANCELLED")
    .reduce((s, i) => s + i.dueAmount, 0);

  return (
    <MobilePage>
      {/* Summary card */}
      <MobileCard className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="flex items-center gap-2 text-sm font-bold tracking-tight">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-amber-500/10 text-amber-600">
              <Wallet className="h-4 w-4" aria-hidden />
            </span>
            Invoice Summary
          </h1>
          <StatusBadge>{invoices.length} invoices</StatusBadge>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <SummaryTile label="Total" value={fmtMoney(totalAmount)} tone="default" />
          <SummaryTile label="Paid" value={fmtMoney(totalPaid)} tone="success" />
          <SummaryTile label="Balance" value={fmtMoney(totalDue)} tone={totalDue > 0 ? "warning" : "default"} />
        </div>
      </MobileCard>

      {/* Invoice list */}
      {invoices.length === 0 ? (
        <StudentEmptyState
          icon={<FileText className="h-5 w-5" aria-hidden />}
          title="No invoices yet"
          description="Your counselor will issue invoices as your application progresses."
        />
      ) : (
        <div className="space-y-2">
          {invoices.map((inv) => (
            <InvoiceCard key={inv.id} invoice={inv} />
          ))}
        </div>
      )}

      {/* CTA row */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Link
          href="/student/payments"
          className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-amber-500"
        >
          <Wallet className="h-3.5 w-3.5" aria-hidden /> Payments
        </Link>
        <Link
          href="/student/application"
          className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-amber-500"
        >
          Application
        </Link>
        <Link
          href="/student/messages"
          className="col-span-2 flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-amber-500 sm:col-span-1"
        >
          Contact Counselor
        </Link>
      </div>

      {/* Refresh + offline */}
      <div className="flex items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
        <span>{listQ.isFetching ? "Refreshing…" : "Updated just now"}</span>
        {!online && (
          <span className="flex items-center gap-1 text-amber-600">
            <WifiOff className="h-3 w-3" aria-hidden /> Offline
          </span>
        )}
        <Button size="sm" variant="ghost" onClick={() => listQ.refetch()} disabled={listQ.isFetching} aria-label="Refresh list">
          <RefreshCw className={cn("h-3.5 w-3.5", listQ.isFetching && "animate-spin")} aria-hidden />
        </Button>
      </div>
    </MobilePage>
  );
}

// ── Invoice card ───────────────────────────────────────────────────

function InvoiceCard({ invoice }: { invoice: Invoice }) {
  const tone = STATUS_TONE[invoice.status] ?? "default";

  // Border color per tone
  const borderCls = {
    default: "",
    success: "border-emerald-200/60",
    warning: "border-amber-300/60",
    info: "border-blue-300/60",
    destructive: "border-red-300/60",
  }[tone];

  // Icon background per tone
  const iconCls = {
    default: "bg-muted text-muted-foreground",
    success: "bg-emerald-500/10 text-emerald-600",
    warning: "bg-amber-500/10 text-amber-600",
    info: "bg-blue-500/10 text-blue-600",
    destructive: "bg-red-500/10 text-red-600",
  }[tone];

  return (
    <Link
      href={`/student/invoices/${invoice.id}`}
      className="block focus-visible:outline-2 focus-visible:outline-amber-500"
    >
      <MobileCard className={cn(
        "flex items-start justify-between gap-3 p-3 transition-all hover:bg-muted/30 active:scale-[0.99]",
        borderCls,
      )}>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg", iconCls)}>
              <FileText className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{invoice.invoiceNumber}</p>
              <p className="truncate text-xs text-muted-foreground">
                {invoice.issueDate ? `Issued ${fmtDate(invoice.issueDate)}` : "Not issued"}
                {invoice.dueDate && ` · Due ${fmtDate(invoice.dueDate)}`}
              </p>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-3 text-xs tabular-nums">
            <span className="font-semibold">{fmtMoney(invoice.total)}</span>
            {invoice.paidAmount > 0 && (
              <span className="text-emerald-600">Paid {fmtMoney(invoice.paidAmount)}</span>
            )}
            {invoice.dueAmount > 0 && (
              <span className="text-amber-600">Bal {fmtMoney(invoice.dueAmount)}</span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <StatusBadge tone={tone}>{invoice.statusLabel}</StatusBadge>
          <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
        </div>
      </MobileCard>
    </Link>
  );
}

// ── Summary tile ───────────────────────────────────────────────────

function SummaryTile({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "warning";
}) {
  const toneCls = {
    default: "bg-muted text-foreground",
    success: "bg-emerald-500/10 text-emerald-600",
    warning: "bg-amber-500/10 text-amber-600",
  }[tone];

  return (
    <div className={cn("rounded-xl p-2.5 text-center", toneCls)}>
      <p className="text-[10px] uppercase tracking-wide opacity-80">{label}</p>
      <p className="mt-0.5 text-sm font-bold leading-none tabular-nums">{value}</p>
    </div>
  );
}

// ── Loading skeleton ───────────────────────────────────────────────

function InvoicesSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading invoices">
      <Skeleton className="h-24 w-full rounded-xl" />
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────

function fmtMoney(n: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
}

function fmtDate(d: string): string {
  try {
    return format(parseISO(d), "MMM d, yyyy");
  } catch {
    return "—";
  }
}

