import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, ArrowRight, Printer } from "lucide-react";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { EmployeePageHeader } from "@/components/employee/ui";
import { Card, CardContent, Badge, Button } from "@/components/ui";
import { formatMoney, formatDate, titleCase } from "@/lib/utils";
import { listInvoices, type InvoiceListFilters } from "@/lib/services/invoice-cases";
import { DataTable, Th, Td } from "@/components/employee/data-table";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, "default" | "success" | "warning" | "destructive" | "info"> = {
  DRAFT: "default", ISSUED: "info", PARTIAL: "warning", PAID: "success", OVERDUE: "destructive", CANCELLED: "default",
};

export default async function EmployeeInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
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

  const sp = await searchParams;
  const filters: InvoiceListFilters = {
    search: sp.search, status: sp.status,
    studentId: sp.studentId, applicationId: sp.applicationId,
  };
  const page = sp.page ? Number(sp.page) : 1;
  const pageSize = sp.pageSize ? Number(sp.pageSize) : 20;

  let result;
  try {
    result = await listInvoices(scope, { filters, page, pageSize });
  } catch (err) {
    console.error("[employee/invoices]", err);
    return (
      <div>
        <EmployeePageHeader title="Invoices" description="Could not load — server error." />
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">An unexpected error occurred.</CardContent></Card>
      </div>
    );
  }

  return (
    <div>
      <EmployeePageHeader
        title="Invoices"
        description={`${result.total} invoice${result.total === 1 ? "" : "s"}`}
        actions={canManage && (
          <Link href="/employee/invoices?new=true"><Button size="sm"><Plus className="h-3.5 w-3.5" aria-hidden /> New Invoice</Button></Link>
        )}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input type="search" name="search" defaultValue={sp.search} placeholder="Search by invoice # or student…" className="h-9 min-w-[150px] flex-1 rounded-md border border-input bg-background px-3 text-sm" aria-label="Search invoices" />
        <select name="status" defaultValue={sp.status ?? ""} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="ISSUED">Issued</option>
          <option value="PARTIAL">Partial</option>
          <option value="PAID">Paid</option>
          <option value="OVERDUE">Overdue</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      <DataTable
        empty={result.rows.length === 0 ? "No invoices match these filters." : undefined}
        headers={
          <tr>
            <Th>Invoice #</Th>
            <Th className="hidden md:table-cell">Student</Th>
            <Th className="hidden lg:table-cell">Issued</Th>
            <Th className="hidden lg:table-cell">Due</Th>
            <Th className="hidden xl:table-cell">Subtotal</Th>
            <Th className="hidden xl:table-cell">Discount</Th>
            <Th className="hidden xl:table-cell">Tax</Th>
            <Th>Total</Th>
            <Th className="hidden md:table-cell">Paid</Th>
            <Th className="hidden md:table-cell">Balance</Th>
            <Th>Status</Th>
            <Th className="text-right"><span className="sr-only">Actions</span></Th>
          </tr>
        }
      >
        {result.rows.map((inv) => (
          <tr key={inv.id} className="hover:bg-muted/30">
            <Td><Link href={`/employee/invoices/${inv.id}`} className="font-mono text-xs font-medium text-primary hover:underline">{inv.invoiceNumber}</Link></Td>
            <Td className="hidden md:table-cell text-muted-foreground">{inv.student.firstName} {inv.student.lastName}</Td>
            <Td className="hidden lg:table-cell text-muted-foreground">{formatDate(inv.issueDate)}</Td>
            <Td className="hidden lg:table-cell text-muted-foreground">{inv.dueDate ? formatDate(inv.dueDate) : "—"}</Td>
            <Td className="hidden xl:table-cell text-muted-foreground">{formatMoney(inv.subtotal, inv.currency)}</Td>
            <Td className="hidden xl:table-cell text-muted-foreground">{inv.discount > 0 ? formatMoney(inv.discount, inv.currency) : "—"}</Td>
            <Td className="hidden xl:table-cell text-muted-foreground">{inv.tax > 0 ? formatMoney(inv.tax, inv.currency) : "—"}</Td>
            <Td><span className="font-medium">{formatMoney(inv.total, inv.currency)}</span></Td>
            <Td className="hidden md:table-cell text-success">{formatMoney(inv.paidAmount, inv.currency)}</Td>
            <Td className="hidden md:table-cell text-warning">{formatMoney(inv.balance, inv.currency)}</Td>
            <Td><Badge tone={STATUS_TONE[inv.status] ?? "default"}>{titleCase(inv.status)}</Badge></Td>
            <Td>
              <Link href={`/employee/invoices/${inv.id}`} aria-label="View invoice">
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><ArrowRight className="h-3.5 w-3.5" /></Button>
              </Link>
            </Td>
          </tr>
        ))}
      </DataTable>

      {result.totalPages > 1 && (
        <nav aria-label="Pagination" className="mt-4 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Showing {(page - 1) * pageSize + 1}–{Math.min(result.total, page * pageSize)} of {result.total}</p>
          <div className="flex items-center gap-1">
            {page > 1 && (() => {
              const params = new URLSearchParams();
              for (const [k, v] of Object.entries(sp)) if (v) params.set(k, v);
              params.set("page", String(page - 1));
              return <Link href={`/employee/invoices?${params.toString()}`}><Button variant="outline" size="sm">Previous</Button></Link>;
            })()}
            <span className="text-sm font-medium">Page {page} / {result.totalPages}</span>
            {page < result.totalPages && (() => {
              const params = new URLSearchParams();
              for (const [k, v] of Object.entries(sp)) if (v) params.set(k, v);
              params.set("page", String(page + 1));
              return <Link href={`/employee/invoices?${params.toString()}`}><Button variant="outline" size="sm">Next</Button></Link>;
            })()}
          </div>
        </nav>
      )}
    </div>
  );
}
