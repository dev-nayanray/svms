import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { EmployeePageHeader } from "@/components/employee/ui";
import { Card, CardContent, Badge } from "@/components/ui";
import { formatDate, titleCase } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function EmployeeTasksPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/employee/tasks");
  const role = (session.user as { role?: string }).role;
  if (role !== "EMPLOYEE" && role !== "ADMIN") redirect("/403");

  // Case ownership: EMPLOYEE sees tasks assigned to them.
  const where = role === "ADMIN" ? {} : { assignedToId: session.user.id };

  const tasks = await prisma.task.findMany({
    where,
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    take: 50,
    include: { student: { select: { firstName: true, lastName: true } } },
  });

  return (
    <div>
      <EmployeePageHeader
        title="Tasks"
        description={role === "ADMIN" ? "All tasks across the platform." : "Tasks assigned to you."}
      />
      <Card>
        <CardContent className="p-0">
          {tasks.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">No tasks found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/30">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Task</th>
                    <th className="hidden px-4 py-2.5 text-left font-medium text-muted-foreground md:table-cell">Student</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Priority</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Status</th>
                    <th className="hidden px-4 py-2.5 text-left font-medium text-muted-foreground md:table-cell">Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {tasks.map((t) => {
                    const overdue = t.dueDate && t.dueDate < new Date() && t.status !== "COMPLETED";
                    return (
                      <tr key={t.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3 font-medium">{t.title}</td>
                        <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                          {t.student ? `${t.student.firstName} ${t.student.lastName}` : "—"}
                        </td>
                        <td className="px-4 py-3"><Badge tone={t.priority === "URGENT" || t.priority === "HIGH" ? "destructive" : t.priority === "LOW" ? "default" : "warning"}>{titleCase(t.priority)}</Badge></td>
                        <td className="px-4 py-3"><Badge tone={t.status === "COMPLETED" ? "success" : t.status === "CANCELLED" ? "destructive" : "info"}>{titleCase(t.status)}</Badge></td>
                        <td className={`hidden px-4 py-3 md:table-cell ${overdue ? "font-medium text-destructive" : "text-muted-foreground"}`}>
                          {t.dueDate ? formatDate(t.dueDate) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
