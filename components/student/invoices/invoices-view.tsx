"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ChevronRight,
  FileText,
  RefreshCw,
  Wallet,
  WifiOff,
} from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { Button, Badge } from "@/components/ui";
import { MobilePage, MobileCard } from "@/components/student/ui";
import { Skeleton } from "@/components/ui/overlays";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";

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
        <MobileCard className="py-8 text-center">
          {!online ? (
            <WifiOff className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden />
          ) : (
            <AlertTriangle className="mx-auto h-10 w-10 text-destructive" aria-hidden />
          )}
          <h2 className="mt-3 text-base font-semibold">
            {!online ? "You're offline" : "Couldn't load your invoices"}
          </h2>
          <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
            {!online ? "Check your connection and try again." : "Please try again in a moment."}
          </p>
          <Button onClick={() => listQ.refetch()} className="mt-4" disabled={!online}>
            <RefreshCw className="h-4 w-4" aria-hidden /> Retry
          </Button>
        </MobileCard>
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
          <h1 className="flex items-center gap-2 text-sm font-semibold">
            <Wallet className="h-4 w-4 text-primary" aria-hidden />
            Invoice Summary
          </h1>
          <Badge tone="default">{invoices.length} invoices</Badge>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <SummaryTile label="Total" value={fmtMoney(totalAmount)} tone="default" />
          <SummaryTile label="Paid" value={fmtMoney(totalPaid)} tone="success" />
          <SummaryTile label="Balance" value={fmtMoney(totalDue)} tone={totalDue > 0 ? "warning" : "default"} />
        </div>
      </MobileCard>

      {/* Invoice list */}
      {invoices.length === 0 ? (
        <MobileCard className="py-8 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
            <FileText className="h-6 w-6" aria-hidden />
          </span>
          <h2 className="mt-3 text-base font-semibold">No invoices yet</h2>
          <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
            Your counselor will issue invoices as your application progresses.
          </p>
        </MobileCard>
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
          className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"
        >
          <Wallet className="h-3.5 w-3.5" aria-hidden /> Payments
        </Link>
        <Link
          href="/student/application"
          className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"
        >
          Application
        </Link>
        <Link
          href="/student/messages"
          className="col-span-2 flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary sm:col-span-1"
        >
          Contact Counselor
        </Link>
      </div>

      {/* Refresh + offline */}
      <div className="flex items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
        <span>{listQ.isFetching ? "Refreshing…" : "Updated just now"}</span>
        {!online && (
          <span className="flex items-center gap-1 text-warning">
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

  return (
    <Link
      href={`/student/invoices/${invoice.id}`}
      className="block focus-visible:outline-2 focus-visible:outline-primary"
    >
      <MobileCard className={cn(
        "flex items-start justify-between gap-3 p-3 transition-colors hover:bg-muted/30",
        tone === "success" && "border-success/30",
        tone === "destructive" && "border-destructive/30",
        tone === "warning" && "border-warning/30",
      )}>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={cn(
              "grid h-8 w-8 shrink-0 place-items-center rounded-full",
              tone === "success" && "bg-success/10 text-success",
              tone === "warning" && "bg-warning/10 text-warning",
              tone === "destructive" && "bg-destructive/10 text-destructive",
              tone === "info" && "bg-info/10 text-info",
              tone === "default" && "bg-muted text-muted-foreground",
            )}>
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
          <div className="mt-2 flex items-center gap-3 text-xs">
            <span className="font-semibold">{fmtMoney(invoice.total)}</span>
            {invoice.paidAmount > 0 && (
              <span className="text-success">Paid {fmtMoney(invoice.paidAmount)}</span>
            )}
            {invoice.dueAmount > 0 && (
              <span className="text-warning">Bal {fmtMoney(invoice.dueAmount)}</span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Badge tone={tone}>{invoice.statusLabel}</Badge>
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
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
  }[tone];

  return (
    <div className={cn("rounded-lg p-2.5 text-center", toneCls)}>
      <p className="text-[10px] uppercase tracking-wide opacity-80">{label}</p>
      <p className="mt-0.5 text-sm font-semibold leading-none">{value}</p>
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

function useOnlineStatus() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}
