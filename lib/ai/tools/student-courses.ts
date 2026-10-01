/**
 * Tool: getStudentCourses
 * ========================
 *
 * Returns the courses the student has applied to.
 *
 * HONESTY NOTE: SVMS is a study-abroad CRM, not a school LMS.
 * There is no "enrolled courses" model. This tool returns the
 * courses the student has *applied* to via `Application.course`.
 *
 * SECURITY:
 *  - `studentId` from `ctx` only.
 *  - Query scoped: `WHERE studentId = ctx.studentId AND deletedAt = null`.
 *  - Internal IDs (applicationId, courseId, universityId, countryId)
 *    are stripped by the sanitization layer.
 *
 * DATA SOURCE: `Application` → `Course` → `University` + `Country`.
 */

import { z } from "zod";
import { prisma } from "@/lib/db";
import type { AiTool, ToolContext, ToolResult } from "./types";
import { authorizeStudentOnly, ok, fail, internalError } from "./_helpers";

export const getStudentCourses: AiTool = {
  name: "getStudentCourses",
  description:
    "Get the courses the student has applied to (university, degree level, duration, tuition fee, application status). In SVMS, students apply to courses — they are not 'enrolled' until accepted. No parameters needed.",
  parameters: z.object({}).strict(),

  async execute(_args: unknown, ctx: ToolContext): Promise<ToolResult> {
    const authError = authorizeStudentOnly(ctx);
    if (authError) return fail(authError);

    try {
      const applications = await prisma.application.findMany({
        where: {
          studentId: ctx.studentId,
          deletedAt: null,
        },
        include: {
          course: {
            include: {
              university: { select: { name: true, city: true, ranking: true } },
            },
          },
          country: { select: { name: true, flag: true } },
          intake: { select: { name: true, month: true, year: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      const data = {
        totalApplications: applications.length,
        courses: applications.map((app) => ({
          applicationNumber: app.applicationNumber,
          status: app.status,
          stage: app.stageKey,
          priority: app.priority,
          submittedAt: app.submissionDate?.toISOString() ?? null,
          course: app.course
            ? {
                name: app.course.name,
                degreeLevel: app.course.degreeLevel,
                duration: app.course.duration,
                tuitionFee: app.course.tuitionFee,
                currency: app.course.currency,
                englishRequirement: app.course.ieltsRequirement,
              }
            : null,
          university: app.course?.university
            ? {
                name: app.course.university.name,
                city: app.course.university.city,
                ranking: app.course.university.ranking,
              }
            : null,
          country: app.country
            ? { name: app.country.name, flag: app.country.flag }
            : null,
          intake: app.intake
            ? { name: app.intake.name, month: app.intake.month, year: app.intake.year }
            : null,
        })),
      };

      return ok(data);
    } catch (err) {
      return fail(internalError("getStudentCourses", err));
    }
  },
};
