import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { HttpError } from "@/lib/api";
import type { AuthUser } from "@/lib/auth/guards";
import { auditLog } from "./audit";
import { slugify } from "@/lib/utils/slug";

export const studentService = {
  /** Scope: employees only see assigned students; admins see all. */
  scopeFilter(user: AuthUser) {
    return user.role === "EMPLOYEE" ? { assignedEmployee: { userId: user.id } } : {};
  },

  async nextStudentId(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await prisma.student.count();
    return `STD-${year}-${String(count + 1).padStart(6, "0")}`;
  },

  async list(params: {
    page: number;
    pageSize: number;
    search?: string;
    status?: string;
    employeeId?: string;
    branchId?: string;
    country?: string;
    appStage?: string;
    createdFrom?: Date;
    createdTo?: Date;
    sortBy?: Record<string, string>;
  }) {
    const where = {
      deletedAt: null,
      ...(params.status ? { status: params.status } : {}),
      ...(params.employeeId ? { assignedEmployeeId: params.employeeId } : {}),
      ...(params.branchId ? { branchId: params.branchId } : {}),
      ...(params.country ? { country: params.country } : {}),
      ...(params.appStage ? { applications: { some: { stageKey: params.appStage, deletedAt: null } } } : {}),
      ...(params.createdFrom || params.createdTo
        ? {
            createdAt: {
              ...(params.createdFrom ? { gte: params.createdFrom } : {}),
              ...(params.createdTo ? { lte: params.createdTo } : {}),
            },
          }
        : {}),
      ...(params.search
        ? {
            OR: [
              { firstName: { contains: params.search, mode: "insensitive" as const } },
              { lastName: { contains: params.search, mode: "insensitive" as const } },
              { email: { contains: params.search, mode: "insensitive" as const } },
              { studentId: { contains: params.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      prisma.student.findMany({
        where,
        include: { employee: { include: { user: true } } },
        orderBy: params.sortBy ?? { createdAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      prisma.student.count({ where }),
    ]);
    return { data, total };
  },

  async byId(id: string) {
    const student = await prisma.student.findFirst({
      where: { id, deletedAt: null },
      include: {
        user: true,
        employee: { include: { user: true } },
        academicRecords: true,
        englishProficiencies: true,
        applications: {
          include: { country: true },
          where: { deletedAt: null },
        },
      },
    });
    if (!student) throw new HttpError(404, "NOT_FOUND", "Student not found");
    return student;
  },

  async create(input: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    password?: string;
    assignedEmployeeId?: string;
    [key: string]: unknown;
  }, actor: AuthUser) {
    const email = input.email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new HttpError(409, "CONFLICT", "A user with this email already exists");

    const passwordHash = await bcrypt.hash(input.password ?? "ChangeMe@123", 10);
    const studentId = await this.nextStudentId();

    const user = await prisma.user.create({
      data: {
        name: `${input.firstName} ${input.lastName}`,
        email,
        phone: input.phone,
        passwordHash,
        roleName: "STUDENT",
        status: "ACTIVE",
      },
    });

    const student = await prisma.student.create({
      data: {
        userId: user.id,
        studentId,
        firstName: input.firstName,
        lastName: input.lastName,
        email,
        phone: input.phone,
        dateOfBirth: (input.dateOfBirth as Date) ?? undefined,
        gender: input.gender as string | undefined,
        nationality: input.nationality as string | undefined,
        address: input.address as string | undefined,
        city: input.city as string | undefined,
        country: input.country as string | undefined,
        passportNumber: input.passportNumber as string | undefined,
        assignedEmployeeId: input.assignedEmployeeId,
      },
    });

    await auditLog.record({
      userId: actor.id,
      action: "student.created",
      entity: "Student",
      entityId: student.id,
      newValue: { studentId, email },
    });
    return student;
  },

  async convertLead(leadId: string, actor: AuthUser) {
    const lead = await prisma.lead.findFirst({ where: { id: leadId, deletedAt: null } });
    if (!lead) throw new HttpError(404, "NOT_FOUND", "Lead not found");
    if (lead.status === "CONVERTED") {
      throw new HttpError(409, "CONFLICT", "Lead is already converted");
    }
    if (!lead.email) throw new HttpError(400, "BAD_REQUEST", "Lead must have an email to convert");

    const student = await this.create(
      {
        firstName: lead.name.split(" ")[0],
        lastName: lead.name.split(" ").slice(1).join(" ") || "-",
        email: lead.email,
        phone: lead.phone ?? undefined,
        assignedEmployeeId: lead.assignedEmployeeId ?? undefined,
      },
      actor
    );

    await prisma.lead.update({
      where: { id: leadId },
      data: { status: "CONVERTED", convertedStudentId: student.id },
    });
    await auditLog.record({
      userId: actor.id,
      action: "lead.converted",
      entity: "Lead",
      entityId: leadId,
      newValue: { studentId: student.id },
    });
    return student;
  },

  /**
   * Update profile fields with audit logging. Status, counselor and branch
   * changes emit dedicated audit events that feed the case-history timeline.
   */
  async update(
    id: string,
    input: Partial<{
      firstName: string;
      lastName: string;
      phone: string;
      dateOfBirth: Date;
      gender: string;
      nationality: string;
      address: string;
      city: string;
      country: string;
      passportNumber: string;
      assignedEmployeeId: string;
      branchId: string;
      status: string;
    }>,
    actor: AuthUser
  ) {
    const student = await prisma.student.findFirst({ where: { id, deletedAt: null } });
    if (!student) throw new HttpError(404, "NOT_FOUND", "Student not found");

    const updated = await prisma.student.update({
      where: { id },
      data: { ...input },
    });

    const tracked = ["assignedEmployeeId", "branchId", "status"] as const;
    await auditLog.record({
      userId: actor.id,
      action: "student.updated",
      entity: "Student",
      entityId: id,
      oldValue: Object.fromEntries(tracked.map((k) => [k, (student as Record<string, unknown>)[k]])),
      newValue: Object.fromEntries(tracked.map((k) => [k, (input as Record<string, unknown>)[k]])),
    });

    if (input.assignedEmployeeId && input.assignedEmployeeId !== student.assignedEmployeeId) {
      await auditLog.record({
        userId: actor.id,
        action: "student.employee_assigned",
        entity: "Student",
        entityId: id,
        oldValue: { employeeId: student.assignedEmployeeId },
        newValue: { employeeId: input.assignedEmployeeId },
      });
    }
    if (input.branchId && input.branchId !== student.branchId) {
      await auditLog.record({
        userId: actor.id,
        action: "student.branch_assigned",
        entity: "Student",
        entityId: id,
        oldValue: { branchId: student.branchId },
        newValue: { branchId: input.branchId },
      });
    }
    if (input.status && input.status !== student.status) {
      await auditLog.record({
        userId: actor.id,
        action: "student.status_changed",
        entity: "Student",
        entityId: id,
        oldValue: { status: student.status },
        newValue: { status: input.status },
      });
    }
    return updated;
  },

  async softDelete(id: string, actor: AuthUser) {
    await prisma.student.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: actor.id },
    });
    await auditLog.record({
      userId: actor.id,
      action: "student.soft_deleted",
      entity: "Student",
      entityId: id,
    });
  },
};

export const universityHelpers = { slugify };
