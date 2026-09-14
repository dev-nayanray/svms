import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, ArrowRight } from "lucide-react";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { EmployeePageHeader, StatCard } from "@/components/employee/ui";
import { Card, CardContent, Badge, Button } from "@/components/ui";
import { formatMoney, formatDate, titleCase, cn } from "@/lib/utils";
import { listPayments, type PaymentListFilters } from "@/lib/services/payment-cases";
import { DataTable, Th, Td } from "@/components/employee/data-table";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, "default" | "success" | "warning" | "destructive" | "info"> = {
  PENDING: "warning", PAID: "success", PARTIAL: "info", REFUNDED: "destructive", CANCELLED: "default",
};

export default async function EmployeePaymentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/employee/payments");
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
  const filters: PaymentListFilters = {
    search: sp.search, status: sp.status, method: sp.method,
    studentId: sp.studentId, applicationId: sp.applicationId,
    dateFrom: sp.dateFrom, dateTo: sp.dateTo,
  };
  const page = sp.page ? Number(sp.page) : 1;
  const pageSize = sp.pageSize ? Number(sp.pageSize) : 20;

  let result;
  try {
    result = await listPayments(scope, { filters, page, pageSize });
  } catch (err) {
    console.error("[employee/payments]", err);
    return (
      <div>
        <EmployeePageHeader title="Payments" description="Could not load — server error." />
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">An unexpected error occurred.</CardContent></Card>
      </div>
    );
  }

  const { summary } = result;

  return (
    <div>
      <EmployeePageHeader
        title="Payments"
        description={`${result.total} payment${result.total === 1 ? "" : "s"}`}
        actions={canManage && (
          <Link href="/employee/payments?new=true"><Button size="sm"><Plus className="h-3.5 w-3.5" aria-hidden /> Record Payment</Button></Link>
        )}
      />

      {/* Summary cards — all calculations server-side */}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total Billed" value={formatMoney(summary.totalBilled, summary.currency)} tone="info" />
        <StatCard label="Total Paid" value={formatMoney(summary.totalPaid, summary.currency)} tone="success" />
        <StatCard label="Outstanding" value={formatMoney(summary.outstanding, summary.currency)} tone="warning" />
        <StatCard label="Pending" value={summary.pending} tone="default" />
      </div>

      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input type="search" name="search" defaultValue={sp.search} placeholder="Search by reference or student…" className="h-9 min-w-[150px] flex-1 rounded-md border border-input bg-background px-3 text-sm" aria-label="Search payments" />
        <select name="status" defaultValue={sp.status ?? ""} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option value="">All statuses</option>
          <option value="PENDING">Pending</option>
          <option value="PAID">Paid</option>
          <option value="PARTIAL">Partial</option>
          <option value="REFUNDED">Refunded</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <select name="method" defaultValue={sp.method ?? ""} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option value="">All methods</option>
          <option value="CASH">Cash</option>
          <option value="BANK_TRANSFER">Bank Transfer</option>
          <option value="BKASH">bKash</option>
          <option value="NAGAD">Nagad</option>
          <option value="CARD">Card</option>
          <option value="OTHER">Other</option>
        </select>
      </div>

      <DataTable
        empty={result.rows.length === 0 ? "No payments match these filters." : undefined}
        headers={
          <tr>
            <Th>Student</Th>
            <Th className="hidden md:table-cell">Application</Th>
            <Th>Amount</Th>
            <Th className="hidden md:table-cell">Method</Th>
            <Th className="hidden lg:table-cell">Reference</Th>
            <Th className="hidden md:table-cell">Date</Th>
            <Th>Status</Th>
            <Th className="hidden xl:table-cell">Recorded by</Th>
            <Th className="text-right"><span className="sr-only">Actions</span></Th>
          </tr>
        }
      >
        {result.rows.map((p) => (
          <tr key={p.id} className="hover:bg-muted/30">
            <Td>
              <Link href={`/employee/students/${p.student.id}`} className="font-medium hover:underline">{p.student.firstName} {p.student.lastName}</Link>
              <p className="text-xs text-muted-foreground">{p.student.studentId}</p>
            </Td>
            <Td className="hidden md:table-cell">
              {p.application ? <Link href={`/employee/applications/${p.application.id}`} className="font-mono text-xs text-primary hover:underline">{p.application.applicationNumber}</Link> : "—"}
            </Td>
            <Td>
              <span className={cn("font-medium", p.status === "REFUNDED" && "text-destructive line-through")}>
                {formatMoney(p.amount, p.currency)}
              </span>
            </Td>
            <Td className="hidden md:table-cell text-muted-foreground">{titleCase(p.paymentMethod.replace(/_/g, " "))}</Td>
            <Td className="hidden lg:table-cell text-muted-foreground font-mono text-xs">{p.transactionReference ?? "—"}</Td>
            <Td className="hidden md:table-cell text-muted-foreground">{p.paymentDate ? formatDate(p.paymentDate) : "—"}</Td>
            <Td><Badge tone={STATUS_TONE[p.status] ?? "default"}>{titleCase(p.status)}</Badge></Td>
            <Td className="hidden xl:table-cell text-muted-foreground">{p.recordedBy?.name ?? "—"}</Td>
            <Td>
              <Link href={`/employee/payments?view=${sp.view ?? ""}&payment=${p.id}`} aria-label="View payment">
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
              return <Link href={`/employee/payments?${params.toString()}`}><Button variant="outline" size="sm">Previous</Button></Link>;
            })()}
            <span className="text-sm font-medium">Page {page} / {result.totalPages}</span>
            {page < result.totalPages && (() => {
              const params = new URLSearchParams();
              for (const [k, v] of Object.entries(sp)) if (v) params.set(k, v);
              params.set("page", String(page + 1));
              return <Link href={`/employee/payments?${params.toString()}`}><Button variant="outline" size="sm">Next</Button></Link>;
            })()}
          </div>
        </nav>
      )}
    </div>
  );
}
