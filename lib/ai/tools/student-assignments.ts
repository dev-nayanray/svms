/**
 * Tool: getStudentAssignments
 * ============================
 *
 * Returns the student's pending tasks.
 *
 * HONESTY NOTE: SVMS does NOT have an academic "Assignment" model.
 * The closest analog is `Task` — but these are counselor-assigned
 * tasks (e.g. "Upload passport copy", "Pay application fee"), not
 * academic assignments. The tool description makes this clear to
 * the LLM so it can set the right expectations with the student.
 *
 * SECURITY:
 *  - `studentId` from `ctx` only.
 *  - Query scoped: `WHERE studentId = ctx.studentId AND deletedAt = null`.
 *  - Internal IDs (assignedToId, applicationId, createdById) stripped.
 *
 * DATA SOURCE: `Task`.
 */

import { z } from "zod";
import { prisma } from "@/lib/db";
import type { AiTool, ToolContext, ToolResult } from "./types";
import { authorizeStudentOnly, ok, fail, internalError } from "./_helpers";

export const getStudentAssignments: AiTool = {
  name: "getStudentAssignments",
  description:
    "Get the student's pending tasks assigned by their counselor (e.g. 'Upload passport', 'Pay application fee'). NOTE: These are application-process tasks, not academic assignments — Euroscope is a study-abroad CRM, not a school LMS. Returns pending, in-progress, and overdue tasks. No parameters needed.",
  parameters: z.object({}).strict(),

  async execute(_args: unknown, ctx: ToolContext): Promise<ToolResult> {
    const authError = authorizeStudentOnly(ctx);
    if (authError) return fail(authError);

    try {
      const tasks = await prisma.task.findMany({
        where: {
          studentId: ctx.studentId,
          deletedAt: null,
          status: { in: ["TODO", "IN_PROGRESS"] },
        },
        orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
      });

      const now = new Date();
      const overdue = tasks.filter(
        (t) => t.dueDate && t.dueDate < now && t.status !== "COMPLETED",
      );
      const dueToday = tasks.filter((t) => {
        if (!t.dueDate) return false;
        const d = new Date(t.dueDate);
        return (
          d.getDate() === now.getDate() &&
          d.getMonth() === now.getMonth() &&
          d.getFullYear() === now.getFullYear()
        );
      });
      const upcoming = tasks.filter((t) => {
        if (!t.dueDate) return true; // no due date = upcoming
        const d = new Date(t.dueDate);
        return d > now && !dueToday.includes(t);
      });

      const data = {
        note: "These are application-process tasks from your counselor, not academic assignments.",
        summary: {
          total: tasks.length,
          overdue: overdue.length,
          dueToday: dueToday.length,
          upcoming: upcoming.length,
        },
        overdue: overdue.map(formatTask),
        dueToday: dueToday.map(formatTask),
        upcoming: upcoming.map(formatTask),
      };

      return ok(data);
    } catch (err) {
      return fail(internalError("getStudentAssignments", err));
    }
  },
};

function formatTask(t: {
  title: string;
  description: string | null;
  priority: string;
  status: string;
  dueDate: Date | null;
  createdAt: Date;
}) {
  return {
    title: t.title,
    description: t.description,
    priority: t.priority,
    status: t.status,
    dueDate: t.dueDate?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
  };
}
