import { prisma } from "@/lib/db";
import { TableShell, Pagination, StatusBadge, EmptyState } from "@/components/shared";
import { formatDate } from "@/lib/utils";
import Link from "next/link";

export async function TasksList({
  page = 1,
  basePath,
  assignedToUserId,
}: {
  page?: number;
  basePath: string;
  assignedToUserId?: string;
}) {
  const pageSize = 20;
  const where = assignedToUserId ? { assignedToId: assignedToUserId } : {};
  const [tasks, total] = await Promise.all([
    prisma.task.findMany({
      where,
      include: { student: true, application: true },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.task.count({ where }),
  ]);
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  const now = new Date();

  return (
    <>
      {tasks.length === 0 ? (
        <EmptyState title="No tasks" description="Nothing on your plate right now." />
      ) : (
        <TableShell headers={["Title", "Student", "Priority", "Status", "Due", ""]}>
          {tasks.map((t) => {
            const overdue = t.dueDate && t.dueDate < now && t.status !== "COMPLETED";
            return (
              <tr key={t.id} className="hover:bg-muted/40">
                <td className="px-4 py-2.5 font-medium">{t.title}</td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {t.student ? `${t.student.firstName} ${t.student.lastName}` : "—"}
                </td>
                <td className="px-4 py-2.5"><StatusBadge status={t.priority} /></td>
                <td className="px-4 py-2.5"><StatusBadge status={t.status} /></td>
                <td className={`px-4 py-2.5 ${overdue ? "font-medium text-destructive" : "text-muted-foreground"}`}>
                  {overdue ? "Overdue · " : ""}
                  {formatDate(t.dueDate)}
                </td>
                <td className="px-4 py-2.5">
                  {t.application && (
                    <Link
                      href={`/admin/applications/${t.application.id}`}
                      className="text-xs text-primary hover:underline"
                    >
                      {t.application.applicationNumber}
                    </Link>
                  )}
                </td>
              </tr>
            );
          })}
        </TableShell>
      )}
      <Pagination page={page} totalPages={totalPages} basePath={basePath} />
    </>
  );
}
