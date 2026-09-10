import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/shared/page-kit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { StatusBadge, TableShell, EmptyState } from "@/components/shared";
import { formatDate, formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

type InvoiceItem = { description: string; quantity: number; unitPrice: number };

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  return (
    <>
      <PageHeader
        title={invoice.invoiceNumber}
        description={`${invoice.student.firstName} ${invoice.student.lastName} · issued ${formatDate(invoice.issueDate)}`}
        breadcrumbs={["Admin", "Invoices", invoice.invoiceNumber]}
        actions={<StatusBadge status={invoice.status} />}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Line Items</CardTitle></CardHeader>
          <CardContent>
            {items.length === 0 ? <EmptyState title="No items" /> : (
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
          <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <Row label="Subtotal" value={formatMoney(invoice.subtotal)} />
            <Row label="Discount" value={`- ${formatMoney(invoice.discount)}`} />
            <Row label="Total" value={formatMoney(invoice.total)} bold />
            <Row label="Paid" value={formatMoney(invoice.paidAmount)} />
            <Row label="Due" value={formatMoney(invoice.dueAmount)} bold />
            <div className="border-t border-border pt-2" />
            <Row label="Due date" value={formatDate(invoice.dueDate)} />
            {invoice.application && (
              <Row label="Application" value={invoice.application.applicationNumber} />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Payments</CardTitle></CardHeader>
        <CardContent>
          {invoice.payments.length === 0 ? <EmptyState title="No payments against this invoice" /> : (
            <TableShell headers={["Date", "Amount", "Method", "Reference", "Status"]}>
              {invoice.payments.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2.5 text-muted-foreground">{formatDate(p.paymentDate)}</td>
                  <td className="px-4 py-2.5 font-medium">{formatMoney(p.amount, p.currency)}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{p.paymentMethod.replace("_", " ")}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{p.transactionReference ?? "—"}</td>
                  <td className="px-4 py-2.5"><StatusBadge status={p.status} /></td>
                </tr>
              ))}
            </TableShell>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={bold ? "font-semibold" : "font-medium"}>{value}</span>
    </div>
  );
}
