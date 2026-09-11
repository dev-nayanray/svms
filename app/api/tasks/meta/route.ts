import { ok, handleApiError } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import {
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_VIEWS,
  TASK_VIEW_LABELS,
} from "@/lib/constants/tasks";

/**
 * Returns the filter options for the admin tasks UI: the list of
 * employees and students that have at least one task, plus the
 * canonical status/priority/view enums + labels.
 */
export async function GET() {
  try {
    const g = await guard("tasks.read");
    if (g.error) return g.error;

    const [employees, students] = await Promise.all([
      prisma.employee.findMany({
        where: {
          deletedAt: null,
          user: { status: "ACTIVE" },
        },
        select: {
          id: true,
          user: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
        take: 200,
      }),
      prisma.student.findMany({
        where: {
          deletedAt: null,
          tasks: { some: { deletedAt: null } },
        },
        select: { id: true, firstName: true, lastName: true, studentId: true },
        orderBy: { firstName: "asc" },
        take: 200,
      }),
    ]);

    const statuses = TASK_STATUSES.map((s) => ({
      value: s,
      label: TASK_STATUS_LABELS[s],
    }));
    const priorities = TASK_PRIORITIES.map((p) => ({
      value: p,
      label: TASK_PRIORITY_LABELS[p],
    }));
    const views = TASK_VIEWS.map((v) => ({
      value: v,
      label: TASK_VIEW_LABELS[v],
    }));

    return ok({
      employees: employees.map((e) => ({ id: e.id, name: e.user.name })),
      students: students.map((s) => ({
        id: s.id,
        label: `${s.firstName} ${s.lastName} (${s.studentId})`,
      })),
      statuses,
      priorities,
      views,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
