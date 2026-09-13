import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────
// Mocks: prisma + auth stubbed so we can drive every code path.
// ─────────────────────────────────────────────

const prismaMock = vi.hoisted(() => ({
  student: {
    findFirst: vi.fn(),
    count: vi.fn(),
    findMany: vi.fn(),
  },
  visaApplication: {
    findMany: vi.fn(),
  },
  note: {
    create: vi.fn(),
  },
}));

const authMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));

import {
  getStudentById,
  requireStudent,
  buildStudentTimeline,
  buildStudentTimelineForUser,
  type StudentDetail,
} from "@/lib/services/student-cases";
import { HttpError } from "@/lib/api";
import type { EmployeeScope } from "@/lib/services/employee-dashboard";

const ADMIN_SCOPE: EmployeeScope = { isAdmin: true, userId: "u-admin", employeeId: null };
const EMPLOYEE_SCOPE: EmployeeScope = { isAdmin: false, userId: "u-emp", employeeId: "emp-1" };

beforeEach(() => {
  vi.clearAllMocks();
});

// Helper: build a complete StudentDetail fixture with sensible defaults so
// every test doesn't need to repeat the full 25-field shape.
function makeStudent(overrides: Partial<StudentDetail> = {}): StudentDetail {
  return {
    id: "stu-1",
    userId: "u-stu-1",
    studentId: "STD-2026-000001",
    firstName: "Karim",
    lastName: "Ahmed",
    email: "karim@example.com",
    phone: "+8801711111111",
    dateOfBirth: null,
    gender: null,
    nationality: "Bangladeshi",
    country: "Bangladesh",
    city: "Dhaka",
    address: null,
    postalCode: null,
    passportNumber: null,
    passportIssueDate: null,
    passportExpiryDate: null,
    passportIssuingCountry: null,
    avatar: null,
    status: "ACTIVE",
    createdAt: new Date("2026-08-01"),
    updatedAt: new Date("2026-08-10"),
    assignedEmployeeId: "emp-1",
    assignedEmployee: null,
    applications: [],
    documents: [],
    payments: [],
    invoices: [],
    tasks: [],
    conversations: [],
    visaApplications: [],
    appointments: [],
    academicRecords: [],
    englishProficiencies: [],
    notes: [],
    ...overrides,
  };
}

// ─────────────────────────────────────────────
// Valid student — full 360 aggregate loads
// ─────────────────────────────────────────────

describe("Student 360 — valid student loads the full aggregate", () => {
  it("returns academic records, english proficiency, notes, and avatar", async () => {
    const fakeStudent = makeStudent({
      academicRecords: [
        { id: "ar-1", level: "BACHELOR", institution: "Dhaka University", group: null, subject: "CSE", passingYear: 2024, result: "3.85", certificateUrl: null, createdAt: new Date("2026-08-05"), updatedAt: new Date("2026-08-05") },
      ],
      englishProficiencies: [
        { id: "ep-1", testType: "IELTS", overallScore: 7.5, readingScore: 8, writingScore: 7, listeningScore: 8.5, speakingScore: 7, testDate: new Date("2026-07-01"), expiryDate: null, certificateUrl: null, createdAt: new Date("2026-08-05"), updatedAt: new Date("2026-08-05") },
      ],
      notes: [
        { id: "n-1", body: "Wants to study in Germany", visibility: "INTERNAL", pinned: true, authorId: "u-emp", createdAt: new Date("2026-08-06"), updatedAt: new Date("2026-08-06") },
      ],
    });
    prismaMock.student.findFirst.mockResolvedValue({ ...fakeStudent, user: { avatar: "data:image/png;base64,xxx" } });
    prismaMock.visaApplication.findMany.mockResolvedValue([]);

    const result = await getStudentById(EMPLOYEE_SCOPE, "stu-1");
    expect(result).not.toBeNull();
    expect(result?.academicRecords).toHaveLength(1);
    expect(result?.academicRecords[0].institution).toBe("Dhaka University");
    expect(result?.englishProficiencies).toHaveLength(1);
    expect(result?.englishProficiencies[0].overallScore).toBe(7.5);
    expect(result?.notes).toHaveLength(1);
    expect(result?.notes[0].pinned).toBe(true);
    expect(result?.avatar).toBe("data:image/png;base64,xxx");
  });

  it("includes passport fields when present", async () => {
    const fakeStudent = makeStudent({
      passportNumber: "AB1234567",
      passportIssueDate: new Date("2020-01-01"),
      passportExpiryDate: new Date("2030-01-01"),
      passportIssuingCountry: "Bangladesh",
    });
    prismaMock.student.findFirst.mockResolvedValue({ ...fakeStudent, user: { avatar: null } });
    prismaMock.visaApplication.findMany.mockResolvedValue([]);

    const result = await getStudentById(EMPLOYEE_SCOPE, "stu-1");
    expect(result?.passportNumber).toBe("AB1234567");
    expect(result?.passportIssuingCountry).toBe("Bangladesh");
  });
});

// ─────────────────────────────────────────────
// Invalid / missing ID — IDOR closure (foreign → null → 404)
// ─────────────────────────────────────────────

describe("Student 360 — invalid / unauthorized / archived / IDOR", () => {
  it("returns null for a missing student id (404 in the page)", async () => {
    prismaMock.student.findFirst.mockResolvedValue(null);
    prismaMock.visaApplication.findMany.mockResolvedValue([]);
    const result = await getStudentById(EMPLOYEE_SCOPE, "stu-does-not-exist");
    expect(result).toBeNull();
  });

  it("returns null when the student is assigned to another employee (IDOR closure)", async () => {
    // The where-clause includes the case-ownership filter, so Prisma returns
    // null for foreign students — same shape as missing. The page renders 404.
    prismaMock.student.findFirst.mockResolvedValue(null);
    prismaMock.visaApplication.findMany.mockResolvedValue([]);
    const result = await getStudentById(EMPLOYEE_SCOPE, "stu-other-employee");
    expect(result).toBeNull();
    const call = prismaMock.student.findFirst.mock.calls[0][0];
    expect(call.where.assignedEmployee).toEqual({ userId: "u-emp" });
  });

  it("requireStudent throws HttpError 404 for missing/foreign students", async () => {
    prismaMock.student.findFirst.mockResolvedValue(null);
    prismaMock.visaApplication.findMany.mockResolvedValue([]);
    await expect(requireStudent(EMPLOYEE_SCOPE, "stu-missing")).rejects.toThrow(HttpError);
    await expect(requireStudent(EMPLOYEE_SCOPE, "stu-missing")).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
    });
  });

  it("ADMIN bypasses the case-ownership filter — sees any student", async () => {
    prismaMock.student.findFirst.mockResolvedValue(null);
    prismaMock.visaApplication.findMany.mockResolvedValue([]);
    await getStudentById(ADMIN_SCOPE, "stu-anything");
    const call = prismaMock.student.findFirst.mock.calls[0][0];
    expect(call.where.id).toBe("stu-anything");
    expect(call.where.assignedEmployee).toBeUndefined();
  });

  it("returns an archived (INACTIVE) student when the caller owns them", async () => {
    const archived = makeStudent({ status: "INACTIVE" });
    prismaMock.student.findFirst.mockResolvedValue({ ...archived, user: { avatar: null } });
    prismaMock.visaApplication.findMany.mockResolvedValue([]);
    const result = await getStudentById(EMPLOYEE_SCOPE, "stu-archived");
    expect(result?.status).toBe("INACTIVE");
  });

  it("returns a suspended student when the caller owns them", async () => {
    const suspended = makeStudent({ status: "SUSPENDED" });
    prismaMock.student.findFirst.mockResolvedValue({ ...suspended, user: { avatar: null } });
    prismaMock.visaApplication.findMany.mockResolvedValue([]);
    const result = await getStudentById(EMPLOYEE_SCOPE, "stu-suspended");
    expect(result?.status).toBe("SUSPENDED");
  });
});

// ─────────────────────────────────────────────
// Missing relationships — every tab still renders (empty state)
// ─────────────────────────────────────────────

describe("Student 360 — missing relationships / empty tabs", () => {
  it("returns empty arrays for every relation when the student is fresh", async () => {
    const empty = makeStudent();
    prismaMock.student.findFirst.mockResolvedValue({ ...empty, user: { avatar: null } });
    prismaMock.visaApplication.findMany.mockResolvedValue([]);
    const result = await getStudentById(EMPLOYEE_SCOPE, "stu-1");
    expect(result?.applications).toEqual([]);
    expect(result?.documents).toEqual([]);
    expect(result?.payments).toEqual([]);
    expect(result?.invoices).toEqual([]);
    expect(result?.tasks).toEqual([]);
    expect(result?.conversations).toEqual([]);
    expect(result?.appointments).toEqual([]);
    expect(result?.visaApplications).toEqual([]);
    expect(result?.academicRecords).toEqual([]);
    expect(result?.englishProficiencies).toEqual([]);
    expect(result?.notes).toEqual([]);
  });

  it("timeline returns only the synthetic profile_updated event when no relationships exist", () => {
    const empty = makeStudent();
    const all = buildStudentTimeline(empty);
    // The synthetic profile_updated event is the only item.
    expect(all).toHaveLength(1);
    expect(all[0].kind).toBe("profile_updated");
    expect(all[0].internal).toBe(true);
  });

  it("user-facing timeline (no audit.read) hides the internal profile_updated event", () => {
    const empty = makeStudent();
    const filtered = buildStudentTimelineForUser(empty, false);
    expect(filtered).toEqual([]);
  });

  it("user-facing timeline (with audit.read) keeps the internal event", () => {
    const empty = makeStudent();
    const filtered = buildStudentTimelineForUser(empty, true);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].kind).toBe("profile_updated");
  });
});

// ─────────────────────────────────────────────
// Timeline — academic / english / notes events
// ─────────────────────────────────────────────

describe("buildStudentTimeline — new event kinds", () => {
  it("emits academic_added events with institution + passing year", () => {
    const student = makeStudent({
      academicRecords: [
        { id: "ar-1", level: "BACHELOR", institution: "Dhaka University", group: null, subject: "CSE", passingYear: 2024, result: "3.85", certificateUrl: null, createdAt: new Date("2026-08-05"), updatedAt: new Date("2026-08-05") },
      ],
    });
    const items = buildStudentTimeline(student);
    const academic = items.find((i) => i.kind === "academic_added");
    expect(academic).toBeDefined();
    expect(academic!.title).toContain("BACHELOR");
    expect(academic!.detail).toContain("Dhaka University");
    expect(academic!.detail).toContain("2024");
  });

  it("emits english_added events with test type + overall score", () => {
    const student = makeStudent({
      englishProficiencies: [
        { id: "ep-1", testType: "IELTS", overallScore: 7.5, readingScore: 8, writingScore: 7, listeningScore: 8.5, speakingScore: 7, testDate: new Date("2026-07-01"), expiryDate: null, certificateUrl: null, createdAt: new Date("2026-08-05"), updatedAt: new Date("2026-08-05") },
      ],
    });
    const items = buildStudentTimeline(student);
    const english = items.find((i) => i.kind === "english_added");
    expect(english).toBeDefined();
    expect(english!.title).toContain("IELTS");
    expect(english!.detail).toContain("7.5");
  });

  it("emits note_added events with pinned marker", () => {
    const student = makeStudent({
      notes: [
        { id: "n-1", body: "Top priority case", visibility: "INTERNAL", pinned: true, authorId: "u-emp", createdAt: new Date("2026-08-06"), updatedAt: new Date("2026-08-06") },
        { id: "n-2", body: "Regular update", visibility: "STUDENT", pinned: false, authorId: "u-emp", createdAt: new Date("2026-08-07"), updatedAt: new Date("2026-08-07") },
      ],
    });
    const items = buildStudentTimeline(student);
    const pinned = items.find((i) => i.title.includes("Pinned"));
    expect(pinned).toBeDefined();
    // INTERNAL note is flagged internal; STUDENT note is not.
    const internalNote = items.find((i) => i.kind === "note_added" && i.detail.includes("Top priority"));
    expect(internalNote?.internal).toBe(true);
    const studentNote = items.find((i) => i.kind === "note_added" && i.detail.includes("Regular update"));
    expect(studentNote?.internal).toBe(false);
  });
});

// ─────────────────────────────────────────────
// Timeline — permission filtering
// ─────────────────────────────────────────────

describe("buildStudentTimelineForUser — permission filtering", () => {
  it("strips INTERNAL events when the caller lacks audit.read", () => {
    const student = makeStudent({
      notes: [
        { id: "n-1", body: "Confidential", visibility: "INTERNAL", pinned: false, authorId: "u-emp", createdAt: new Date("2026-08-06"), updatedAt: new Date("2026-08-06") },
      ],
    });
    const filtered = buildStudentTimelineForUser(student, false);
    // The INTERNAL note + the synthetic profile_updated are both stripped.
    expect(filtered.filter((i) => i.kind === "note_added")).toEqual([]);
    expect(filtered.filter((i) => i.kind === "profile_updated")).toEqual([]);
  });

  it("keeps INTERNAL events when the caller has audit.read", () => {
    const student = makeStudent({
      notes: [
        { id: "n-1", body: "Confidential", visibility: "INTERNAL", pinned: false, authorId: "u-emp", createdAt: new Date("2026-08-06"), updatedAt: new Date("2026-08-06") },
      ],
    });
    const filtered = buildStudentTimelineForUser(student, true);
    expect(filtered.find((i) => i.kind === "note_added")).toBeDefined();
    expect(filtered.find((i) => i.kind === "profile_updated")).toBeDefined();
  });

  it("keeps STUDENT-visible notes regardless of audit.read", () => {
    const student = makeStudent({
      notes: [
        { id: "n-1", body: "Visible to student", visibility: "STUDENT", pinned: false, authorId: "u-emp", createdAt: new Date("2026-08-06"), updatedAt: new Date("2026-08-06") },
      ],
    });
    expect(buildStudentTimelineForUser(student, false).find((i) => i.kind === "note_added")).toBeDefined();
    expect(buildStudentTimelineForUser(student, true).find((i) => i.kind === "note_added")).toBeDefined();
  });
});

// ─────────────────────────────────────────────
// Error propagation
// ─────────────────────────────────────────────

describe("Student 360 — error propagation", () => {
  it("getStudentById lets prisma errors bubble (never swallows)", async () => {
    prismaMock.student.findFirst.mockRejectedValue(new Error("DB connection lost"));
    await expect(getStudentById(EMPLOYEE_SCOPE, "stu-1")).rejects.toThrow("DB connection lost");
  });

  it("requireStudent lets the underlying error bubble when not a 404 case", async () => {
    prismaMock.student.findFirst.mockRejectedValue(new Error("findFirst failed"));
    await expect(requireStudent(EMPLOYEE_SCOPE, "stu-1")).rejects.toThrow("findFirst failed");
  });
});
