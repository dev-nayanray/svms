import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/api";
import type { AuthUser } from "@/lib/auth/guards";
import { auditLog } from "./audit";
import { conversionBlockReason } from "@/lib/constants/leads";

export type LeadListParams = {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  source?: string;
  countryId?: string;
  intake?: string;
  employeeId?: string;
  createdFrom?: Date;
  createdTo?: Date;
  archived?: boolean;
  sortBy?: Record<string, "asc" | "desc">[];
};

export const leadService = {
  async list(params: LeadListParams) {
    const where = {
      deletedAt: null,
      ...(params.archived === undefined ? { archivedAt: null } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(params.source ? { source: params.source } : {}),
      ...(params.countryId ? { interestedCountry: params.countryId } : {}),
      ...(params.intake ? { preferredIntake: params.intake } : {}),
      ...(params.employeeId ? { assignedEmployeeId: params.employeeId } : {}),
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
              { name: { contains: params.search, mode: "insensitive" as const } },
              { email: { contains: params.search, mode: "insensitive" as const } },
              { phone: { contains: params.search } },
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        include: { employee: { include: { user: true } } },
        orderBy: params.sortBy ?? [{ createdAt: "desc" }],
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      prisma.lead.count({ where }),
    ]);
    return { data, total };
  },

  async byId(id: string) {
    const lead = await prisma.lead.findFirst({
      where: { id, deletedAt: null },
      include: {
        employee: { include: { user: true, branch: true } },
      },
    });
    if (!lead) throw new HttpError(404, "NOT_FOUND", "Lead not found");
    return lead;
  },

  async update(
    id: string,
    input: Partial<{
      name: string;
      phone: string;
      email: string;
      interestedCountry: string;
      preferredIntake: string;
      educationLevel: string;
      englishScore: string;
      source: string;
      status: string;
      assignedEmployeeId: string;
      notes: string;
    }>,
    actor: AuthUser
  ) {
    const lead = await prisma.lead.findFirst({ where: { id, deletedAt: null } });
    if (!lead) throw new HttpError(404, "NOT_FOUND", "Lead not found");

    // Converted leads are read-only except for notes
    if (lead.convertedStudentId) {
      const keys = Object.keys(input).filter((k) => k !== "notes" && input[k as keyof typeof input] !== undefined);
      if (keys.length > 0) {
        throw new HttpError(409, "CONFLICT", "Converted leads cannot be modified (notes only)");
      }
    }

    const updated = await prisma.lead.update({
      where: { id },
      data: { ...input, email: input.email || undefined },
    });

    const tracked: (keyof typeof input)[] = ["status", "source", "assignedEmployeeId", "name"];
    await auditLog.record({
      userId: actor.id,
      action: "lead.updated",
      entity: "Lead",
      entityId: id,
      oldValue: Object.fromEntries(tracked.map((k) => [k, (lead as Record<string, unknown>)[k as string]])),
      newValue: Object.fromEntries(tracked.map((k) => [k, (input as Record<string, unknown>)[k as string]])),
    });

    // Status changes are part of the activity timeline
    if (input.status && input.status !== lead.status) {
      await auditLog.record({
        userId: actor.id,
        action: "lead.status_changed",
        entity: "Lead",
        entityId: id,
        oldValue: { status: lead.status },
        newValue: { status: input.status },
      });
    }
    return updated;
  },

  async setArchived(id: string, archived: boolean, actor: AuthUser) {
    const lead = await prisma.lead.findFirst({ where: { id, deletedAt: null } });
    if (!lead) throw new HttpError(404, "NOT_FOUND", "Lead not found");
    if (archived && lead.convertedStudentId) {
      throw new HttpError(409, "CONFLICT", "Converted leads cannot be archived");
    }

    const updated = await prisma.lead.update({
      where: { id },
      data: { archivedAt: archived ? new Date() : null },
    });
    await auditLog.record({
      userId: actor.id,
      action: archived ? "lead.archived" : "lead.unarchived",
      entity: "Lead",
      entityId: id,
    });
    return updated;
  },

  /** Convert to Student: creates the student, links back, prevents duplicates. */
  async convertToStudent(id: string, actor: AuthUser) {
    const lead = await prisma.lead.findFirst({ where: { id, deletedAt: null } });
    if (!lead) throw new HttpError(404, "NOT_FOUND", "Lead not found");

    const reason = conversionBlockReason(lead);
    if (reason) throw new HttpError(409, "CONFLICT", reason);

    // Extra duplicate protection at the database level (email is unique on User)
    const existingUser = await prisma.user.findUnique({
      where: { email: lead.email!.toLowerCase() },
    });
    const existingStudent = existingUser
      ? await prisma.student.findUnique({ where: { userId: existingUser.id } })
      : null;
    if (existingStudent) {
      // Link instead of duplicating, and keep history
      await prisma.lead.update({
        where: { id },
        data: { status: "CONVERTED", convertedStudentId: existingStudent.id },
      });
      await auditLog.record({
        userId: actor.id,
        action: "lead.converted_existing_student",
        entity: "Lead",
        entityId: id,
        newValue: { studentId: existingStudent.id },
      });
      return existingStudent;
    }

    const { studentService } = await import("./student");
    const student = await studentService.create(
      {
        firstName: lead.name.split(" ")[0],
        lastName: lead.name.split(" ").slice(1).join(" ") || "-",
        email: lead.email!,
        phone: lead.phone ?? undefined,
        assignedEmployeeId: lead.assignedEmployeeId ?? undefined,
      },
      actor
    );

    await prisma.lead.update({
      where: { id },
      data: { status: "CONVERTED", convertedStudentId: student.id },
    });
    await auditLog.record({
      userId: actor.id,
      action: "lead.converted",
      entity: "Lead",
      entityId: id,
      newValue: { studentId: student.id, name: lead.name },
    });
    return student;
  },
};
