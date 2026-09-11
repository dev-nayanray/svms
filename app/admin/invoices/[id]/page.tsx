import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/shared/page-kit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { StatusBadge, TableShell, EmptyState } from "@/components/shared";
import { formatDate, formatMoney, cn } from "@/lib/utils";
import {
  INVOICE_STATUS_LABELS,
  paymentProgress,
} from "@/lib/constants/finance";
import { Printer, ChevronLeft, FileText } from "lucide-react";

export const dynamic = "force-dynamic";

type InvoiceItem = { description: string; quantity: number; unitPrice: number };

export default async function InvoiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ print?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const isPrintMode = sp.print === "1";

  const invoice = await prisma.invoice.findFirst({
    where: { id, deletedAt: null },
    include: {
      student: true,
      application: true,
      payments: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!invoice) notFound();

  const items = (invoice.items as InvoiceItem[]) ?? [];
  const progress = paymentProgress({ paidAmount: invoice.paidAmount, total: invoice.total });

  // Print mode: render a clean, print-friendly invoice layout
  if (isPrintMode) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 p-8 print:p-0">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">INVOICE</h1>
            <p className="mt-1 font-mono text-sm text-muted-foreground">
              {invoice.invoiceNumber}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium">Issue Date</p>
            <p className="text-sm">{formatDate(invoice.issueDate)}</p>
            {invoice.dueDate && (
              <>
                <p className="mt-2 text-sm font-medium">Due Date</p>
                <p className="text-sm">{formatDate(invoice.dueDate)}</p>
              </>
            )}
          </div>
        </div>

        <div className="border-t border-b border-border py-4">
          <p className="text-sm font-medium">Bill To</p>
          <p className="mt-1 text-sm font-semibold">
            {invoice.student.firstName} {invoice.student.lastName}
          </p>
          <p className="text-sm text-muted-foreground">{invoice.student.email}</p>
          {invoice.student.phone && (
            <p className="text-sm text-muted-foreground">{invoice.student.phone}</p>
          )}
          {invoice.student.city && (
            <p className="text-sm text-muted-foreground">
              {invoice.student.city}, {invoice.student.country}
            </p>
          )}
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="pb-2 pr-4 font-medium">Description</th>
              <th className="pb-2 px-4 text-right font-medium">Qty</th>
              <th className="pb-2 px-4 text-right font-medium">Unit Price</th>
              <th className="pb-2 pl-4 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} className="border-b border-border/50">
                <td className="py-2 pr-4">{item.description}</td>
                <td className="py-2 px-4 text-right text-muted-foreground">{item.quantity}</td>
                <td className="py-2 px-4 text-right text-muted-foreground">{formatMoney(item.unitPrice)}</td>
                <td className="py-2 pl-4 text-right font-medium">{formatMoney(item.quantity * item.unitPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end">
          <div className="w-64 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">{formatMoney(invoice.subtotal)}</span>
            </div>
            {invoice.discount > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Discount</span>
                <span className="font-medium text-destructive">- {formatMoney(invoice.discount)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-border pt-2">
              <span className="font-semibold">Total</span>
              <span className="font-bold">{formatMoney(invoice.total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Paid</span>
              <span className="font-medium text-success">{formatMoney(invoice.paidAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Due</span>
              <span className={cn("font-bold", invoice.dueAmount > 0 ? "text-warning" : "")}>
                {formatMoney(invoice.dueAmount)}
              </span>
            </div>
          </div>
        </div>

        <div className="border-t border-border pt-4 text-center text-xs text-muted-foreground">
          <StatusBadge status={invoice.status} /> ·{" "}
          {INVOICE_STATUS_LABELS[invoice.status as keyof typeof INVOICE_STATUS_LABELS] ?? invoice.status}
          <br />
          This is a computer-generated invoice and does not require a signature.
        </div>

        <div className="print:hidden">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <Printer className="h-4 w-4" aria-hidden /> Print Invoice
          </button>
          <Link
            href={`/admin/invoices/${invoice.id}`}
            className="ml-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> Back to detail
          </Link>
        </div>
      </div>
    );
  }

  // Normal detail view
  return (
    <>
      <div className="flex items-center gap-2 text-sm">
        <Link
          href="/admin/invoices"
          className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary"
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> Invoices
        </Link>
      </div>

      <PageHeader
        title={
          <span className="inline-flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" aria-hidden />
            {invoice.invoiceNumber}
          </span>
        }
        description={`${invoice.student.firstName} ${invoice.student.lastName} · issued ${formatDate(invoice.issueDate)}`}
        breadcrumbs={["Admin", "Invoices", invoice.invoiceNumber]}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href={`/admin/invoices/${invoice.id}?print=1`}
              target="_blank"
              className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
            >
              <Printer className="h-3.5 w-3.5" aria-hidden /> Print
            </Link>
            <StatusBadge status={invoice.status} />
          </div>
        }
      />

      {/* Payment progress bar */}
      {invoice.total > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium">Payment Progress</span>
              <span className="text-muted-foreground">
                {formatMoney(invoice.paidAmount)} / {formatMoney(invoice.total)} ({progress}%)
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  progress === 100 ? "bg-success" : progress > 0 ? "bg-primary" : "bg-muted",
                )}
                style={{ width: `${progress}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Line Items</CardTitle>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <EmptyState title="No items" />
            ) : (
              <TableShell headers={["Description", "Qty", "Unit Price", "Amount"]}>
                {items.map((item, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2.5 font-medium">{item.description}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{item.quantity}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{formatMoney(item.unitPrice)}</td>
                    <td className="px-4 py-2.5">{formatMoney(item.quantity * item.unitPrice)}</td>
                  </tr>
                ))}
              </TableShell>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <Row label="Subtotal" value={formatMoney(invoice.subtotal)} />
            {invoice.discount > 0 && (
              <Row label="Discount" value={`- ${formatMoney(invoice.discount)}`} />
            )}
            <Row label="Total" value={formatMoney(invoice.total)} bold />
            <Row label="Paid" value={formatMoney(invoice.paidAmount)} />
            <Row
              label="Due"
              value={formatMoney(invoice.dueAmount)}
              bold={invoice.dueAmount > 0}
            />
            <div className="border-t border-border pt-2" />
            <Row label="Issue date" value={formatDate(invoice.issueDate)} />
            <Row label="Due date" value={formatDate(invoice.dueDate)} />
            {invoice.application && (
              <Row
                label="Application"
                value={
                  <Link
                    href={`/admin/applications/${invoice.application.id}`}
                    className="text-primary hover:underline"
                  >
                    {invoice.application.applicationNumber}
                  </Link>
                }
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payments</CardTitle>
        </CardHeader>
        <CardContent>
          {invoice.payments.length === 0 ? (
            <EmptyState
              title="No payments against this invoice"
              description="Record a payment from the Payments admin to link it to this invoice."
            />
          ) : (
            <TableShell headers={["Date", "Amount", "Method", "Reference", "Status"]}>
              {invoice.payments.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2.5 text-muted-foreground">{formatDate(p.paymentDate)}</td>
                  <td className="px-4 py-2.5 font-medium">{formatMoney(p.amount, p.currency)}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{p.paymentMethod.replace(/_/g, " ")}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                    {p.transactionReference ?? "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={p.status} />
                  </td>
                </tr>
              ))}
            </TableShell>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: React.ReactNode;
  bold?: boolean;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={bold ? "font-semibold" : "font-medium"}>{value}</span>
    </div>
  );
}
