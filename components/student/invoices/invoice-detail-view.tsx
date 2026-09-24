"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarClock,
  ChevronLeft,
  CreditCard,
  Printer,
} from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui";
import { MobilePage, MobileCard, StatusBadge, StudentErrorState } from "@/components/student/ui";
import { Skeleton } from "@/components/ui/overlays";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { useOnlineStatus } from "@/lib/hooks/use-online-status";

// ── Types ──────────────────────────────────────────────────────────

type InvoiceItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

type Payment = {
  id: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  status: string;
  paymentDate: string | null;
  transactionReference: string | null;
};

type InvoiceDetail = {
  id: string;
  invoiceNumber: string;
  status: string;
  statusLabel: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  total: number;
  paidAmount: number;
  dueAmount: number;
  issueDate: string | null;
  dueDate: string | null;
  createdAt: string;
  application: { id: string; applicationNumber: string } | null;
  student: {
    firstName: string;
    lastName: string;
    email: string;
    studentId: string;
  };
  payments: Payment[];
};

// ── Status → tone ──────────────────────────────────────────────────

const STATUS_TONE: Record<string, "default" | "info" | "warning" | "destructive" | "success"> = {
  ISSUED: "info",
  PARTIAL: "warning",
  PAID: "success",
  OVERDUE: "destructive",
  CANCELLED: "default",
};

const PAYMENT_STATUS_TONE: Record<string, "default" | "info" | "warning" | "success"> = {
  PENDING: "warning",
  PAID: "success",
  PARTIAL: "info",
  REFUNDED: "info",
  CANCELLED: "default",
};

// ── Component ──────────────────────────────────────────────────────

export function InvoiceDetailView({ id }: { id: string }) {
  const router = useRouter();
  const online = useOnlineStatus();

  const detailQ = useQuery<{ invoice: InvoiceDetail }>({
    queryKey: ["student-invoice-detail", id],
    queryFn: () => apiFetch<{ invoice: InvoiceDetail }>(`/api/student/invoices/${id}`),
    retry: false,
    staleTime: 30_000,
  });

  if (detailQ.isLoading && !detailQ.data) {
    return (
      <MobilePage>
        <DetailSkeleton />
      </MobilePage>
    );
  }

  if (detailQ.isError || !detailQ.data?.invoice) {
    return (
      <MobilePage>
        <StudentErrorState
          online={online}
          title={!online ? "You're offline" : "Invoice not found"}
          description={!online ? "Check your connection and try again." : "This invoice may not exist or you don't have access to it."}
          onRetry={() => detailQ.refetch()}
        />
        <div className="mt-4 flex justify-center gap-2">
          <Button variant="outline" onClick={() => router.push("/student/invoices")}>
            <ArrowLeft className="h-4 w-4" aria-hidden /> Back to invoices
          </Button>
        </div>
      </MobilePage>
    );
  }

  const inv = detailQ.data.invoice;
  const tone = STATUS_TONE[inv.status] ?? "default";
  const balance = inv.dueAmount;
  const progressPct = inv.total > 0 ? Math.round((inv.paidAmount / inv.total) * 100) : 0;

  return (
    <MobilePage>
      {/* Print-specific styles — inject a style tag that only applies @media print */}
      <style dangerouslySetInnerHTML={{ __html: printStyles }} />

      {/* Back link (hidden in print) */}
      <div className="print:hidden">
        <Link
          href="/student/invoices"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-amber-600"
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> Invoices
        </Link>
      </div>

      {/* Invoice header */}
      <MobileCard className="space-y-3 print:rounded-none print:border-2 print:border-black">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Invoice
            </p>
            <h1 className="mt-1 text-lg font-semibold">{inv.invoiceNumber}</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Student ID: {inv.student.studentId}
            </p>
          </div>
          <div className={cn(
            "flex shrink-0 flex-col items-center gap-1 rounded-xl px-3 py-2",
            tone === "success" && "bg-emerald-500/10 text-emerald-600",
            tone === "warning" && "bg-amber-500/10 text-amber-600",
            tone === "destructive" && "bg-red-500/10 text-red-600",
            tone === "info" && "bg-blue-500/10 text-blue-600",
            tone === "default" && "bg-muted text-muted-foreground",
          )}>
            <span className="text-xs font-semibold">{inv.statusLabel}</span>
          </div>
        </div>

        {/* Date row */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {inv.issueDate && (
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="h-3 w-3" aria-hidden />
              Issued {fmtDate(inv.issueDate)}
            </span>
          )}
          {inv.dueDate && (
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="h-3 w-3" aria-hidden />
              Due {fmtDate(inv.dueDate)}
            </span>
          )}
        </div>
      </MobileCard>

      {/* Bill-to + meta */}
      <MobileCard className="space-y-2 text-sm print:rounded-none print:border-1">
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">Bill To</p>
          <p className="mt-0.5 font-medium">{inv.student.firstName} {inv.student.lastName}</p>
          <p className="text-xs text-muted-foreground">{inv.student.email}</p>
        </div>
        {inv.application && (
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Application</p>
            <p className="mt-0.5 font-mono text-xs">{inv.application.applicationNumber}</p>
          </div>
        )}
      </MobileCard>

      {/* Invoice items */}
      <MobileCard className="space-y-2 print:rounded-none print:border-1">
        <h2 className="text-sm font-semibold">Line Items</h2>
        <div className="space-y-1.5">
          {inv.items.map((item, i) => (
            <div key={i} className="flex items-start justify-between gap-3 rounded-md border border-border p-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{item.description}</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  Qty {item.quantity} × {fmtMoney(item.unitPrice)}
                </p>
              </div>
              <p className="shrink-0 text-sm font-semibold tabular-nums">{fmtMoney(item.lineTotal)}</p>
            </div>
          ))}
        </div>
      </MobileCard>

      {/* Totals */}
      <MobileCard className="space-y-2 print:rounded-none print:border-1">
        <h2 className="text-sm font-semibold">Summary</h2>
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd className="font-medium tabular-nums">{fmtMoney(inv.subtotal)}</dd>
          </div>
          {inv.discount > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Discount</dt>
              <dd className="font-medium text-emerald-600 tabular-nums">−{fmtMoney(inv.discount)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t border-border pt-1.5">
            <dt className="font-semibold">Total</dt>
            <dd className="font-bold tabular-nums">{fmtMoney(inv.total)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Paid</dt>
            <dd className="font-medium text-emerald-600 tabular-nums">{fmtMoney(inv.paidAmount)}</dd>
          </div>
          <div className="flex justify-between border-t border-border pt-1.5">
            <dt className="font-semibold">Balance Due</dt>
            <dd className={cn("font-bold tabular-nums", balance > 0 ? "text-amber-600" : "text-emerald-600")}>
              {fmtMoney(balance)}
            </dd>
          </div>
        </dl>

        {/* Progress bar */}
        {inv.total > 0 && (
          <div className="mt-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Payment progress</span>
              <span className="font-semibold tabular-nums">{progressPct}%</span>
            </div>
            <div
              role="progressbar"
              aria-valuenow={progressPct}
              aria-valuemin={0}
              aria-valuemax={100}
              className="mt-1 h-2 overflow-hidden rounded-full bg-muted"
            >
              <div
                className="h-full rounded-full bg-emerald-500 transition-[width] motion-reduce:transition-none"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}
      </MobileCard>

      {/* Payment history */}
      {inv.payments.length > 0 && (
        <MobileCard className="space-y-2 print:rounded-none print:border-1">
          <h2 className="text-sm font-semibold">Payment History</h2>
          <ul className="space-y-1.5">
            {inv.payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-2.5 text-sm">
                <div className="min-w-0">
                  <p className="font-medium tabular-nums">{fmtMoney(p.amount)}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.paymentMethod}
                    {p.paymentDate && ` · ${fmtDate(p.paymentDate)}`}
                    {p.transactionReference && ` · Ref: ${p.transactionReference}`}
                  </p>
                </div>
                <StatusBadge tone={PAYMENT_STATUS_TONE[p.status] ?? "default"}>{p.status}</StatusBadge>
              </li>
            ))}
          </ul>
        </MobileCard>
      )}

      {/* Action row (hidden in print) */}
      <div className="flex items-center gap-2 print:hidden">
        <Button variant="outline" size="sm" onClick={() => window.print()} className="flex-1">
          <Printer className="h-4 w-4" aria-hidden /> Print / Save PDF
        </Button>
        <Link href="/student/payments" className="flex-1">
          <Button variant="outline" size="sm" className="w-full">
            <CreditCard className="h-4 w-4" aria-hidden /> Payments
          </Button>
        </Link>
      </div>

      {/* Print-only footer (company info placeholder) */}
      <div className="hidden print:block">
        <div className="mt-8 border-t border-black pt-4 text-center text-xs text-gray-600">
          <p className="font-semibold">Euroscope</p>
          <p>This is a system-generated invoice and does not require a signature.</p>
          <p>For questions about this invoice, contact your assigned counselor.</p>
        </div>
      </div>
    </MobilePage>
  );
}

// ── Loading skeleton ───────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading invoice">
      <Skeleton className="h-4 w-20" />
      <MobileCard className="space-y-3">
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-3 w-1/3" />
      </MobileCard>
      <Skeleton className="h-20 w-full rounded-xl" />
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-32 w-full rounded-xl" />
    </div>
  );
}

// ── Print styles ───────────────────────────────────────────────────

const printStyles = `
  @media print {
    body { background: white !important; }
    .no-print, nav, header, footer { display: none !important; }
    main { padding: 0 !important; }
    .print\\:hidden { display: none !important; }
    .print\\:block { display: block !important; }
    .print\\:rounded-none { border-radius: 0 !important; }
    .print\\:border-1 { border-width: 1px !important; }
    .print\\:border-2 { border-width: 2px !important; }
    .print\\:border-black { border-color: black !important; }
    @page { margin: 1.5cm; }
  }
`;

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

