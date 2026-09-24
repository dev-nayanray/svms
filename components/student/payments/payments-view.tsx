"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  CreditCard,
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

// ── Types ──────────────────────────────────────────────────────────

type Payment = {
  id: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  paymentMethodLabel: string;
  status: string;
  statusLabel: string;
  transactionReference: string | null;
  paymentDate: string | null;
  applicationId: string | null;
  application: { id: string; applicationNumber: string } | null;
  invoiceId: string | null;
  invoice: { id: string; invoiceNumber: string; total: number; paidAmount: number; dueAmount: number; status: string } | null;
  createdAt: string;
};

type Summary = {
  totalAmount: number;
  paid: number;
  outstanding: number;
  pending: number;
  currency: string;
  invoiceCount: number;
  paymentCount: number;
  nextOpenInvoice: {
    id: string;
    invoiceNumber: string;
    dueAmount: number;
    dueDate: string | null;
    status: string;
  } | null;
};

type ListResponse = { payments: Payment[] };
type SummaryResponse = { summary: Summary };

// ── Status → tone mapping ──────────────────────────────────────────

const STATUS_TONE: Record<string, "default" | "info" | "warning" | "destructive" | "success"> = {
  PENDING: "warning",
  PAID: "success",
  PARTIAL: "info",
  REFUNDED: "info",
  CANCELLED: "default",
};

function statusIcon(status: string) {
  switch (status) {
    case "PAID":
      return <CheckCircle2 className="h-4 w-4" aria-hidden />;
    case "PENDING":
      return <CalendarClock className="h-4 w-4" aria-hidden />;
    case "REFUNDED":
      return <RefreshCw className="h-4 w-4" aria-hidden />;
    default:
      return <CreditCard className="h-4 w-4" aria-hidden />;
  }
}

// ── Component ──────────────────────────────────────────────────────

export function PaymentsView() {
  const online = useOnlineStatus();

  const summaryQ = useQuery<SummaryResponse>({
    queryKey: ["student-payments-summary"],
    queryFn: () => apiFetch<SummaryResponse>("/api/student/payments/summary"),
    retry: false,
    staleTime: 30_000,
  });

  const listQ = useQuery<ListResponse>({
    queryKey: ["student-payments"],
    queryFn: () => apiFetch<ListResponse>("/api/student/payments"),
    retry: false,
    staleTime: 15_000,
  });

  const loading = (summaryQ.isLoading && !summaryQ.data) || (listQ.isLoading && !listQ.data);
  const error = summaryQ.isError || listQ.isError;

  if (loading) {
    return (
      <MobilePage>
        <PaymentsSkeleton />
      </MobilePage>
    );
  }

  if (error && !summaryQ.data && !listQ.data) {
    return (
      <MobilePage>
        <StudentErrorState
          online={online}
          title={!online ? "You're offline" : "Couldn't load your payments"}
          description={!online ? "Check your connection and try again." : "Please try again in a moment."}
          onRetry={() => { summaryQ.refetch(); listQ.refetch(); }}
        />
      </MobilePage>
    );
  }

  const summary = summaryQ.data?.summary;
  const payments = listQ.data?.payments ?? [];

  return (
    <MobilePage>
      {/* Financial Summary Card */}
      {summary && <SummaryCard summary={summary} />}

      {/* Next Open Invoice (if any) */}
      {summary?.nextOpenInvoice && (
        <MobileCard className="border-amber-300/60 bg-amber-50/40 dark:bg-amber-950/10">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-xs font-medium text-amber-600">
                <CalendarClock className="h-3.5 w-3.5" aria-hidden />
                Next Payment Due
              </p>
              <p className="mt-1 text-sm font-semibold">
                {summary.currency} {summary.nextOpenInvoice.dueAmount.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">
                Invoice {summary.nextOpenInvoice.invoiceNumber}
                {summary.nextOpenInvoice.dueDate && ` · Due ${fmtDate(summary.nextOpenInvoice.dueDate)}`}
              </p>
            </div>
            <Link
              href="/student/invoices"
              className="shrink-0 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
            >
              View Invoice
            </Link>
          </div>
        </MobileCard>
      )}

      {/* Payment History */}
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-amber-500/10 text-amber-600">
            <CreditCard className="h-4 w-4" aria-hidden />
          </span>
          Payment History
          <StatusBadge>{payments.length}</StatusBadge>
        </h2>
      </div>

      {payments.length === 0 ? (
        <StudentEmptyState
          icon={<Wallet className="h-5 w-5" aria-hidden />}
          title="No payments yet"
          description="Your payment history will appear here once your counselor records a payment."
        />
      ) : (
        <div className="space-y-2">
          {payments.map((p) => (
            <PaymentCard key={p.id} payment={p} />
          ))}
        </div>
      )}

      {/* CTA row */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Link
          href="/student/invoices"
          className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-amber-500"
        >
          <FileText className="h-3.5 w-3.5" aria-hidden /> Invoices
        </Link>
        <Link
          href="/student/application"
          className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-amber-500"
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> Application
        </Link>
        <Link
          href="/student/messages"
          className="col-span-2 flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-amber-500 sm:col-span-1"
        >
          Contact Counselor
        </Link>
      </div>

      {/* Refresh + offline indicator */}
      <div className="flex items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
        <span>{listQ.isFetching || summaryQ.isFetching ? "Refreshing…" : "Updated just now"}</span>
        {!online && (
          <span className="flex items-center gap-1 text-amber-600">
            <WifiOff className="h-3 w-3" aria-hidden /> Offline
          </span>
        )}
        <Button
          size="sm"
          variant="ghost"
          aria-label="Refresh list"
          onClick={() => { summaryQ.refetch(); listQ.refetch(); }}
          disabled={listQ.isFetching || summaryQ.isFetching}
        >
          <RefreshCw
            className={cn("h-3.5 w-3.5", (listQ.isFetching || summaryQ.isFetching) && "animate-spin")}
            aria-hidden
          />
        </Button>
      </div>
    </MobilePage>
  );
}

// ── Summary Card ───────────────────────────────────────────────────

function SummaryCard({ summary }: { summary: Summary }) {
  const fmtMoney = (n: number) =>
    new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);

  return (
    <MobileCard className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-sm font-bold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-amber-500/10 text-amber-600">
            <Wallet className="h-4 w-4" aria-hidden />
          </span>
          Financial Summary
        </h1>
        <StatusBadge>{summary.invoiceCount} invoices</StatusBadge>
      </div>

      {/* 2x2 grid of financial metrics */}
      <div className="grid grid-cols-2 gap-2">
        <MetricTile
          label="Total Amount"
          value={fmtMoney(summary.totalAmount)}
          currency={summary.currency}
          tone="default"
        />
        <MetricTile
          label="Paid"
          value={fmtMoney(summary.paid)}
          currency={summary.currency}
          tone="success"
        />
        <MetricTile
          label="Outstanding"
          value={fmtMoney(summary.outstanding)}
          currency={summary.currency}
          tone={summary.outstanding > 0 ? "warning" : "default"}
        />
        <MetricTile
          label="Pending"
          value={fmtMoney(summary.pending)}
          currency={summary.currency}
          tone={summary.pending > 0 ? "info" : "default"}
        />
      </div>

      {/* Progress bar */}
      {summary.totalAmount > 0 && (
        <div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Payment progress</span>
            <span className="font-semibold">
              {Math.round((summary.paid / summary.totalAmount) * 100)}%
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={Math.round((summary.paid / summary.totalAmount) * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Payment progress"
            className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-muted"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-[width] motion-reduce:transition-none"
              style={{ width: `${(summary.paid / summary.totalAmount) * 100}%` }}
            />
          </div>
        </div>
      )}
    </MobileCard>
  );
}

function MetricTile({
  label,
  value,
  currency,
  tone = "default",
}: {
  label: string;
  value: string;
  currency: string;
  tone?: "default" | "success" | "warning" | "info";
}) {
  const toneCls = {
    default: "bg-muted text-foreground",
    success: "bg-emerald-500/10 text-emerald-600",
    warning: "bg-amber-500/10 text-amber-600",
    info: "bg-blue-500/10 text-blue-600",
  }[tone];

  return (
    <div className={cn("rounded-xl p-3", toneCls)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold leading-none tabular-nums">
        {currency} {value}
      </p>
    </div>
  );
}

// ── Payment Card (expandable) ──────────────────────────────────────

function PaymentCard({ payment }: { payment: Payment }) {
  const [expanded, setExpanded] = useState(false);
  const tone = STATUS_TONE[payment.status] ?? "default";

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
    <MobileCard className={cn("overflow-hidden p-0", borderCls)}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-start justify-between gap-3 p-3 text-left transition-colors hover:bg-muted/30 focus-visible:outline-2 focus-visible:outline-amber-500"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-lg", iconCls)}>
              {statusIcon(payment.status)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tabular-nums">
                {payment.currency} {payment.amount.toLocaleString()}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {payment.paymentMethodLabel}
                {payment.paymentDate && ` · ${fmtDate(payment.paymentDate)}`}
              </p>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <StatusBadge tone={tone}>{payment.statusLabel}</StatusBadge>
          <ChevronDown
            className={cn("h-4 w-4 text-muted-foreground transition-transform", expanded && "rotate-180")}
            aria-hidden
          />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border p-3 text-sm">
          <dl className="grid grid-cols-2 gap-2">
            <div>
              <dt className="text-xs text-muted-foreground">Amount</dt>
              <dd className="mt-0.5 font-medium tabular-nums">
                {payment.currency} {payment.amount.toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Method</dt>
              <dd className="mt-0.5 font-medium">{payment.paymentMethodLabel}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Date</dt>
              <dd className="mt-0.5 font-medium">
                {payment.paymentDate ? fmtDate(payment.paymentDate) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Status</dt>
              <dd className="mt-0.5">
                <StatusBadge tone={tone}>{payment.statusLabel}</StatusBadge>
              </dd>
            </div>
            {payment.transactionReference && (
              <div className="col-span-2">
                <dt className="text-xs text-muted-foreground">Reference</dt>
                <dd className="mt-0.5 font-mono text-xs">{payment.transactionReference}</dd>
              </div>
            )}
            {payment.invoice && (
              <div className="col-span-2 rounded-lg border border-border p-2">
                <p className="text-xs font-medium">Related Invoice</p>
                <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                  {payment.invoice.invoiceNumber} · Total {payment.invoice.total.toLocaleString()} ·
                  Due {payment.invoice.dueAmount.toLocaleString()}
                </p>
                <Link
                  href="/student/invoices"
                  className="mt-1 inline-flex text-xs text-amber-600 hover:underline"
                >
                  View invoice →
                </Link>
              </div>
            )}
            {payment.application && (
              <div className="col-span-2">
                <dt className="text-xs text-muted-foreground">Application</dt>
                <dd className="mt-0.5 font-mono text-xs">{payment.application.applicationNumber}</dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </MobileCard>
  );
}

// ── Loading skeleton ───────────────────────────────────────────────

function PaymentsSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading payments">
      <Skeleton className="h-32 w-full rounded-xl" />
      <Skeleton className="h-10 w-full rounded-lg" />
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────

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
