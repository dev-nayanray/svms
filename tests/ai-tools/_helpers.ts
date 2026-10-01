/**
 * Test helpers for AI tool tests.
 *
 * Provides:
 *  - A mock Prisma setup function (matches the pattern in tests/student-notifications.test.ts)
 *  - A factory for ToolContext objects
 *  - Common fixtures
 */

import type { ToolContext } from "@/lib/ai/tools/types";

/**
 * Create a ToolContext for a student.
 * Override individual fields as needed.
 */
export function makeStudentCtx(overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    studentId: "stu-001",
    userId: "user-001",
    role: "STUDENT",
    requestId: "req-test-001",
    timeoutMs: 5000,
    ...overrides,
  };
}

/**
 * Create a ToolContext for an admin (should be blocked from student tools).
 */
export function makeAdminCtx(overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    studentId: "stu-001", // Admin trying to access student data
    userId: "user-admin",
    role: "ADMIN",
    requestId: "req-test-admin",
    timeoutMs: 5000,
    ...overrides,
  };
}

/**
 * Create a ToolContext for an employee (should also be blocked).
 */
export function makeEmployeeCtx(overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    studentId: "stu-001",
    userId: "user-emp",
    role: "EMPLOYEE",
    requestId: "req-test-emp",
    timeoutMs: 5000,
    ...overrides,
  };
}

/**
 * Standard student fixture for tests.
 */
export const fixtureStudent = {
  id: "stu-001",
  userId: "user-001",
  studentId: "STD-2026-000001",
  firstName: "Karim",
  lastName: "Ahmed",
  email: "karim@example.com",
  phone: "+8801712345678",
  whatsapp: "+8801712345678",
  alternativePhone: null,
  nationality: "Bangladeshi",
  gender: "MALE",
  dateOfBirth: new Date("2000-05-15"),
  address: "House 123, Road 5",
  city: "Dhaka",
  district: "Dhaka",
  division: "Dhaka",
  country: "Bangladesh",
  postalCode: "1212",
  passportNumber: "BP1234567",
  passportIssueDate: new Date("2022-01-01"),
  passportExpiryDate: new Date("2032-01-01"),
  passportIssuingCountry: "Bangladesh",
  emergencyContactName: "Rashid Ahmed",
  emergencyContactPhone: "+8801711111111",
  emergencyContactRelation: "Father",
  profilePhotoUrl: null,
  assignedEmployeeId: "emp-001",
  branchId: "br-001",
  status: "ACTIVE",
  deletedAt: null,
  deletedBy: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

/**
 * Standard academic record fixture.
 */
export const fixtureAcademicRecord = {
  id: "ar-001",
  studentId: "stu-001",
  level: "BACHELOR",
  institution: "University of Dhaka",
  group: "Science",
  subject: "Computer Science",
  result: "3.8/4.0",
  passingYear: 2024,
  certificateUrl: "https://example.com/cert.pdf",
  transcriptUrl: "https://example.com/transcript.pdf",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

/**
 * Standard English proficiency fixture.
 */
export const fixtureEnglishProficiency = {
  id: "ep-001",
  studentId: "stu-001",
  testType: "IELTS",
  overallScore: 7.5,
  readingScore: 8.0,
  writingScore: 7.0,
  listeningScore: 7.5,
  speakingScore: 7.5,
  testDate: new Date("2024-06-15"),
  expiryDate: new Date("2026-06-15"),
  certificateUrl: "https://example.com/ielts.pdf",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

/**
 * Standard notification fixture.
 */
export const fixtureNotification = {
  id: "notif-001",
  userId: "user-001",
  type: "DOCUMENT_APPROVED",
  title: "Document Approved",
  message: "Your passport has been approved.",
  link: "/student/documents",
  readAt: null,
  createdAt: new Date("2026-09-20T10:00:00Z"),
};

/**
 * NOTE: Each test file must define its own `vi.mock("@/lib/db", ...)`
 * at the top level. Vitest requires `vi.mock` calls to be hoisted to
 * the top of the file — they cannot be inside a helper function.
 *
 * See the existing test files for the pattern.
 */

/**
 * Type-narrow a ToolResult to its success branch.
 *
 * Use after `expect(result.ok).toBe(true)` to access `result.data`
 * without TypeScript errors (result.data is `unknown` by default
 * since ToolResult<T> defaults to ToolResult<unknown>).
 *
 * Returns `any` so test assertions can chain freely
 * (e.g. `asOkData(result).courses[0].name`). Type safety in tests
 * is enforced by the assertions, not the type checker.
 *
 * Usage:
 *   const result = await tool.execute({}, ctx);
 *   expect(result.ok).toBe(true);
 *   expect(asOkData(result).firstName).toBe("Karim");
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function asOkData(result: { ok: boolean; data?: unknown }): any {
  if (!result.ok) throw new Error("Expected ok result but got error");
  return result.data;
}

/**
 * Type-narrow a ToolResult to its error branch.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function asError(result: { ok: boolean; error?: unknown }): any {
  if (result.ok) throw new Error("Expected error result but got ok");
  return result.error;
}
