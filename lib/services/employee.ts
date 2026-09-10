import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { HttpError } from "@/lib/api";
import type { AuthUser } from "@/lib/auth/guards";
import { auditLog } from "./audit";

export const employeeService = {
  async list(params: {
    page: number;
    pageSize: number;
    search?: string;
    branchId?: string;
    sortBy?: Record<string, string>;
  }) {
    const where = {
      deletedAt: null,
      ...(params.branchId ? { branchId: params.branchId } : {}),
      ...(params.search
        ? {
            user: {
              OR: [
                { name: { contains: params.search, mode: "insensitive" as const } },
                { email: { contains: params.search, mode: "insensitive" as const } },
              ],
            },
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        include: {
          user: true,
          branch: true,
          _count: { select: { students: true, leads: true } },
        },
        orderBy: params.sortBy?.name
          ? { user: { [params.sortBy.name]: Object.values(params.sortBy)[0] } }
          : { createdAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      prisma.employee.count({ where }),
    ]);
    return { data, total };
  },

  async create(
    input: {
      name: string;
      email: string;
      phone?: string;
      title?: string;
      branchId?: string;
      password: string;
    },
    actor: AuthUser
  ) {
    const email = input.email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new HttpError(409, "CONFLICT", "A user with this email already exists");

    const passwordHash = await bcrypt.hash(input.password, 10);
    const user = await prisma.user.create({
      data: {
        name: input.name,
        email,
        phone: input.phone,
        passwordHash,
        roleName: "EMPLOYEE",
        status: "ACTIVE",
        branchId: input.branchId,
        emailVerifiedAt: new Date(),
      },
    });
    const employee = await prisma.employee.create({
      data: { userId: user.id, branchId: input.branchId, title: input.title },
    });

    await auditLog.record({
      userId: actor.id,
      action: "employee.created",
      entity: "Employee",
      entityId: employee.id,
      newValue: { name: input.name, email },
    });
    return employee;
  },

  async update(
    id: string,
    input: {
      name?: string;
      phone?: string;
      title?: string;
      branchId?: string;
      status?: string;
    },
    actor: AuthUser
  ) {
    const employee = await prisma.employee.findFirst({ where: { id, deletedAt: null } });
    if (!employee) throw new HttpError(404, "NOT_FOUND", "Employee not found");

    const updated = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: employee.userId },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.phone !== undefined ? { phone: input.phone } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
        },
      });
      return tx.employee.update({
        where: { id },
        data: {
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.branchId !== undefined ? { branchId: input.branchId } : {}),
        },
        include: { user: true },
      });
    });

    await auditLog.record({
      userId: actor.id,
      action: "employee.updated",
      entity: "Employee",
      entityId: id,
      oldValue: { title: employee.title, branchId: employee.branchId },
      newValue: { title: input.title, branchId: input.branchId, status: input.status },
    });
    return updated;
  },

  async softDelete(id: string, actor: AuthUser) {
    const employee = await prisma.employee.findFirst({ where: { id, deletedAt: null } });
    if (!employee) throw new HttpError(404, "NOT_FOUND", "Employee not found");

    await prisma.employee.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: actor.id },
    });
    await prisma.user.update({
      where: { id: employee.userId },
      data: { status: "INACTIVE" },
    });
    await auditLog.record({
      userId: actor.id,
      action: "employee.soft_deleted",
      entity: "Employee",
      entityId: id,
    });
  },
};
