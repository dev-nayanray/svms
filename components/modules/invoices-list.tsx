import { prisma } from "@/lib/db";
import { TableShell, Pagination, StatusBadge, EmptyState } from "@/components/shared";
import { formatMoney } from "@/lib/utils";

export async function InvoicesList({
  page = 1,
  basePath,
  studentUserId,
}: {
  page?: number;
  basePath: string;
  studentUserId?: string;
}) {
  const pageSize = 20;
  let studentId: string | undefined;
  if (studentUserId) {
    const student = await prisma.student.findUnique({ where: { userId: studentUserId } });
    studentId = student?.id ?? "none";
  }
  const where = { deletedAt: null, ...(studentId ? { studentId } : {}) };
  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      include: { student: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.invoice.count({ where }),
  ]);
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);

  return (
    <>
      {invoices.length === 0 ? (
        <EmptyState title="No invoices" />
      ) : (
        <TableShell headers={["Invoice", "Student", "Total", "Paid", "Due", "Status"]}>
          {invoices.map((inv) => (
            <tr key={inv.id} className="hover:bg-muted/40">
              <td className="px-4 py-2.5 font-mono text-xs font-medium">{inv.invoiceNumber}</td>
              <td className="px-4 py-2.5">{inv.student.firstName} {inv.student.lastName}</td>
              <td className="px-4 py-2.5">{formatMoney(inv.total)}</td>
              <td className="px-4 py-2.5 text-muted-foreground">{formatMoney(inv.paidAmount)}</td>
              <td className="px-4 py-2.5 font-medium">{formatMoney(inv.dueAmount)}</td>
              <td className="px-4 py-2.5"><StatusBadge status={inv.status} /></td>
            </tr>
          ))}
        </TableShell>
      )}
      <Pagination page={page} totalPages={totalPages} basePath={basePath} />
    </>
  );
}
