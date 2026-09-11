import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { fail, HttpError } from "@/lib/api";
import { prisma } from "@/lib/db";

export type StudentProfile = NonNullable<Awaited<ReturnType<typeof loadStudentProfile>>>;

async function loadStudentProfile(userId: string) {
  return prisma.student.findFirst({
    where: { userId, deletedAt: null },
  });
}

/**
 * Server-component guard: only STUDENT role may enter /student pages, and the
 * signed-in user must have a linked student profile. Everyone else is
 * redirected — authorization happens here, server-side, not in the client.
 */
export async function requireStudentProfile(): Promise<{ userId: string; name: string; student: StudentProfile }> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "STUDENT") redirect("/403");

  const student = await loadStudentProfile(session.user.id);
  if (!student) redirect("/403");

  return {
    userId: session.user.id,
    name: session.user.name ?? `${student.firstName} ${student.lastName}`,
    student,
  };
}

/**
 * API-route guard: resolves the caller's own student profile from the session.
 * Never accepts a studentId from the client — the profile is always derived
 * from the authenticated user, which closes IDOR on student-scoped reads.
 *
 * Returns a 401/403 error response for unauthenticated / non-student callers.
 */
export async function studentApiGuard(): Promise<
  | { ok: true; userId: string; student: StudentProfile }
  | { ok: false; error: ReturnType<typeof fail> }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: fail("UNAUTHORIZED", "Authentication required", 401) };
  }
  if (session.user.role !== "STUDENT") {
    return { ok: false, error: fail("FORBIDDEN", "Students only", 403) };
  }
  const student = await loadStudentProfile(session.user.id);
  if (!student) {
    return { ok: false, error: fail("FORBIDDEN", "No student profile linked to this account", 403) };
  }
  return { ok: true, userId: session.user.id, student };
}

/**
 * Throwing variant for service code already wrapped in handleApiError.
 * Verifies the caller owns the given student record before returning it.
 */
export async function requireOwnedStudent(studentId: string): Promise<StudentProfile> {
  const session = await auth();
  if (!session?.user?.id) throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
  if (session.user.role !== "STUDENT") throw new HttpError(403, "FORBIDDEN", "Students only");

  const student = await prisma.student.findFirst({
    where: { id: studentId, deletedAt: null },
  });
  if (!student || student.userId !== session.user.id) {
    // Missing and foreign records are indistinguishable on purpose —
    // never confirm the existence of another student's data.
    throw new HttpError(404, "NOT_FOUND", "Student record not found");
  }
  return student;
}
