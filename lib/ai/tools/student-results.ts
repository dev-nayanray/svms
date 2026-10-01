/**
 * Tool: getStudentResults
 * ========================
 *
 * Returns the student's historical academic results + English test scores.
 *
 * HONESTY NOTE: SVMS stores *pre-admission* academic credentials
 * (SSC, HSC, Bachelor, IELTS, TOEFL) — these are records the student
 * uploaded for their application, NOT live school results. There is
 * no `Result` model for enrolled coursework (that would require the
 * Phase 3 LMS schema extension).
 *
 * SECURITY:
 *  - `studentId` from `ctx` only.
 *  - Queries scoped: `WHERE studentId = ctx.studentId`.
 *  - `certificateUrl` / `transcriptUrl` stripped by sanitization.
 *
 * DATA SOURCE: `AcademicRecord` + `EnglishProficiency`.
 */

import { z } from "zod";
import { prisma } from "@/lib/db";
import type { AiTool, ToolContext, ToolResult } from "./types";
import { authorizeStudentOnly, ok, fail, internalError } from "./_helpers";

export const getStudentResults: AiTool = {
  name: "getStudentResults",
  description:
    "Get the student's historical academic records (SSC, HSC, Diploma, Bachelor, Master) and English proficiency test scores (IELTS, TOEFL, PTE, Duolingo). These are pre-admission credentials, not live coursework results. No parameters needed.",
  parameters: z.object({}).strict(),

  async execute(_args: unknown, ctx: ToolContext): Promise<ToolResult> {
    const authError = authorizeStudentOnly(ctx);
    if (authError) return fail(authError);

    try {
      const [academicRecords, englishProficiencies] = await Promise.all([
        prisma.academicRecord.findMany({
          where: { studentId: ctx.studentId },
          orderBy: { passingYear: "desc" },
        }),
        prisma.englishProficiency.findMany({
          where: { studentId: ctx.studentId },
          orderBy: { createdAt: "desc" },
        }),
      ]);

      const data = {
        academicRecords: academicRecords.map((rec) => ({
          level: rec.level,
          institution: rec.institution,
          group: rec.group,
          subject: rec.subject,
          result: rec.result, // free-text (e.g. "3.8/4.0", "A+", "85%")
          passingYear: rec.passingYear,
        })),
        englishProficiency: englishProficiencies.map((test) => ({
          testType: test.testType,
          overallScore: test.overallScore,
          readingScore: test.readingScore,
          writingScore: test.writingScore,
          listeningScore: test.listeningScore,
          speakingScore: test.speakingScore,
          testDate: test.testDate?.toISOString() ?? null,
          expiryDate: test.expiryDate?.toISOString() ?? null,
        })),
      };

      return ok(data);
    } catch (err) {
      return fail(internalError("getStudentResults", err));
    }
  },
};
