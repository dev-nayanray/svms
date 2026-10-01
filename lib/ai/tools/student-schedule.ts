/**
 * Tool: getStudentSchedule
 * =========================
 *
 * Returns the student's upcoming appointments with their counselor.
 *
 * HONESTY NOTE: SVMS does NOT have a class schedule model. The
 * closest analog is `Appointment` — meetings between the student
 * and their assigned counselor (video call, phone call, or in-person).
 * The tool description makes this clear to the LLM.
 *
 * SECURITY:
 *  - `studentId` from `ctx` only.
 *  - Query scoped: `WHERE studentId = ctx.studentId`.
 *  - `meetingLink` stripped by sanitization (could be a private URL).
 *  - Counselor name included (safe), but not their ObjectId.
 *
 * DATA SOURCE: `Appointment` + `Employee` → `User`.
 */

import { z } from "zod";
import { prisma } from "@/lib/db";
import type { AiTool, ToolContext, ToolResult } from "./types";
import { authorizeStudentOnly, ok, fail, internalError } from "./_helpers";

export const getStudentSchedule: AiTool = {
  name: "getStudentSchedule",
  description:
    "Get the student's upcoming appointments with their counselor (video call, phone call, or in-person meeting). NOTE: These are counseling appointments, not class schedules — Euroscope is a study-abroad CRM, not a school LMS. Returns the next appointment + all upcoming appointments. No parameters needed.",
  parameters: z.object({}).strict(),

  async execute(_args: unknown, ctx: ToolContext): Promise<ToolResult> {
    const authError = authorizeStudentOnly(ctx);
    if (authError) return fail(authError);

    try {
      const now = new Date();
      const appointments = await prisma.appointment.findMany({
        where: {
          studentId: ctx.studentId,
          scheduledAt: { gte: now },
          status: { in: ["SCHEDULED", "CONFIRMED"] },
        },
        include: {
          employee: {
            select: {
              title: true,
              user: { select: { name: true } },
            },
          },
        },
        orderBy: { scheduledAt: "asc" },
        take: 10, // Don't return more than 10 upcoming appointments
      });

      if (appointments.length === 0) {
        return ok({
          note: "These are counseling appointments, not class schedules.",
          hasUpcoming: false,
          nextAppointment: null,
          upcoming: [],
          suggestion:
            "You can request an appointment with your counselor from the Appointments page.",
        });
      }

      const formatted = appointments.map(formatAppointment);
      const data = {
        note: "These are counseling appointments, not class schedules.",
        hasUpcoming: true,
        nextAppointment: formatted[0],
        upcoming: formatted,
        count: formatted.length,
      };

      return ok(data);
    } catch (err) {
      return fail(internalError("getStudentSchedule", err));
    }
  },
};

function formatAppointment(a: {
  scheduledAt: Date;
  durationMins: number;
  purpose: string;
  location: string | null;
  meetingMethod: string | null;
  status: string;
  notes: string | null;
  employee: {
    title: string | null;
    user: { name: string };
  };
}) {
  return {
    scheduledAt: a.scheduledAt.toISOString(),
    durationMins: a.durationMins,
    purpose: a.purpose,
    location: a.location,
    meetingMethod: a.meetingMethod,
    status: a.status,
    notes: a.notes,
    counselor: {
      name: a.employee.user.name,
      title: a.employee.title,
    },
  };
}
