/**
 * AI Context Builder
 * ===================
 *
 * Builds a safe, PII-free student context that gets injected into
 * the system prompt.
 *
 * SECURITY: This is the ONLY student data the LLM sees directly
 * (without going through a tool). It contains:
 *  - First name (safe — the student knows their own name)
 *  - Application stage (e.g. "DOCUMENT_REVIEW")
 *  - Destination country (e.g. "Germany")
 *  - Applied course name (e.g. "MSc Computer Science")
 *  - Language preference ("en" or "bn")
 *
 * It does NOT contain:
 *  - ObjectId (internal database ID)
 *  - Email, phone, passport number, address
 *  - Other students' data
 *  - Password hashes, tokens, secrets
 */

import "server-only";
import { prisma } from "@/lib/db";

export interface StudentContext {
  firstName: string;
  stage: string | null;
  country: string | null;
  courseName: string | null;
  language: "en" | "bn";
}

/**
 * Build a safe student context for the system prompt.
 *
 * @param studentId — The authenticated student's ID (from session,
 *                    NEVER from client input)
 * @param userId — The authenticated user's ID (for preferences lookup)
 */
export async function buildStudentContext(
  studentId: string,
  _userId: string,
): Promise<StudentContext | null> {
  // Load the student + their most recent active application + preferences
  const [student, application, preferences] = await Promise.all([
    prisma.student.findFirst({
      where: { id: studentId, deletedAt: null },
      select: { firstName: true },
    }),
    prisma.application.findFirst({
      where: { studentId, deletedAt: null, status: "ACTIVE" },
      include: {
        country: { select: { name: true } },
        course: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.studentPreference.findUnique({
      where: { studentId },
      select: { language: true },
    }),
  ]);

  if (!student) return null;

  return {
    firstName: student.firstName,
    stage: application?.stageKey ?? null,
    country: application?.country?.name ?? null,
    courseName: application?.course?.name ?? null,
    language: (preferences?.language as "en" | "bn") ?? "en",
  };
}
