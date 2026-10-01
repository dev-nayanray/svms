/**
 * Tool: getStudentProfile
 * ========================
 *
 * Returns the authenticated student's profile information.
 *
 * SECURITY:
 *  - `studentId` comes from `ctx` (authenticated session), NEVER from args.
 *  - Query is scoped: `WHERE id = ctx.studentId AND deletedAt = null`.
 *  - Sensitive fields (passport, passwordHash, internal IDs) are
 *    stripped by the sanitization layer in the registry.
 *  - The counselor's name is included (safe), but not their ObjectId.
 *
 * DATA SOURCE: `Student` + `User` + `Employee` (assigned counselor).
 */

import { z } from "zod";
import { prisma } from "@/lib/db";
import type { AiTool, ToolContext, ToolResult } from "./types";
import { authorizeStudentOnly, ok, fail, notFound, internalError } from "./_helpers";

export const getStudentProfile: AiTool = {
  name: "getStudentProfile",
  description:
    "Get the authenticated student's profile information: name, email, phone, nationality, location, student ID, status, and assigned counselor. No parameters needed — the student identity is derived from the session.",
  parameters: z.object({}).strict(),

  async execute(_args: unknown, ctx: ToolContext): Promise<ToolResult> {
    // 1. Authorization: only students can call this tool
    const authError = authorizeStudentOnly(ctx);
    if (authError) return fail(authError);

    try {
      // 2. Fetch the student's own record — scoped by ctx.studentId
      //    NEVER trust a studentId from args (there are none here anyway).
      const student = await prisma.student.findFirst({
        where: {
          id: ctx.studentId,
          deletedAt: null,
        },
        include: {
          user: {
            select: { email: true, name: true },
          },
          employee: {
            // The assigned counselor — include name + title only
            select: {
              title: true,
              user: { select: { name: true, email: true } },
            },
          },
          branch: {
            select: { name: true, code: true },
          },
        },
      });

      if (!student) {
        return fail(notFound("Student profile"));
      }

      // 3. Build a safe response shape (the sanitization layer is a
      //    second line of defense, but we only include safe fields here).
      const data = {
        studentId: student.studentId, // human-readable (e.g. "STD-2026-000001")
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.email,
        phone: student.phone,
        whatsapp: student.whatsapp,
        nationality: student.nationality,
        gender: student.gender,
        dateOfBirth: student.dateOfBirth?.toISOString() ?? null,
        // Location
        address: student.address,
        city: student.city,
        district: student.district,
        division: student.division,
        country: student.country,
        postalCode: student.postalCode,
        // Status
        status: student.status,
        // Counselor (name + title only — no internal IDs)
        assignedCounselor: student.employee
          ? {
              name: student.employee.user.name,
              title: student.employee.title,
              email: student.employee.user.email,
            }
          : null,
        // Branch (name only)
        branch: student.branch
          ? { name: student.branch.name, code: student.branch.code }
          : null,
        // Timestamps
        createdAt: student.createdAt.toISOString(),
        updatedAt: student.updatedAt.toISOString(),
      };

      return ok(data);
    } catch (err) {
      return fail(internalError("getStudentProfile", err));
    }
  },
};
