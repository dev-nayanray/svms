import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { HttpError } from "@/lib/api";
import type { AuthUser } from "@/lib/auth/guards";
import { auditLog } from "./audit";
import { slugify } from "@/lib/utils/slug";

/**
 * Generate a random 12-char temporary password (lowercase + digits).
 * Used by `convertLead` so the new student account has a non-default
 * credential that the counselor communicates out-of-band.
 *
 * The character set is `abcdefghijkmnpqrstuvwxyz23456789` — ambiguous
 * characters (l, 1, 0, O) are excluded so the password is readable
 * when spoken over the phone.
 */
function randomTempPassword(length = 12): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

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
    sortBy?: Record<string, "asc" | "desc">[];
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
        orderBy: params.sortBy ?? [{ createdAt: "desc" }],
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

    // SECURITY: do not fall back to a hardcoded default password. The
    // caller MUST supply one. Lead conversion passes a random temp
    // password (see `convertLead`), and the admin student-create UI
    // requires the field. A missing password is a programmer error
    // and surfaces as a 400 so it can be fixed at the call site
    // rather than silently creating an insecure account.
    if (!input.password) {
      throw new HttpError(400, "BAD_REQUEST", "A password is required to create a student");
    }
    const passwordHash = await bcrypt.hash(input.password, 10);
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
        // Generate a random temp password — the counselor must
        // communicate it to the student out-of-band and the student
        // is forced to change it on first login (the front-end can
        // detect this via a `mustChangePassword` flag on User, but
        // for now we rely on the counselor telling them).
        password: randomTempPassword(),
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
