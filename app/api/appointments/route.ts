import { NextRequest } from "next/server";
import { ok, handleApiError, fail, sortFrom } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { paginationSchema } from "@/lib/validations";
import { auditLog } from "@/lib/services/audit";
import { notifications } from "@/lib/services/notification";
import { z } from "zod";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  studentId: z.string().min(1, "Student is required"),
  employeeId: z.string().min(1, "Counselor is required"),
  scheduledAt: z.string().datetime(),
  durationMins: z.number().int().min(5).max(480).optional(),
  purpose: z.string().trim().min(3, "Purpose must be at least 3 characters").max(200),
  location: z.string().trim().max(200).optional(),
  meetingMethod: z.enum(["IN_PERSON", "VIDEO_CALL", "PHONE_CALL"]).optional(),
  meetingLink: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(2000).optional(),
});

/**
 * GET /api/appointments
 *
 * Admin/Employee appointment list. Supports filters:
 *  - search (student name, purpose)
 *  - status (SCHEDULED, CONFIRMED, COMPLETED, CANCELLED, NO_SHOW, REQUESTED)
 *  - employeeId
 *  - studentId
 *  - view: upcoming / past / requested / all
 *
 * Employees are auto-scoped to their own appointments — admins see all.
 */
export async function GET(req: NextRequest) {
  try {
    const g = await guard(); // any authenticated user with appointments.read
    if (g.error) return g.error;

    const sp = req.nextUrl.searchParams;
    const params = paginationSchema.parse({
      page: sp.get("page") ?? 1,
      pageSize: sp.get("pageSize") ?? 20,
      search: sp.get("search") ?? undefined,
      status: sp.get("status") ?? undefined,
    });

    const employeeId = sp.get("employeeId") ?? undefined;
    const studentId = sp.get("studentId") ?? undefined;
    const view = sp.get("view") ?? "all";
    const now = new Date();

    const where: Record<string, unknown> = {};

    // Employees scoped to their own appointments; admins see all
    if (g.user.role === "EMPLOYEE") {
      where.employeeId = g.user.id;
    } else if (employeeId) {
      where.employeeId = employeeId;
    }

    if (studentId) where.studentId = studentId;
    if (params.status) where.status = params.status;

    // View filter
    if (view === "upcoming") {
      where.status = { in: ["SCHEDULED", "CONFIRMED"] };
      where.scheduledAt = { gte: now };
    } else if (view === "past") {
      where.OR = [
        { status: { in: ["COMPLETED", "NO_SHOW"] } },
        { status: { in: ["SCHEDULED", "CONFIRMED"] }, scheduledAt: { lt: now } },
      ];
    } else if (view === "requested") {
      where.status = "REQUESTED";
    } else if (view === "cancelled") {
      where.status = "CANCELLED";
    }

    // Search across student name + purpose
    if (params.search) {
      const s = params.search.trim();
      where.OR = [
        { purpose: { contains: s, mode: "insensitive" } },
        { student: { firstName: { contains: s, mode: "insensitive" } } },
        { student: { lastName: { contains: s, mode: "insensitive" } } },
      ];
    }

    const orderBy = sortFrom(sp, ["scheduledAt", "createdAt", "updatedAt"], { scheduledAt: "asc" });

    const [rows, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        include: {
          student: {
            select: { id: true, firstName: true, lastName: true, studentId: true, email: true },
          },
          employee: {
            include: { user: { select: { id: true, name: true } } },
          },
        },
        orderBy,
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      prisma.appointment.count({ where }),
    ]);

    return ok({
      data: rows,
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

/**
 * POST /api/appointments
 *
 * Admin/Employee creates a new appointment (SCHEDULED status).
 * Notifies the student.
 */
export async function POST(req: NextRequest) {
  try {
    const g = await guard();
    if (g.error) return g.error;

    const body = createSchema.parse(await req.json().catch(() => ({})));

    // Verify student + employee exist
    const [student, employee] = await Promise.all([
      prisma.student.findFirst({ where: { id: body.studentId, deletedAt: null } }),
      prisma.employee.findFirst({ where: { id: body.employeeId, deletedAt: null } }),
    ]);
    if (!student) return fail("VALIDATION_ERROR", "Student not found", 422);
    if (!employee) return fail("VALIDATION_ERROR", "Counselor not found", 422);

    const created = await prisma.appointment.create({
      data: {
        studentId: body.studentId,
        employeeId: body.employeeId,
        scheduledAt: new Date(body.scheduledAt),
        durationMins: body.durationMins ?? 30,
        purpose: body.purpose,
        location: body.location ?? null,
        meetingMethod: body.meetingMethod ?? null,
        meetingLink: body.meetingLink ?? null,
        notes: body.notes ?? null,
        status: "SCHEDULED",
      },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, studentId: true, email: true } },
        employee: { include: { user: { select: { id: true, name: true } } } },
      },
    });

    await auditLog.record({
      userId: g.user.id,
      action: "appointment.created",
      entity: "Appointment",
      entityId: created.id,
      newValue: { purpose: body.purpose, scheduledAt: body.scheduledAt },
    });

    // Notify the student
    await notifications.push({
      userId: student.userId,
      type: "APPOINTMENT_CONFIRMED",
      title: "New appointment scheduled",
      message: `Your counselor has scheduled an appointment: ${body.purpose} on ${new Date(body.scheduledAt).toLocaleString()}.`,
      link: "/student/appointments",
    });

    return ok({ data: created }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
