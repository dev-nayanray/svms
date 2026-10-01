/**
 * Tool: getStudentGPA
 * ====================
 *
 * Attempts to extract GPA from the student's academic records.
 *
 * HONESTY NOTE: The `AcademicRecord.result` field is free-text
 * (e.g. "3.8/4.0", "A+", "85%", "First Class"). SVMS does not have
 * a structured GPA field. This tool parses numeric GPA patterns
 * from the free-text field on a best-effort basis.
 *
 * If no parseable GPA is found, the tool returns `available: false`
 * with a suggestion to ask the student for clarification.
 *
 * SECURITY:
 *  - `studentId` from `ctx` only.
 *  - Read-only query on `AcademicRecord`.
 *
 * DATA SOURCE: `AcademicRecord.result` (free-text, parsed).
 */

import { z } from "zod";
import { prisma } from "@/lib/db";
import type { AiTool, ToolContext, ToolResult } from "./types";
import { authorizeStudentOnly, ok, fail, internalError } from "./_helpers";

export const getStudentGPA: AiTool = {
  name: "getStudentGPA",
  description:
    "Get the student's GPA extracted from their academic records. Attempts to parse numeric GPA values (e.g. 3.8/4.0) from the free-text result field. Returns the most recent parseable GPA, or indicates if no GPA could be extracted. No parameters needed.",
  parameters: z.object({}).strict(),

  async execute(_args: unknown, ctx: ToolContext): Promise<ToolResult> {
    const authError = authorizeStudentOnly(ctx);
    if (authError) return fail(authError);

    try {
      const records = await prisma.academicRecord.findMany({
        where: { studentId: ctx.studentId },
        orderBy: { passingYear: "desc" },
      });

      if (records.length === 0) {
        return ok({
          available: false,
          reason: "No academic records found. Please upload your transcripts in the Documents section.",
          gpa: null,
        });
      }

      // Try to parse a GPA from each record (most recent first)
      for (const rec of records) {
        const parsed = parseGpa(rec.result);
        if (parsed) {
          return ok({
            available: true,
            gpa: parsed.gpa,
            scale: parsed.scale,
            level: rec.level,
            institution: rec.institution,
            passingYear: rec.passingYear,
            rawResult: rec.result,
            note: "GPA was extracted from the free-text result field. If this looks wrong, the student should verify their transcript.",
          });
        }
      }

      // No parseable GPA found — return the raw results so the LLM
      // can explain what's available
      return ok({
        available: false,
        reason: "Your academic records use a non-numeric format (e.g. letter grades or percentages). A numeric GPA could not be automatically extracted.",
        gpa: null,
        rawResults: records.map((r) => ({
          level: r.level,
          institution: r.institution,
          result: r.result,
          passingYear: r.passingYear,
        })),
      });
    } catch (err) {
      return fail(internalError("getStudentGPA", err));
    }
  },
};

/**
 * Parse a GPA from a free-text result string.
 *
 * Recognized patterns:
 *  - "3.8/4.0"     → { gpa: 3.8, scale: 4.0 }
 *  - "3.8"         → { gpa: 3.8, scale: null }
 *  - "GPA: 3.5/4"  → { gpa: 3.5, scale: 4.0 }
 *  - "85%"         → null (percentage, not GPA)
 *  - "A+"          → null (letter grade, not GPA)
 */
function parseGpa(
  result: string | null,
): { gpa: number; scale: number | null } | null {
  if (!result) return null;

  // Pattern 1: "X.Y/Z.W" (explicit scale)
  const withScale = result.match(/(\d+\.?\d*)\s*\/\s*(\d+\.?\d*)/);
  if (withScale) {
    const gpa = parseFloat(withScale[1]);
    const scale = parseFloat(withScale[2]);
    if (gpa >= 0 && gpa <= scale && scale <= 10) {
      return { gpa, scale };
    }
  }

  // Pattern 2: "GPA: X.Y" or "CGPA: X.Y" (no scale, but labeled as GPA)
  const labeled = result.match(/(?:gpa|cgpa)\s*:?\s*(\d+\.?\d*)/i);
  if (labeled) {
    const gpa = parseFloat(labeled[1]);
    if (gpa >= 0 && gpa <= 10) {
      return { gpa, scale: null };
    }
  }

  // Pattern 3: Bare number "3.8" (only if it looks like a GPA: 0-4 range)
  // This is the riskiest pattern — "85" could be a percentage.
  // Only accept if the number is <= 4.0 (typical GPA scale).
  const bare = result.match(/^\s*(\d+\.?\d*)\s*$/);
  if (bare) {
    const gpa = parseFloat(bare[1]);
    if (gpa >= 0 && gpa <= 4.0) {
      return { gpa, scale: null };
    }
  }

  return null;
}
