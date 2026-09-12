import { NextRequest } from "next/server";
import { ok, handleApiError, fail } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { counselingRequestSchema } from "@/lib/validations";
import { isUniversityVisibleToStudent } from "@/lib/constants/universities";
import { auditLog } from "@/lib/services/audit";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";

/**
 * POST — student-initiated counseling request tied to a university. The
 * request is routed to the student's assigned counselor; if no counselor
 * is assigned, the request still lands and is visible to admins.
 *
 * Server-side guards:
 *  - the student must have an active Student profile
 *  - the target university must be student-visible
 *  - if a courseId is provided, it must belong to the target university
 *  - duplicate pending counseling requests are blocked (one open per
 *    student+university) — the student must wait for the existing one to
 *    be resolved/archived before filing a new one for the same university.
 */
export async function POST(req: NextRequest) {
  try {
    // Rate-limit counseling requests to prevent spam — 10 bursts per
    // IP, +1 token / 30s.
    const limited = rateLimit(req, RATE_LIMIT_PRESETS.counselingRequest, "counseling");
    if (limited) return limited as Response;

    const g = await guard("student.counseling");
    if (g.error) return g.error;

    const body = counselingRequestSchema.parse(await req.json());
    const student = await prisma.student.findUnique({
      where: { userId: g.user.id },
      select: { id: true, assignedEmployeeId: true, firstName: true, lastName: true },
    });
    if (!student) return fail("NOT_FOUND", "Student profile not set up", 404);

    const university = await prisma.university.findFirst({
      where: { id: body.universityId },
      include: { country: true },
    });
    if (!university || !isUniversityVisibleToStudent(university)) {
      return fail("NOT_FOUND", "University not available", 404);
    }

    if (body.courseId) {
      const course = await prisma.course.findFirst({
        where: { id: body.courseId, universityId: body.universityId, deletedAt: null },
      });
      if (!course) return fail("NOT_FOUND", "Course not found at this university", 404);
    }

    // Block duplicate open requests for the same student+university. A
    // student can re-file after their counselor marks the prior one
    // RESOLVED or ARCHIVED.
    const open = await prisma.counselingRequest.findFirst({
      where: {
        studentId: student.id,
        universityId: body.universityId,
        status: { in: ["PENDING", "CONTACTED"] },
      },
      select: { id: true, status: true },
    });
    if (open) {
      return fail(
        "CONFLICT",
        `You already have a ${open.status.toLowerCase()} counseling request for this university. Wait for your counselor to respond.`,
        409,
        { existingStatus: open.status },
      );
    }

    const request = await prisma.counselingRequest.create({
      data: {
        studentId: student.id,
        universityId: body.universityId,
        courseId: body.courseId,
        message: body.message,
      },
    });

    // Notify the assigned counselor (if any) so they can act fast.
    if (student.assignedEmployeeId) {
      const emp = await prisma.employee.findUnique({
        where: { id: student.assignedEmployeeId },
        select: { userId: true },
      });
      if (emp) {
        await prisma.notification.create({
          data: {
            userId: emp.userId,
            type: "COUNSELING_REQUEST",
            title: "New counseling request",
            message: `${student.firstName} ${student.lastName} requested counseling for ${university.name}.`,
            link: `/employee/students`,
          },
        });
      }
    }

    await auditLog.record({
      userId: g.user.id,
      action: "counseling_request.created",
      entity: "CounselingRequest",
      entityId: request.id,
      newValue: {
        studentId: student.id,
        universityId: body.universityId,
        courseId: body.courseId,
      },
    });

    return ok({ id: request.id, status: request.status }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
