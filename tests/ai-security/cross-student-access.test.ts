/**
 * Cross-Student Access Security Tests
 * =====================================
 *
 * Verifies that Student A can NEVER access Student B's data through
 * ANY AI tool. This is the most critical security test file — it
 * tests the core IDOR (Insecure Direct Object Reference) prevention.
 *
 * ARCHITECTURE UNDER TEST:
 *   Authenticated user → determine student identity (from session)
 *   → authorize access → execute appropriate tool → return data
 *
 * The tool layer receives `studentId` from `ToolContext`, which is
 * derived from the NextAuth session. The LLM CANNOT override this
 * — even if it sends `{ studentId: "stu-B" }` as a tool argument,
 * the ToolRegistry strips it before the tool sees it.
 *
 * TEST SCENARIOS (per the user's request):
 *   Student A must never receive Student B's:
 *     ✓ GPA
 *     ✓ results
 *     ✓ courses
 *     ✓ attendance
 *     ✓ assignments
 *     ✓ profile
 *     ✓ notifications
 *
 * Method: For each tool, we set up mock data for TWO students (A + B),
 * then call the tool with Student A's context. We verify that:
 *   1. Student A gets their OWN data (correct data returned)
 *   2. Student A NEVER gets Student B's data (no cross-contamination)
 *   3. The Prisma query was scoped by Student A's studentId (not B's)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────
//
// We mock Prisma so each model returns different data depending on
// which studentId is queried. This lets us verify that Student A's
// query returns Student A's data — never Student B's.

const mockStudentFindFirst = vi.fn();
const mockAppFindMany = vi.fn();
const mockArFindMany = vi.fn();
const mockEpFindMany = vi.fn();
const mockTaskFindMany = vi.fn();
const mockApptFindMany = vi.fn();
const mockNotifCount = vi.fn();
const mockNotifFindMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    student: { findFirst: (...a: unknown[]) => mockStudentFindFirst(...a) },
    application: { findMany: (...a: unknown[]) => mockAppFindMany(...a) },
    academicRecord: { findMany: (...a: unknown[]) => mockArFindMany(...a) },
    englishProficiency: { findMany: (...a: unknown[]) => mockEpFindMany(...a) },
    task: { findMany: (...a: unknown[]) => mockTaskFindMany(...a) },
    appointment: { findMany: (...a: unknown[]) => mockApptFindMany(...a) },
    notification: {
      count: (...a: unknown[]) => mockNotifCount(...a),
      findMany: (...a: unknown[]) => mockNotifFindMany(...a),
    },
  },
}));

// ── Imports (after mocks) ────────────────────────────────────────

import { getStudentProfile } from "@/lib/ai/tools/student-profile";
import { getStudentCourses } from "@/lib/ai/tools/student-courses";
import { getStudentResults } from "@/lib/ai/tools/student-results";
import { getStudentGPA } from "@/lib/ai/tools/student-gpa";
import { getStudentAttendance } from "@/lib/ai/tools/student-attendance";
import { getStudentAssignments } from "@/lib/ai/tools/student-assignments";
import { getStudentSchedule } from "@/lib/ai/tools/student-schedule";
import { getStudentNotifications } from "@/lib/ai/tools/student-notifications";
import { ToolRegistry } from "@/lib/ai/tools/registry";
import { _resetToolRateLimitForTests } from "@/lib/ai/tools/rate-limit";
import type { ToolContext } from "@/lib/ai/tools/types";
import { asOkData } from "../ai-tools/_helpers";

// ── Fixtures: Two students with DIFFERENT data ───────────────────

const studentA = {
  id: "stu-A-001",
  userId: "user-A-001",
  studentId: "STD-2026-000001",
  firstName: "Alice",
  lastName: "Anderson",
  email: "alice@example.com",
  phone: "+8801711111111",
  nationality: "Bangladeshi",
  status: "ACTIVE",
  deletedAt: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

const studentB = {
  id: "stu-B-002",
  userId: "user-B-002",
  studentId: "STD-2026-000002",
  firstName: "Bob",
  lastName: "Brown",
  email: "bob@example.com",
  phone: "+8801722222222",
  nationality: "Bangladeshi",
  status: "ACTIVE",
  deletedAt: null,
  createdAt: new Date("2026-02-01"),
  updatedAt: new Date("2026-02-01"),
};

// Student A's academic records (GPA 3.8)
const studentA_academicRecords = [
  { id: "ar-A-1", studentId: "stu-A-001", level: "BACHELOR", institution: "University of Dhaka", result: "3.8/4.0", passingYear: 2024, group: null, subject: "Computer Science", certificateUrl: null, transcriptUrl: null, createdAt: new Date(), updatedAt: new Date() },
];

// Student B's academic records (GPA 3.2 — DIFFERENT)
const studentB_academicRecords = [
  { id: "ar-B-1", studentId: "stu-B-002", level: "BACHELOR", institution: "BUET", result: "3.2/4.0", passingYear: 2023, group: null, subject: "Electrical Engineering", certificateUrl: null, transcriptUrl: null, createdAt: new Date(), updatedAt: new Date() },
];

// Student A's notifications
const studentA_notifications = [
  { id: "notif-A-1", userId: "user-A-001", type: "DOCUMENT_APPROVED", title: "Alice's passport approved", message: "Your passport has been approved.", link: "/student/documents", readAt: null, createdAt: new Date("2026-09-20T10:00:00Z") },
];

// Student B's notifications
const studentB_notifications = [
  { id: "notif-B-1", userId: "user-B-002", type: "PAYMENT_CONFIRMED", title: "Bob's payment confirmed", message: "Your payment of $500 has been confirmed.", link: "/student/payments", readAt: null, createdAt: new Date("2026-09-21T10:00:00Z") },
];

// ── Context factories ────────────────────────────────────────────

function makeCtx(studentId: string, userId: string): ToolContext {
  return {
    studentId,
    userId,
    role: "STUDENT",
    requestId: `req-test-${studentId}`,
    timeoutMs: 5000,
  };
}

const ctxA = makeCtx("stu-A-001", "user-A-001");
const ctxB = makeCtx("stu-B-002", "user-B-002");

// ── Mock setup helper ────────────────────────────────────────────

/**
 * Set up mocks so that queries for studentA return studentA's data,
 * and queries for studentB return studentB's data.
 *
 * The mock functions inspect the `where.studentId` (or `where.id` for
 * Student model) to determine which student's data to return.
 */
function setupMocksForBothStudents() {
  // Student profile — returns different student based on where.id
  mockStudentFindFirst.mockImplementation((args: { where: { id: string } }) => {
    if (args.where.id === "stu-A-001") {
      return Promise.resolve({ ...studentA, user: { email: studentA.email, name: "Alice Anderson" }, employee: null, branch: null });
    }
    if (args.where.id === "stu-B-002") {
      return Promise.resolve({ ...studentB, user: { email: studentB.email, name: "Bob Brown" }, employee: null, branch: null });
    }
    return Promise.resolve(null);
  });

  // Academic records — returns different records based on where.studentId
  mockArFindMany.mockImplementation((args: { where: { studentId: string } }) => {
    if (args.where.studentId === "stu-A-001") return Promise.resolve(studentA_academicRecords);
    if (args.where.studentId === "stu-B-002") return Promise.resolve(studentB_academicRecords);
    return Promise.resolve([]);
  });

  // English proficiency — both have different scores
  mockEpFindMany.mockImplementation((args: { where: { studentId: string } }) => {
    if (args.where.studentId === "stu-A-001") {
      return Promise.resolve([{ id: "ep-A-1", studentId: "stu-A-001", testType: "IELTS", overallScore: 7.5, readingScore: 8.0, writingScore: 7.0, listeningScore: 7.5, speakingScore: 7.5, testDate: new Date("2024-06-15"), expiryDate: new Date("2026-06-15"), certificateUrl: null, createdAt: new Date(), updatedAt: new Date() }]);
    }
    if (args.where.studentId === "stu-B-002") {
      return Promise.resolve([{ id: "ep-B-1", studentId: "stu-B-002", testType: "TOEFL", overallScore: 90, readingScore: 22, writingScore: 24, listeningScore: 22, speakingScore: 22, testDate: new Date("2024-07-20"), expiryDate: new Date("2026-07-20"), certificateUrl: null, createdAt: new Date(), updatedAt: new Date() }]);
    }
    return Promise.resolve([]);
  });

  // Applications — different courses
  mockAppFindMany.mockImplementation((args: { where: { studentId: string } }) => {
    if (args.where.studentId === "stu-A-001") {
      return Promise.resolve([{ id: "app-A-1", applicationNumber: "SV-2026-000001", studentId: "stu-A-001", stageKey: "DOCUMENT_REVIEW", status: "ACTIVE", priority: "HIGH", submissionDate: new Date("2026-09-01"), deletedAt: null, course: { id: "crs-A", name: "MSc Computer Science", degreeLevel: "MASTER", duration: "2 years", tuitionFee: 15000, currency: "EUR", ieltsRequirement: "6.5", university: { name: "TU Munich", city: "Munich", ranking: 50 } }, country: { name: "Germany", flag: "🇩🇪" }, intake: { name: "Winter 2026", month: 10, year: 2026 } }]);
    }
    if (args.where.studentId === "stu-B-002") {
      return Promise.resolve([{ id: "app-B-1", applicationNumber: "SV-2026-000002", studentId: "stu-B-002", stageKey: "LEAD", status: "ACTIVE", priority: "MEDIUM", submissionDate: null, deletedAt: null, course: { id: "crs-B", name: "BSc Mechanical Engineering", degreeLevel: "BACHELOR", duration: "4 years", tuitionFee: 12000, currency: "EUR", ieltsRequirement: "6.0", university: { name: "TU Berlin", city: "Berlin", ranking: 100 } }, country: { name: "Germany", flag: "🇩🇪" }, intake: null }]);
    }
    return Promise.resolve([]);
  });

  // Tasks — different tasks
  mockTaskFindMany.mockImplementation((args: { where: { studentId: string } }) => {
    if (args.where.studentId === "stu-A-001") {
      return Promise.resolve([{ id: "t-A-1", title: "Alice: Upload passport", description: "Color scan", priority: "HIGH", status: "TODO", dueDate: new Date(Date.now() + 86400000), createdAt: new Date(), deletedAt: null }]);
    }
    if (args.where.studentId === "stu-B-002") {
      return Promise.resolve([{ id: "t-B-1", title: "Bob: Pay application fee", description: "€100", priority: "URGENT", status: "TODO", dueDate: new Date(Date.now() - 86400000), createdAt: new Date(), deletedAt: null }]);
    }
    return Promise.resolve([]);
  });

  // Appointments — different appointments
  mockApptFindMany.mockImplementation((args: { where: { studentId: string } }) => {
    if (args.where.studentId === "stu-A-001") {
      return Promise.resolve([{ id: "appt-A-1", scheduledAt: new Date(Date.now() + 86400000), durationMins: 30, purpose: "Alice's document review", location: "Online", meetingMethod: "VIDEO_CALL", meetingLink: "https://meet.example.com/alice", status: "CONFIRMED", notes: "Bring passport", cancelledAt: null, cancelledBy: null, cancelReason: null, completedAt: null, createdAt: new Date(), updatedAt: new Date(), employee: { title: "Counselor", user: { name: "Sarah J" } } }]);
    }
    if (args.where.studentId === "stu-B-002") {
      return Promise.resolve([{ id: "appt-B-1", scheduledAt: new Date(Date.now() + 172800000), durationMins: 45, purpose: "Bob's visa consultation", location: "Office", meetingMethod: "IN_PERSON", meetingLink: null, status: "SCHEDULED", notes: null, cancelledAt: null, cancelledBy: null, cancelReason: null, completedAt: null, createdAt: new Date(), updatedAt: new Date(), employee: { title: "Senior Counselor", user: { name: "Mike K" } } }]);
    }
    return Promise.resolve([]);
  });

  // Notifications — different notifications
  // Note: Notification model uses userId, not studentId. The tool
  // resolves userId from the studentId first.
  mockNotifCount.mockImplementation((args: { where: { userId: string } }) => {
    if (args.where.userId === "user-A-001") return Promise.resolve(1);
    if (args.where.userId === "user-B-002") return Promise.resolve(1);
    return Promise.resolve(0);
  });

  mockNotifFindMany.mockImplementation((args: { where: { userId: string } }) => {
    if (args.where.userId === "user-A-001") return Promise.resolve(studentA_notifications);
    if (args.where.userId === "user-B-002") return Promise.resolve(studentB_notifications);
    return Promise.resolve([]);
  });
}

// ── Tests ────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  _resetToolRateLimitForTests();
  setupMocksForBothStudents();
});

describe("Cross-Student Access Security", () => {
  describe("1. Profile — Student A must NOT receive Student B's profile", () => {
    it("Student A gets their OWN profile (Alice, not Bob)", async () => {
      const result = await getStudentProfile.execute({}, ctxA);
      expect(result.ok).toBe(true);
      expect(asOkData(result).firstName).toBe("Alice");
      expect(asOkData(result).firstName).not.toBe("Bob");
      expect(asOkData(result).email).toBe("alice@example.com");
      expect(asOkData(result).email).not.toBe("bob@example.com");
    });

    it("Student B gets their OWN profile (Bob, not Alice)", async () => {
      const result = await getStudentProfile.execute({}, ctxB);
      expect(result.ok).toBe(true);
      expect(asOkData(result).firstName).toBe("Bob");
      expect(asOkData(result).email).toBe("bob@example.com");
    });

    it("Profile query uses ctx.studentId (Student A's ID, not B's)", async () => {
      await getStudentProfile.execute({}, ctxA);
      expect(mockStudentFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ id: "stu-A-001" }) }),
      );
      expect(mockStudentFindFirst).not.toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ id: "stu-B-002" }) }),
      );
    });
  });

  describe("2. Courses — Student A must NOT receive Student B's courses", () => {
    it("Student A gets their OWN course (MSc Computer Science, not BSc Mechanical)", async () => {
      const result = await getStudentCourses.execute({}, ctxA);
      expect(result.ok).toBe(true);
      expect(asOkData(result).courses[0].course.name).toBe("MSc Computer Science");
      expect(asOkData(result).courses[0].course.name).not.toBe("BSc Mechanical Engineering");
    });

    it("Student B gets their OWN course (BSc Mechanical, not MSc CS)", async () => {
      const result = await getStudentCourses.execute({}, ctxB);
      expect(result.ok).toBe(true);
      expect(asOkData(result).courses[0].course.name).toBe("BSc Mechanical Engineering");
    });

    it("Courses query uses ctx.studentId", async () => {
      await getStudentCourses.execute({}, ctxA);
      expect(mockAppFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ studentId: "stu-A-001" }) }),
      );
    });
  });

  describe("3. GPA — Student A must NOT receive Student B's GPA", () => {
    it("Student A gets their OWN GPA (3.8, not 3.2)", async () => {
      const result = await getStudentGPA.execute({}, ctxA);
      expect(result.ok).toBe(true);
      expect(asOkData(result).available).toBe(true);
      expect(asOkData(result).gpa).toBe(3.8);
      expect(asOkData(result).gpa).not.toBe(3.2);
    });

    it("Student B gets their OWN GPA (3.2, not 3.8)", async () => {
      const result = await getStudentGPA.execute({}, ctxB);
      expect(result.ok).toBe(true);
      expect(asOkData(result).gpa).toBe(3.2);
    });

    it("GPA query uses ctx.studentId", async () => {
      await getStudentGPA.execute({}, ctxA);
      expect(mockArFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { studentId: "stu-A-001" } }),
      );
    });
  });

  describe("4. Results — Student A must NOT receive Student B's results", () => {
    it("Student A gets their OWN results (University of Dhaka, not BUET)", async () => {
      const result = await getStudentResults.execute({}, ctxA);
      expect(result.ok).toBe(true);
      expect(asOkData(result).academicRecords[0].institution).toBe("University of Dhaka");
      expect(asOkData(result).academicRecords[0].institution).not.toBe("BUET");
      expect(asOkData(result).englishProficiency[0].testType).toBe("IELTS");
      expect(asOkData(result).englishProficiency[0].testType).not.toBe("TOEFL");
    });

    it("Student B gets their OWN results (BUET + TOEFL)", async () => {
      const result = await getStudentResults.execute({}, ctxB);
      expect(result.ok).toBe(true);
      expect(asOkData(result).academicRecords[0].institution).toBe("BUET");
      expect(asOkData(result).englishProficiency[0].testType).toBe("TOEFL");
    });
  });

  describe("5. Attendance — same response for all students (not tracked)", () => {
    it("Student A gets the standard 'not available' response", async () => {
      const result = await getStudentAttendance.execute({}, ctxA);
      expect(result.ok).toBe(true);
      expect(asOkData(result).available).toBe(false);
    });

    it("Student B gets the same 'not available' response", async () => {
      const result = await getStudentAttendance.execute({}, ctxB);
      expect(result.ok).toBe(true);
      expect(asOkData(result).available).toBe(false);
    });

    it("Attendance does NOT query the database (no data to leak)", async () => {
      await getStudentAttendance.execute({}, ctxA);
      // No Prisma model should have been called
      expect(mockStudentFindFirst).not.toHaveBeenCalled();
      expect(mockArFindMany).not.toHaveBeenCalled();
    });
  });

  describe("6. Assignments — Student A must NOT receive Student B's tasks", () => {
    it("Student A gets their OWN tasks (Alice's passport, not Bob's fee)", async () => {
      const result = await getStudentAssignments.execute({}, ctxA);
      expect(result.ok).toBe(true);
      expect(asOkData(result).overdue[0]?.title || asOkData(result).upcoming[0]?.title || asOkData(result).dueToday[0]?.title).toContain("Alice");
      const allTitles = [...asOkData(result).overdue, ...asOkData(result).dueToday, ...asOkData(result).upcoming].map((t: { title: string }) => t.title);
      expect(allTitles.some((t: string) => t.includes("Bob"))).toBe(false);
    });

    it("Student B gets their OWN tasks (Bob's fee, not Alice's passport)", async () => {
      const result = await getStudentAssignments.execute({}, ctxB);
      expect(result.ok).toBe(true);
      const allTitles = [...asOkData(result).overdue, ...asOkData(result).dueToday, ...asOkData(result).upcoming].map((t: { title: string }) => t.title);
      expect(allTitles.some((t: string) => t.includes("Bob"))).toBe(true);
      expect(allTitles.some((t: string) => t.includes("Alice"))).toBe(false);
    });

    it("Tasks query uses ctx.studentId", async () => {
      await getStudentAssignments.execute({}, ctxA);
      expect(mockTaskFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ studentId: "stu-A-001" }) }),
      );
    });
  });

  describe("7. Schedule — Student A must NOT receive Student B's appointments", () => {
    it("Student A gets their OWN appointment (Alice's document review, not Bob's visa)", async () => {
      const result = await getStudentSchedule.execute({}, ctxA);
      expect(result.ok).toBe(true);
      expect(asOkData(result).nextAppointment.purpose).toBe("Alice's document review");
      expect(asOkData(result).nextAppointment.purpose).not.toBe("Bob's visa consultation");
    });

    it("Student B gets their OWN appointment (Bob's visa, not Alice's review)", async () => {
      const result = await getStudentSchedule.execute({}, ctxB);
      expect(result.ok).toBe(true);
      expect(asOkData(result).nextAppointment.purpose).toBe("Bob's visa consultation");
    });

    it("Schedule query uses ctx.studentId", async () => {
      await getStudentSchedule.execute({}, ctxA);
      expect(mockApptFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ studentId: "stu-A-001" }) }),
      );
    });
  });

  describe("8. Notifications — Student A must NOT receive Student B's notifications", () => {
    it("Student A gets their OWN notifications (Alice's passport, not Bob's payment)", async () => {
      const result = await getStudentNotifications.execute({}, ctxA);
      expect(result.ok).toBe(true);
      expect(asOkData(result).recent[0].title).toBe("Alice's passport approved");
      expect(asOkData(result).recent[0].title).not.toBe("Bob's payment confirmed");
    });

    it("Student B gets their OWN notifications (Bob's payment, not Alice's passport)", async () => {
      const result = await getStudentNotifications.execute({}, ctxB);
      expect(result.ok).toBe(true);
      expect(asOkData(result).recent[0].title).toBe("Bob's payment confirmed");
    });

    it("Notifications query resolves userId from Student A's studentId, then queries by A's userId", async () => {
      await getStudentNotifications.execute({}, ctxA);

      // Step 1: Student lookup by ctx.studentId (Student A's ID)
      expect(mockStudentFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ id: "stu-A-001" }) }),
      );

      // Step 2: Notification queries use Student A's userId
      expect(mockNotifCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ userId: "user-A-001" }) }),
      );
      expect(mockNotifFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ userId: "user-A-001" }) }),
      );

      // Must NOT have queried with Student B's userId
      expect(mockNotifCount).not.toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ userId: "user-B-002" }) }),
      );
    });
  });
});

// ── Registry-level IDOR test ─────────────────────────────────────

describe("Registry-level IDOR prevention", () => {
  it("LLM-injected studentId is stripped — tool always uses session studentId", async () => {
    const registry = new ToolRegistry();
    registry.register(getStudentProfile);
    registry.register(getStudentGPA);

    // The LLM tries to inject Student B's studentId
    // Student A is authenticated (ctxA)
    const result = await registry.dispatch(
      "getStudentProfile",
      { studentId: "stu-B-002" }, // LLM injection attempt
      ctxA, // Student A's session
    );

    expect(result.ok).toBe(true);

    // The query MUST have used Student A's ID (from ctx), not B's
    expect(mockStudentFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: "stu-A-001" }) }),
    );
    expect(mockStudentFindFirst).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: "stu-B-002" }) }),
    );
  });

  it("LLM-injected studentId in GPA tool is also stripped", async () => {
    const registry = new ToolRegistry();
    registry.register(getStudentGPA);

    await registry.dispatch(
      "getStudentGPA",
      { studentId: "stu-B-002", userId: "user-B-002" }, // Multiple injection attempts
      ctxA,
    );

    // Must have queried Student A's records
    expect(mockArFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { studentId: "stu-A-001" } }),
    );
    expect(mockArFindMany).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { studentId: "stu-B-002" } }),
    );
  });
});
