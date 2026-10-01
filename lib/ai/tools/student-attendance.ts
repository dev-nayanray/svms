/**
 * Tool: getStudentAttendance
 * ===========================
 *
 * HONESTY NOTE: SVMS does NOT have an attendance tracking model.
 * This is a study-abroad agency CRM — students interact with
 * counselors, not with classes. Attendance tracking would require
 * the Phase 3 LMS schema extension (ClassSchedule + Attendance models).
 *
 * This tool returns a clear "not available" response so the LLM can
 * explain to the student that this feature doesn't exist in Euroscope.
 *
 * The tool is registered (rather than omitted) so the LLM gets a
 * structured response instead of trying to call a non-existent tool
 * and hallucinating an answer.
 *
 * SECURITY: No database access needed — returns a static response.
 */

import { z } from "zod";
import type { AiTool, ToolContext, ToolResult } from "./types";
import { authorizeStudentOnly, ok, fail } from "./_helpers";

export const getStudentAttendance: AiTool = {
  name: "getStudentAttendance",
  description:
    "Check the student's attendance record. NOTE: Euroscope does not currently track attendance — this is a study-abroad agency CRM, not a school LMS. The tool returns a 'not available' response that the AI should relay to the student. No parameters needed.",
  parameters: z.object({}).strict(),

  async execute(_args: unknown, ctx: ToolContext): Promise<ToolResult> {
    const authError = authorizeStudentOnly(ctx);
    if (authError) return fail(authError);

    // No database query — attendance tracking doesn't exist in SVMS.
    // Return a structured "not available" response.
    return ok({
      available: false,
      reason:
        "Euroscope does not track attendance. This system manages your study-abroad application — documents, visa, appointments with your counselor, and payments. For attendance records, please check with your educational institution directly.",
      suggestion:
        "If you're asking about appointments with your counselor, try asking 'When is my next appointment?' instead.",
    });
  },
};
