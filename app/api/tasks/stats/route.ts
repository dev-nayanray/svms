import { ok, handleApiError } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { computeTaskStats } from "@/lib/constants/tasks";

/**
 * Returns task performance statistics for the admin dashboard.
 *
 * Aggregates per-employee task counts (pending, overdue, completed,
 * cancelled, total) so the admin dashboard can render an "Employee Task
 * Performance" widget. Only admins can access this endpoint.
 *
 * Also returns the overall team totals for the dashboard KPIs.
 */
export async function GET() {
  try {
    const g = await guard("tasks.read");
    if (g.error) return g.error;

    // Pull all non-archived tasks with the assignee join
    const tasks = await prisma.task.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        status: true,
        dueDate: true,
        assignedToId: true,
      },
    });

    // Overall team totals
    const teamStats = computeTaskStats(tasks);

    // Group by assignee
    const byAssignee = new Map<string, { status: string; dueDate: Date | null }[]>();
    for (const t of tasks) {
      const arr = byAssignee.get(t.assignedToId) ?? [];
      arr.push({ status: t.status, dueDate: t.dueDate });
      byAssignee.set(t.assignedToId, arr);
    }

    // Resolve employee names
    const assigneeIds = [...byAssignee.keys()];
    const employees = assigneeIds.length
      ? await prisma.employee.findMany({
          where: { id: { in: assigneeIds } },
          select: {
            id: true,
            user: { select: { id: true, name: true } },
          },
        })
      : [];
    const employeeMap = new Map(
      employees.map((e) => [e.id, e.user.name]),
    );

    const employeeStats = assigneeIds.map((id) => ({
      employeeId: id,
      employeeName: employeeMap.get(id) ?? "Unknown",
      ...computeTaskStats(byAssignee.get(id) ?? []),
    }));

    // Sort by overdue desc, then pending desc — the employees who need
    // attention surface first.
    employeeStats.sort((a, b) => {
      if (b.overdue !== a.overdue) return b.overdue - a.overdue;
      return b.pending - a.pending;
    });

    return ok({
      team: teamStats,
      employees: employeeStats,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
