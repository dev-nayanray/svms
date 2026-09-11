import { NextRequest } from "next/server";
import { ok, handleApiError, notFound, fail } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { taskUpdateSchema, taskAssignSchema } from "@/lib/validations";
import { auditLog } from "@/lib/services/audit";
import { notifications } from "@/lib/services/notification";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Get a single task with student + application joins.
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard("tasks.read");
    if (g.error) return g.error;
    const { id } = await params;

    const task = await prisma.task.findFirst({
      where: { id },
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true, studentId: true },
        },
        application: {
          select: { id: true, applicationNumber: true },
        },
      },
    });
    if (!task) throw notFound("Task");

    // Employees can only access their own tasks
    if (g.user.role === "EMPLOYEE" && task.assignedToId !== g.user.id) {
      throw notFound("Task");
    }

    return ok(task);
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * Update a task. This handler serves two purposes:
 *
 * 1. General field edit (title, description, studentId, applicationId,
 *    priority, status, dueDate) — validated by `taskUpdateSchema`.
 *    When `status` is set to COMPLETED, `completedAt` is automatically
 *    set to now; when status moves away from COMPLETED, it's cleared.
 *
 * 2. Assign/reassign — when the body contains `assignedToId`, validated
 *    by `taskAssignSchema`. The old → new assignee is audit-logged as
 *    `task.assigned` and the new assignee is notified.
 *
 * The two paths are mutually exclusive within a single request — if
 * `assignedToId` is present, the assign path runs and other fields are
 * ignored.
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard("tasks.manage");
    if (g.error) return g.error;
    const { id } = await params;
    const raw = (await req.json()) as Record<string, unknown>;

    const task = await prisma.task.findFirst({ where: { id, deletedAt: null } });
    if (!task) throw notFound("Task");

    // Assign path — `assignedToId` in the body triggers the assign flow.
    if (typeof raw.assignedToId === "string") {
      const body = taskAssignSchema.parse(raw);

      const employee = await prisma.employee.findFirst({
        where: { id: body.assignedToId, deletedAt: null },
        include: { user: { select: { name: true } } },
      });
      if (!employee) return fail("NOT_FOUND", "Employee not found", 404);

      const oldAssigneeId = task.assignedToId;
      const updated = await prisma.task.update({
        where: { id },
        data: { assignedToId: body.assignedToId },
      });

      await auditLog.record({
        userId: g.user.id,
        action: "task.assigned",
        entity: "Task",
        entityId: id,
        oldValue: { assignedToId: oldAssigneeId },
        newValue: { assignedToId: body.assignedToId },
      });

      // Notify the new assignee (only if it's a reassignment, not the
      // initial creation which already notified via POST).
      if (oldAssigneeId !== body.assignedToId) {
        await notifications.push({
          userId: body.assignedToId,
          type: "TASK_ASSIGNED",
          title: "Task assigned to you",
          message: `"${task.title}" has been assigned to you.`,
          link: "/employee/tasks",
        });
      }

      return ok(updated);
    }

    // General update path
    const body = taskUpdateSchema.parse(raw);
    const updateData: Record<string, unknown> = { ...body };

    // Handle completedAt automatically
    if (body.status === "COMPLETED" && !task.completedAt) {
      updateData.completedAt = new Date();
    } else if (body.status && body.status !== "COMPLETED" && task.completedAt) {
      updateData.completedAt = null;
    }

    const updated = await prisma.task.update({
      where: { id },
      data: updateData,
    });

    await auditLog.record({
      userId: g.user.id,
      action: "task.updated",
      entity: "Task",
      entityId: id,
      oldValue: {
        title: task.title,
        priority: task.priority,
        status: task.status,
        dueDate: task.dueDate,
      },
      newValue: {
        title: body.title,
        priority: body.priority,
        status: body.status,
        dueDate: body.dueDate,
      },
    });

    // Status changes emit a dedicated audit entry + notifications
    if (body.status && body.status !== task.status) {
      await auditLog.record({
        userId: g.user.id,
        action: "task.status_changed",
        entity: "Task",
        entityId: id,
        oldValue: { status: task.status },
        newValue: { status: body.status },
      });

      if (body.status === "COMPLETED") {
        if (task.createdById && task.createdById !== g.user.id) {
          await notifications.push({
            userId: task.createdById,
            type: "TASK_COMPLETED",
            title: "Task completed",
            message: `"${task.title}" was marked as completed.`,
            link: "/admin/tasks",
          });
        }
      } else if (body.status === "CANCELLED") {
        await notifications.push({
          userId: task.assignedToId,
          type: "TASK_CANCELLED",
          title: "Task cancelled",
          message: `"${task.title}" was cancelled.`,
          link: "/employee/tasks",
        });
      }
    }

    return ok(updated);
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * Archive (soft-delete) a task. Retains the record for audit trails.
 */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard("tasks.manage");
    if (g.error) return g.error;
    const { id } = await params;
    const task = await prisma.task.findFirst({ where: { id, deletedAt: null } });
    if (!task) throw notFound("Task");

    const updated = await prisma.task.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: g.user.id },
    });

    await auditLog.record({
      userId: g.user.id,
      action: "task.archived",
      entity: "Task",
      entityId: id,
      oldValue: { title: task.title, status: task.status },
    });

    return ok({ archived: true, deletedAt: updated.deletedAt });
  } catch (err) {
    return handleApiError(err);
  }
}
