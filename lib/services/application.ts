import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/api";
import type { AuthUser } from "@/lib/auth/guards";
import { auditLog } from "./audit";
import { notifications } from "./notification";
import { formatApplicationNumber } from "@/lib/constants/applications";

export const DEFAULT_STAGES = [
  "LEAD",
  "COUNSELING",
  "PROFILE_ASSESSMENT",
  "COUNTRY_SELECTION",
  "UNIVERSITY_SELECTION",
  "DOCUMENT_COLLECTION",
  "APPLICATION_SUBMITTED",
  "CONDITIONAL_OFFER",
  "UNCONDITIONAL_OFFER",
  "DEPOSIT_PAYMENT",
  "CONFIRMATION",
  "VISA_PREPARATION",
  "VISA_SUBMITTED",
  "BIOMETRICS",
  "INTERVIEW",
  "VISA_DECISION",
  "TRAVEL_PREPARATION",
  "COMPLETED",
] as const;

export const applicationService = {
  async nextApplicationNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await prisma.application.count();
    return formatApplicationNumber(year, count + 1);
  },

  async list(params: {
    page: number;
    pageSize: number;
    search?: string;
    stageKey?: string;
    status?: string;
    countryId?: string;
    universityId?: string;
    courseId?: string;
    intakeId?: string;
    employeeId?: string;
    branchId?: string;
    priority?: string;
    studentId?: string;
    createdFrom?: Date;
    createdTo?: Date;
    sortBy?: Record<string, string>;
  }) {
    const where = {
      deletedAt: null,
      ...(params.status ? { status: params.status } : {}),
      ...(params.stageKey ? { stageKey: params.stageKey } : {}),
      ...(params.countryId ? { countryId: params.countryId } : {}),
      ...(params.universityId ? { universityId: params.universityId } : {}),
      ...(params.courseId ? { courseId: params.courseId } : {}),
      ...(params.intakeId ? { intakeId: params.intakeId } : {}),
      ...(params.employeeId ? { employeeId: params.employeeId } : {}),
      ...(params.priority ? { priority: params.priority } : {}),
      ...(params.studentId ? { studentId: params.studentId } : {}),
      ...(params.branchId ? { student: { branchId: params.branchId } } : {}),
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
            applicationNumber: { contains: params.search, mode: "insensitive" as const },
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      prisma.application.findMany({
        where,
        include: {
          student: true,
          country: true,
        },
        orderBy: params.sortBy ?? { createdAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      prisma.application.count({ where }),
    ]);
    return { data, total };
  },

  async byId(id: string) {
    const app = await prisma.application.findFirst({
      where: { id, deletedAt: null },
      include: {
        student: { include: { user: true } },
        country: true,
        statusHistory: { orderBy: { createdAt: "desc" } },
        documents: { where: { deletedAt: null } },
        payments: { where: { deletedAt: null } },
        invoices: { where: { deletedAt: null } },
        tasks: true,
        notes: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!app) throw new HttpError(404, "NOT_FOUND", "Application not found");
    return app;
  },

  /** Employees may only manage their own or assigned-students' cases; students only their own. */
  async assertCanAccess(user: AuthUser, application: { employeeId: string | null; studentId: string }) {
    if (user.role === "ADMIN") return;

    if (user.role === "EMPLOYEE") {
      const emp = await prisma.employee.findUnique({ where: { userId: user.id } });
      if (emp && application.employeeId === emp.id) return;
      const student = await prisma.student.findFirst({
        where: { id: application.studentId, assignedEmployeeId: emp?.id, deletedAt: null },
      });
      if (student) return;
      throw new HttpError(403, "FORBIDDEN", "You are not assigned to this case");
    }

    const student = await prisma.student.findUnique({ where: { userId: user.id } });
    if (!student || student.id !== application.studentId) {
      throw new HttpError(403, "FORBIDDEN", "You do not have access to this application");
    }
  },

  async create(
    input: {
      studentId: string;
      countryId: string;
      employeeId?: string;
      universityId?: string;
      courseId?: string;
      intakeId?: string;
      priority?: string;
    },
    actor: AuthUser
  ) {
    const student = await prisma.student.findFirst({
      where: { id: input.studentId, deletedAt: null },
    });
    if (!student) throw new HttpError(404, "NOT_FOUND", "Student not found");

    const applicationNumber = await this.nextApplicationNumber();
    const employeeId =
      input.employeeId ??
      student.assignedEmployeeId ??
      (await prisma.employee.findUnique({ where: { userId: actor.id } }))?.id;

    const app = await prisma.application.create({
      data: {
        applicationNumber,
        studentId: input.studentId,
        employeeId,
        countryId: input.countryId,
        universityId: input.universityId,
        courseId: input.courseId,
        intakeId: input.intakeId,
        priority: input.priority ?? "MEDIUM",
        stageKey: "LEAD",
        statusHistory: {
          create: {
            fromStage: null,
            toStage: "LEAD",
            changedById: actor.id,
            note: "Application created",
          },
        },
      },
    });

    await auditLog.record({
      userId: actor.id,
      action: "application.created",
      entity: "Application",
      entityId: app.id,
      newValue: { applicationNumber },
    });
    return app;
  },

  async changeStage(
    id: string,
    stageKey: string,
    note: string | undefined,
    actor: AuthUser
  ) {
    const app = await prisma.application.findFirst({ where: { id, deletedAt: null } });
    if (!app) throw new HttpError(404, "NOT_FOUND", "Application not found");

    const stage = await prisma.applicationStage.findUnique({ where: { key: stageKey } });
    if (!stage || !stage.enabled) {
      throw new HttpError(400, "BAD_REQUEST", "Invalid or disabled stage");
    }

    await this.assertCanAccess(actor, app);

    const [updated] = await prisma.$transaction([
      prisma.application.update({
        where: { id },
        data: {
          stageKey,
          submissionDate:
            stageKey === "APPLICATION_SUBMITTED" ? new Date() : app.submissionDate,
          decisionDate: stageKey === "COMPLETED" ? new Date() : app.decisionDate,
        },
      }),
      prisma.applicationStatusHistory.create({
        data: {
          applicationId: id,
          fromStage: app.stageKey,
          toStage: stageKey,
          changedById: actor.id,
          note,
        },
      }),
    ]);

    // Notify the student
    const student = await prisma.student.findUnique({ where: { id: app.studentId } });
    if (student) {
      await notifications.push({
        userId: student.userId,
        type: "APPLICATION_STAGE_CHANGED",
        title: "Application updated",
        message: `Your application ${app.applicationNumber} moved to ${stage.name}.`,
        link: `/student/applications/${id}`,
      });
    }

    await auditLog.record({
      userId: actor.id,
      action: "application.stage_changed",
      entity: "Application",
      entityId: id,
      oldValue: { stageKey: app.stageKey },
      newValue: { stageKey },
    });
    return updated;
  },
};
