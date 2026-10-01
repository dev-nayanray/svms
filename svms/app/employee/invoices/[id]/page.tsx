import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { EmployeePageHeader } from "@/components/employee/ui";
import { Card, CardContent, Badge, Button, Separator } from "@/components/ui";
import { formatDate, formatMoney, titleCase } from "@/lib/utils";
import { requireInvoice, type InvoiceDetail, INVOICE_STATUSES } from "@/lib/services/invoice-cases";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, "default" | "success" | "warning" | "destructive" | "info"> = {
  DRAFT: "default", ISSUED: "info", PARTIAL: "warning", PAID: "success", OVERDUE: "destructive", CANCELLED: "default",
};

export default async function EmployeeInvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/employee/invoices");
  const role = (session.user as { role?: string }).role;
  if (role !== "EMPLOYEE" && role !== "ADMIN") redirect("/403");

  let employeeId: string | null = null;
  if (role === "EMPLOYEE") {
    const employee = await prisma.employee.findFirst({ where: { userId: session.user.id }, select: { id: true } });
    if (!employee) redirect("/403");
    employeeId = employee.id;
  }
  const scope = { isAdmin: role === "ADMIN", userId: session.user.id, employeeId };
  const canManage = hasPermission(role, "payments.read");

  const { id } = await params;
  let invoice: InvoiceDetail;
  try {
    invoice = await requireInvoice(scope, id);
  } catch {
    notFound();
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <Link href="/employee/invoices" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" aria-hidden /> Back to Invoices
        </Link>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5" aria-hidden /> Print
          </Button>
        </div>
      </div>

      {/* Print-friendly invoice */}
      <Card className="print:border-0 print:shadow-none">
        <CardContent className="p-8 print:p-0">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">INVOICE</h1>
              <p className="mt-1 font-mono text-sm text-muted-foreground">{invoice.invoiceNumber}</p>
            </div>
            <div className="text-right">
              <Badge tone={STATUS_TONE[invoice.status] ?? "default"}>{titleCase(invoice.status)}</Badge>
              <p className="mt-2 text-xs text-muted-foreground">Issue date: {formatDate(invoice.issueDate)}</p>
              {invoice.dueDate && <p className="text-xs text-muted-foreground">Due date: {formatDate(invoice.dueDate)}</p>}
            </div>
          </div>

          <Separator className="my-6" />

          {/* Bill to */}
          <div className="grid grid-cols-2 gap-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bill To</p>
              <p className="mt-1 font-medium">{invoice.student.firstName} {invoice.student.lastName}</p>
              <p className="text-xs text-muted-foreground">{invoice.student.studentId}</p>
              <p className="text-xs text-muted-foreground">{invoice.student.email}</p>
              {invoice.student.phone && <p className="text-xs text-muted-foreground">{invoice.student.phone}</p>}
              {invoice.student.city && <p className="text-xs text-muted-foreground">{invoice.student.city}{invoice.student.country ? `, ${invoice.student.country}` : ""}</p>}
            </div>
            <div className="text-right">
              {invoice.application && (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Application</p>
                  <p className="mt-1 font-medium">{invoice.application.applicationNumber}</p>
                  {invoice.application.country && <p className="text-xs text-muted-foreground">{invoice.application.country.name}</p>}
                  {invoice.application.university && <p className="text-xs text-muted-foreground">{invoice.application.university.name}</p>}
                  {invoice.application.course && <p className="text-xs text-muted-foreground">{invoice.application.course.name}</p>}
                </>
              )}
            </div>
          </div>

          {/* Line items */}
          <table className="mt-6 w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="py-2 text-left font-medium text-muted-foreground">Description</th>
                <th className="py-2 text-right font-medium text-muted-foreground">Qty</th>
                <th className="py-2 text-right font-medium text-muted-foreground">Unit Price</th>
                <th className="py-2 text-right font-medium text-muted-foreground">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item) => (
                <tr key={item.id} className="border-b border-border/50">
                  <td className="py-2">{item.description}</td>
                  <td className="py-2 text-right">{item.quantity}</td>
                  <td className="py-2 text-right">{formatMoney(item.unitPrice, invoice.currency)}</td>
                  <td className="py-2 text-right font-medium">{formatMoney(item.total, invoice.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="mt-4 flex justify-end">
            <div className="w-64 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatMoney(invoice.subtotal, invoice.currency)}</span></div>
              {invoice.discount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span className="text-destructive">−{formatMoney(invoice.discount, invoice.currency)}</span></div>}
              {invoice.tax > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span>{formatMoney(invoice.tax, invoice.currency)}</span></div>}
              <Separator className="my-1" />
              <div className="flex justify-between font-bold"><span>Total</span><span>{formatMoney(invoice.total, invoice.currency)}</span></div>
              {invoice.paidAmount > 0 && <div className="flex justify-between text-success"><span>Paid</span><span>−{formatMoney(invoice.paidAmount, invoice.currency)}</span></div>}
              {invoice.balance > 0 && <div className="flex justify-between font-bold text-warning"><span>Balance Due</span><span>{formatMoney(invoice.balance, invoice.currency)}</span></div>}
            </div>
          </div>

          {invoice.notes && (
            <div className="mt-6 border-t border-border pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notes</p>
              <p className="mt-1 text-sm whitespace-pre-wrap">{invoice.notes}</p>
            </div>
          )}

          {/* Payments */}
          {invoice.payments.length > 0 && (
            <div className="mt-6 border-t border-border pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payment History</p>
              <ul className="mt-2 space-y-1">
                {invoice.payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between text-xs">
                    <span>{formatDate(p.paymentDate)} · {titleCase(p.paymentMethod.replace(/_/g, " "))}</span>
                    <span className="font-medium">{formatMoney(p.amount, p.currency)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Actions */}
          <div className="mt-6 flex items-center gap-2 print:hidden">
            {canManage && invoice.status === "DRAFT" && (
              <form action={`/api/employee/invoices/${invoice.id}/issue`} method="POST">
                <Button type="submit" size="sm">Issue Invoice</Button>
              </form>
            )}
            {canManage && invoice.status !== "CANCELLED" && invoice.status !== "PAID" && (
              <form action={`/api/employee/invoices/${invoice.id}/cancel`} method="POST">
                <Button type="submit" variant="destructive" size="sm">Cancel Invoice</Button>
              </form>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
