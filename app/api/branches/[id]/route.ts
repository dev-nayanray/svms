import { NextRequest } from "next/server";
import { ok, handleApiError, notFound, fail } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { branchUpdateSchema } from "@/lib/validations";
import { auditLog } from "@/lib/services/audit";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Get a single branch with full detail: manager, employees, students,
 * recent applications, recent tasks, and revenue summary. Used by the
 * branch detail page's tabbed sections.
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard("branches.manage");
    if (g.error) return g.error;
    const { id } = await params;

    const branch = await prisma.branch.findFirst({
      where: { id },
      include: {
        manager: {
          select: {
            id: true,
            title: true,
            user: { select: { id: true, name: true, email: true } },
          },
        },
        employees: {
          where: { deletedAt: null },
          select: {
            id: true,
            title: true,
            user: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: "asc" },
          take: 100,
        },
        _count: {
          select: {
            students: { where: { deletedAt: null } },
            employees: { where: { deletedAt: null } },
            users: true,
          },
        },
      },
    });
    if (!branch) throw notFound("Branch");

    // Students at this branch (latest 50)
    const students = await prisma.student.findMany({
      where: { branchId: id, deletedAt: null },
      select: {
        id: true,
        studentId: true,
        firstName: true,
        lastName: true,
        email: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    // Applications for students at this branch (latest 25)
    const studentIds = students.map((s) => s.id);
    const applications = studentIds.length
      ? await prisma.application.findMany({
          where: {
            studentId: { in: studentIds },
            deletedAt: null,
          },
          select: {
            id: true,
            applicationNumber: true,
            stageKey: true,
            status: true,
            priority: true,
            student: {
              select: { id: true, firstName: true, lastName: true, studentId: true },
            },
            country: { select: { id: true, name: true, flag: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 25,
        })
      : [];

    // Tasks assigned to users at this branch (latest 25)
    const userIds = branch.employees.map((e) => e.user.id);
    const tasks = userIds.length
      ? await prisma.task.findMany({
          where: {
            assignedToId: { in: userIds },
            deletedAt: null,
          },
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            dueDate: true,
          },
          orderBy: { createdAt: "desc" },
          take: 25,
        })
      : [];

    // Revenue: sum of payments for students at this branch
    const revenueAgg = studentIds.length
      ? await prisma.payment.aggregate({
          where: {
            studentId: { in: studentIds },
            deletedAt: null,
            status: "PAID",
          },
          _sum: { amount: true },
          _count: true,
        })
      : { _sum: { amount: 0 }, _count: 0 };

    // Outstanding: sum of due amounts for invoices of students at this branch
    const outstandingAgg = studentIds.length
      ? await prisma.invoice.aggregate({
          where: {
            studentId: { in: studentIds },
            deletedAt: null,
            status: { in: ["ISSUED", "PARTIAL", "OVERDUE"] },
          },
          _sum: { dueAmount: true },
          _count: true,
        })
      : { _sum: { dueAmount: 0 }, _count: 0 };

    return ok({
      ...branch,
      students,
      applications,
      tasks,
      revenue: {
        total: revenueAgg._sum.amount ?? 0,
        paymentCount: revenueAgg._count,
        outstanding: outstandingAgg._sum.dueAmount ?? 0,
        outstandingInvoiceCount: outstandingAgg._count,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard("branches.manage");
    if (g.error) return g.error;
    const { id } = await params;
    const body = branchUpdateSchema.parse(await req.json());
    const { archived, ...changes } = body;

    const branch = await prisma.branch.findUnique({ where: { id } });
    if (!branch) throw notFound("Branch");

    // Archive / unarchive path — separate from field updates so the
    // audit trail records the lifecycle event distinctly.
    if (archived !== undefined) {
      if (archived && !branch.deletedAt) {
        const employeeCount = await prisma.employee.count({
          where: { branchId: id, deletedAt: null },
        });
        const studentCount = await prisma.student.count({
          where: { branchId: id, deletedAt: null },
        });
        if (employeeCount > 0 || studentCount > 0) {
          return fail(
            "CONFLICT",
            `Cannot archive: ${employeeCount} employee(s) and ${studentCount} student(s) are assigned to this branch. Reassign them or deactivate the branch instead.`,
            409,
          );
        }
      }
      const updated = await prisma.branch.update({
        where: { id },
        data: {
          deletedAt: archived ? new Date() : null,
          deletedBy: archived ? g.user.id : null,
        },
      });
      await auditLog.record({
        userId: g.user.id,
        action: archived ? "branch.archived" : "branch.unarchived",
        entity: "Branch",
        entityId: id,
        oldValue: { name: branch.name, deletedAt: branch.deletedAt },
        newValue: { deletedAt: updated.deletedAt },
      });
      return ok({ archived });
    }

    // Dedupe-check code on update
    if (changes.code && changes.code !== branch.code) {
      const codeTaken = await prisma.branch.findFirst({
        where: { code: changes.code, NOT: { id } },
      });
      if (codeTaken) return fail("CONFLICT", "Another branch uses this code", 409);
    }

    // Validate the manager if provided
    if (changes.managerId && changes.managerId !== branch.managerId) {
      const employee = await prisma.employee.findFirst({
        where: { id: changes.managerId, deletedAt: null },
      });
      if (!employee) return fail("NOT_FOUND", "Manager (employee) not found", 404);
    }

    const updated = await prisma.branch.update({
      where: { id },
      data: {
        ...changes,
        email: changes.email || undefined,
        address: changes.address || undefined,
        phone: changes.phone || undefined,
        managerId: changes.managerId || undefined,
      },
    });
    await auditLog.record({
      userId: g.user.id,
      action: "branch.updated",
      entity: "Branch",
      entityId: id,
      oldValue: {
        name: branch.name,
        code: branch.code,
        address: branch.address,
        phone: branch.phone,
        email: branch.email,
        managerId: branch.managerId,
        status: branch.status,
      },
      newValue: {
        name: changes.name,
        code: changes.code,
        address: changes.address,
        phone: changes.phone,
        email: changes.email,
        managerId: changes.managerId,
        status: changes.status,
      },
    });
    // Status changes emit a dedicated audit entry
    if (changes.status && changes.status !== branch.status) {
      await auditLog.record({
        userId: g.user.id,
        action: "branch.status_changed",
        entity: "Branch",
        entityId: id,
        oldValue: { status: branch.status },
        newValue: { status: changes.status },
      });
    }
    return ok(updated);
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * Archive (soft delete). Blocked when employees or students are
 * assigned — the admin must reassign them or deactivate the branch.
 */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard("branches.manage");
    if (g.error) return g.error;
    const { id } = await params;
    const branch = await prisma.branch.findFirst({ where: { id } });
    if (!branch) throw notFound("Branch");

    const [employeeCount, studentCount] = await Promise.all([
      prisma.employee.count({ where: { branchId: id, deletedAt: null } }),
      prisma.student.count({ where: { branchId: id, deletedAt: null } }),
    ]);
    if (employeeCount > 0 || studentCount > 0) {
      return fail(
        "CONFLICT",
        `Cannot archive: ${employeeCount} employee(s) and ${studentCount} student(s) are assigned to this branch. Reassign them or deactivate the branch instead.`,
        409,
      );
    }

    await prisma.branch.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: g.user.id },
    });
    await auditLog.record({
      userId: g.user.id,
      action: "branch.archived",
      entity: "Branch",
      entityId: id,
      oldValue: { name: branch.name, code: branch.code },
    });
    return ok({ archived: true });
  } catch (err) {
    return handleApiError(err);
  }
}
