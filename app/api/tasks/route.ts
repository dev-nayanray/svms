import { NextRequest } from "next/server";
import { ok, handleApiError, fail, sortFrom } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { taskSchema, paginationSchema } from "@/lib/validations";
import { auditLog } from "@/lib/services/audit";
import { notifications } from "@/lib/services/notification";
import {
  buildAdminTaskWhere,
  TASK_SORT_KEYS,
  type TaskView,
} from "@/lib/constants/tasks";

/**
 * Admin task list endpoint.
 *
 * Returns tasks with full filters: search (title, description), status,
 * priority, assignedToId, studentId, applicationId, plus the 5 views
 * (all, today, upcoming, overdue, completed). Sorting via the `sortFrom`
 * allow-list. Pagination server-side. Soft-deleted records are excluded
 * by default; the `?archived=true` toggle shows them.
 *
 * Employees are auto-scoped to their own tasks — admins see all.
 */
export async function GET(req: NextRequest) {
  try {
    const g = await guard("tasks.read");
    if (g.error) return g.error;
    const sp = req.nextUrl.searchParams;
    const params = paginationSchema.parse({
      page: sp.get("page") ?? 1,
      pageSize: sp.get("pageSize") ?? 20,
      search: sp.get("search") ?? undefined,
      status: sp.get("status") ?? undefined,
    });

    const archived = sp.get("archived") === "true";
    const view = (sp.get("view") ?? "all") as TaskView;

    // Employees are auto-scoped to their own tasks unless they explicitly
    // request a different assignee (which they can't — only admins can).
    const assignedToId =
      g.user.role === "EMPLOYEE"
        ? g.user.id
        : sp.get("assignedToId") ?? undefined;

    const where = buildAdminTaskWhere({
      search: params.search,
      status: params.status,
      priority: sp.get("priority") ?? undefined,
      assignedToId,
      studentId: sp.get("studentId") ?? undefined,
      applicationId: sp.get("applicationId") ?? undefined,
      view,
      archived,
    });

    const [data, total] = await Promise.all([
      prisma.task.findMany({
        where,
        include: {
          student: {
            select: { id: true, firstName: true, lastName: true, studentId: true },
          },
          application: {
            select: { id: true, applicationNumber: true },
          },
        },
        orderBy: sortFrom(sp, [...TASK_SORT_KEYS], { dueDate: "asc" }),
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      prisma.task.count({ where }),
    ]);
    return ok({
      data,
      pagination: {
        page: params.page,
        pageSize: params.pageSize,
        total,
        totalPages: Math.max(Math.ceil(total / params.pageSize), 1),
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const g = await guard("tasks.manage");
    if (g.error) return g.error;
    const body = taskSchema.parse(await req.json());

    // Validate the assignee exists + is active
    const employee = await prisma.employee.findFirst({
      where: { id: body.assignedToId, deletedAt: null },
      include: { user: { select: { name: true } } },
    });
    if (!employee) return fail("NOT_FOUND", "Employee not found", 404);

    const task = await prisma.task.create({
      data: { ...body, createdById: g.user.id },
    });

    // Notify the assignee
    await notifications.push({
      userId: body.assignedToId,
      type: "TASK_ASSIGNED",
      title: "New task assigned",
      message: body.title,
      link: "/employee/tasks",
    });

    await auditLog.record({
      userId: g.user.id,
      action: "task.created",
      entity: "Task",
      entityId: task.id,
      newValue: {
        title: body.title,
        assignedToId: body.assignedToId,
        priority: body.priority,
        dueDate: body.dueDate,
      },
    });
    return ok(task, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
