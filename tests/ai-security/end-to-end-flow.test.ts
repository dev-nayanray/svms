/**
 * End-to-End Request Flow Tests
 * ===============================
 *
 * Tests the complete request flow:
 *   Authenticated user
 *     → determine student identity
 *     → authorize access
 *     → execute appropriate tool
 *     → return structured data
 *     → (AI generates natural-language response — tested in agent tests)
 *
 * These tests verify that the tool layer returns STRUCTURED data
 * (not free-text) for each of the 8 question categories, using
 * realistic mock data.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────

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

import { getStudentProfile } from "@/lib/ai/tools/student-profile";
import { getStudentCourses } from "@/lib/ai/tools/student-courses";
import { getStudentResults } from "@/lib/ai/tools/student-results";
import { getStudentGPA } from "@/lib/ai/tools/student-gpa";
import { getStudentAttendance } from "@/lib/ai/tools/student-attendance";
import { getStudentAssignments } from "@/lib/ai/tools/student-assignments";
import { getStudentSchedule } from "@/lib/ai/tools/student-schedule";
import { getStudentNotifications } from "@/lib/ai/tools/student-notifications";
import { _resetToolRateLimitForTests } from "@/lib/ai/tools/rate-limit";
import type { ToolContext } from "@/lib/ai/tools/types";
import { asOkData } from "../ai-tools/_helpers";

// ── Fixtures ─────────────────────────────────────────────────────

const ctx: ToolContext = {
  studentId: "stu-001",
  userId: "user-001",
  role: "STUDENT",
  requestId: "req-e2e-001",
};

const realisticStudent = {
  id: "stu-001",
  userId: "user-001",
  studentId: "STD-2026-000001",
  firstName: "Karim",
  lastName: "Ahmed",
  email: "karim@example.com",
  phone: "+8801712345678",
  whatsapp: "+8801712345678",
  nationality: "Bangladeshi",
  gender: "MALE",
  dateOfBirth: new Date("2000-05-15"),
  address: "House 123, Road 5",
  city: "Dhaka",
  district: "Dhaka",
  division: "Dhaka",
  country: "Bangladesh",
  postalCode: "1212",
  status: "ACTIVE",
  deletedAt: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

beforeEach(() => {
  vi.clearAllMocks();
  _resetToolRateLimitForTests();
});

// ── Tests: Structured data for each question category ────────────

describe("End-to-End Tool Data Structure", () => {
  describe("1. Student profile questions", () => {
    it("returns structured profile data with all expected fields", async () => {
      mockStudentFindFirst.mockResolvedValue({
        ...realisticStudent,
        user: { email: "karim@example.com", name: "Karim Ahmed" },
        employee: { title: "Senior Counselor", user: { name: "Sarah Johnson", email: "sarah@euroscope.com" } },
        branch: { name: "Dhaka Main", code: "DHK-01" },
      });

      const result = await getStudentProfile.execute({}, ctx);
      expect(result.ok).toBe(true);

      // Verify structured data shape
      const data = asOkData(result) as Record<string, unknown>;
      expect(data.studentId).toBe("STD-2026-000001");
      expect(data.firstName).toBe("Karim");
      expect(data.lastName).toBe("Ahmed");
      expect(data.email).toBe("karim@example.com");
      expect(data.phone).toBe("+8801712345678");
      expect(data.nationality).toBe("Bangladeshi");
      expect(data.city).toBe("Dhaka");
      expect(data.country).toBe("Bangladesh");
      expect(data.status).toBe("ACTIVE");

      // Counselor info (name + title, no ObjectId)
      const counselor = data.assignedCounselor as { name: string; title: string };
      expect(counselor.name).toBe("Sarah Johnson");
      expect(counselor.title).toBe("Senior Counselor");

      // Sensitive fields must NOT be present (sanitized by registry)
      expect(data.passwordHash).toBeUndefined();
      expect(data.passportNumber).toBeUndefined();
      expect(data._id).toBeUndefined();
      expect(data.userId).toBeUndefined();
    });
  });

  describe("2. Course questions", () => {
    it("returns structured course data with university + intake", async () => {
      mockAppFindMany.mockResolvedValue([
        {
          id: "app-1",
          applicationNumber: "SV-2026-000001",
          studentId: "stu-001",
          stageKey: "DOCUMENT_REVIEW",
          status: "ACTIVE",
          priority: "HIGH",
          submissionDate: new Date("2026-09-01"),
          deletedAt: null,
          course: {
            id: "crs-1",
            name: "MSc Computer Science",
            degreeLevel: "MASTER",
            duration: "2 years",
            tuitionFee: 15000,
            currency: "EUR",
            ieltsRequirement: "6.5 overall",
            university: { name: "TU Munich", city: "Munich", ranking: 50 },
          },
          country: { name: "Germany", flag: "🇩🇪" },
          intake: { name: "Winter 2026", month: 10, year: 2026 },
        },
      ]);

      const result = await getStudentCourses.execute({}, ctx);
      expect(result.ok).toBe(true);

      const data = asOkData(result) as { totalApplications: number; courses: Array<Record<string, unknown>> };
      expect(data.totalApplications).toBe(1);
      expect(data.courses[0].applicationNumber).toBe("SV-2026-000001");
      expect(data.courses[0].status).toBe("ACTIVE");
      expect(data.courses[0].stage).toBe("DOCUMENT_REVIEW");

      const course = data.courses[0].course as Record<string, unknown>;
      expect(course.name).toBe("MSc Computer Science");
      expect(course.degreeLevel).toBe("MASTER");
      expect(course.tuitionFee).toBe(15000);

      const uni = data.courses[0].university as Record<string, unknown>;
      expect(uni.name).toBe("TU Munich");
      expect(uni.ranking).toBe(50);
    });
  });

  describe("3. GPA questions", () => {
    it("returns structured GPA data with parsed value + scale", async () => {
      mockArFindMany.mockResolvedValue([
        { level: "BACHELOR", institution: "University of Dhaka", result: "3.8/4.0", passingYear: 2024 },
      ]);

      const result = await getStudentGPA.execute({}, ctx);
      expect(result.ok).toBe(true);

      const data = asOkData(result) as Record<string, unknown>;
      expect(data.available).toBe(true);
      expect(data.gpa).toBe(3.8);
      expect(data.scale).toBe(4.0);
      expect(data.level).toBe("BACHELOR");
      expect(data.institution).toBe("University of Dhaka");
    });
  });

  describe("4. Result questions", () => {
    it("returns structured academic records + English proficiency", async () => {
      mockArFindMany.mockResolvedValue([
        { level: "SSC", institution: "Dhaka College", result: "A+", passingYear: 2018, group: "Science", subject: null },
        { level: "BACHELOR", institution: "University of Dhaka", result: "3.8/4.0", passingYear: 2024, group: null, subject: "Computer Science" },
      ]);
      mockEpFindMany.mockResolvedValue([
        { testType: "IELTS", overallScore: 7.5, readingScore: 8.0, writingScore: 7.0, listeningScore: 7.5, speakingScore: 7.5, testDate: new Date("2024-06-15"), expiryDate: new Date("2026-06-15") },
      ]);

      const result = await getStudentResults.execute({}, ctx);
      expect(result.ok).toBe(true);

      const data = asOkData(result) as { academicRecords: unknown[]; englishProficiency: unknown[] };
      expect(data.academicRecords).toHaveLength(2);
      expect(data.englishProficiency).toHaveLength(1);

      const ielts = data.englishProficiency[0] as Record<string, unknown>;
      expect(ielts.testType).toBe("IELTS");
      expect(ielts.overallScore).toBe(7.5);
    });
  });

  describe("5. Attendance questions", () => {
    it("returns structured 'not available' response", async () => {
      const result = await getStudentAttendance.execute({}, ctx);
      expect(result.ok).toBe(true);

      const data = asOkData(result) as Record<string, unknown>;
      expect(data.available).toBe(false);
      expect(data.reason).toContain("does not track attendance");
      expect(data.suggestion).toContain("appointment");
    });
  });

  describe("6. Assignment questions", () => {
    it("returns structured task data categorized by urgency", async () => {
      const now = new Date();
      mockTaskFindMany.mockResolvedValue([
        { id: "t1", title: "Upload passport copy", description: "Color scan", priority: "HIGH", status: "TODO", dueDate: new Date(now.getTime() - 86400000), createdAt: now, deletedAt: null }, // overdue
        { id: "t2", title: "Pay application fee", description: "€100", priority: "URGENT", status: "TODO", dueDate: new Date(now.getTime() + 86400000), createdAt: now, deletedAt: null }, // upcoming
      ]);

      const result = await getStudentAssignments.execute({}, ctx);
      expect(result.ok).toBe(true);

      const data = asOkData(result) as { summary: { total: number; overdue: number; dueToday: number; upcoming: number }; overdue: unknown[]; upcoming: unknown[] };
      expect(data.summary.total).toBe(2);
      expect(data.summary.overdue).toBe(1);
      expect(data.overdue[0]).toBeDefined();
    });
  });

  describe("7. Schedule questions", () => {
    it("returns structured appointment data with counselor info", async () => {
      mockApptFindMany.mockResolvedValue([
        {
          id: "appt-1",
          scheduledAt: new Date(Date.now() + 86400000),
          durationMins: 30,
          purpose: "Document review",
          location: "Online",
          meetingMethod: "VIDEO_CALL",
          status: "CONFIRMED",
          notes: "Bring passport",
          cancelledAt: null,
          cancelledBy: null,
          cancelReason: null,
          completedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          employee: { title: "Senior Counselor", user: { name: "Sarah Johnson" } },
        },
      ]);

      const result = await getStudentSchedule.execute({}, ctx);
      expect(result.ok).toBe(true);

      const data = asOkData(result) as Record<string, unknown>;
      expect(data.hasUpcoming).toBe(true);
      expect(data.count).toBe(1);

      const next = data.nextAppointment as Record<string, unknown>;
      expect(next.purpose).toBe("Document review");
      expect(next.meetingMethod).toBe("VIDEO_CALL");

      const counselor = next.counselor as Record<string, unknown>;
      expect(counselor.name).toBe("Sarah Johnson");
    });
  });

  describe("8. Notification questions", () => {
    it("returns structured notification data with unread count", async () => {
      mockStudentFindFirst.mockResolvedValue({ userId: "user-001" });
      mockNotifCount.mockResolvedValue(3);
      mockNotifFindMany.mockResolvedValue([
        { id: "n1", userId: "user-001", type: "DOCUMENT_APPROVED", title: "Passport approved", message: "Your passport has been approved.", link: "/student/documents", readAt: null, createdAt: new Date("2026-09-20T10:00:00Z") },
        { id: "n2", userId: "user-001", type: "PAYMENT_CONFIRMED", title: "Payment received", message: "We received your payment of $500.", link: "/student/payments", readAt: null, createdAt: new Date("2026-09-19T14:00:00Z") },
      ]);

      const result = await getStudentNotifications.execute({}, ctx);
      expect(result.ok).toBe(true);

      const data = asOkData(result) as { unreadCount: number; recent: unknown[] };
      expect(data.unreadCount).toBe(3);
      expect(data.recent).toHaveLength(2);

      const first = data.recent[0] as Record<string, unknown>;
      expect(first.title).toBe("Passport approved");
      expect(first.isRead).toBe(false);
    });
  });
});

// ── Authorization: non-student roles are blocked ─────────────────

describe("Authorization: non-student roles are blocked from all tools", () => {
  const adminCtx: ToolContext = { ...ctx, role: "ADMIN", userId: "user-admin" };
  const employeeCtx: ToolContext = { ...ctx, role: "EMPLOYEE", userId: "user-emp" };

  it("blocks ADMIN from getStudentProfile", async () => {
    const result = await getStudentProfile.execute({}, adminCtx);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("FORBIDDEN");
    expect(mockStudentFindFirst).not.toHaveBeenCalled();
  });

  it("blocks EMPLOYEE from getStudentGPA", async () => {
    const result = await getStudentGPA.execute({}, employeeCtx);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("FORBIDDEN");
    expect(mockArFindMany).not.toHaveBeenCalled();
  });

  it("blocks ADMIN from getStudentNotifications", async () => {
    const result = await getStudentNotifications.execute({}, adminCtx);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("FORBIDDEN");
    expect(mockStudentFindFirst).not.toHaveBeenCalled();
  });

  it("blocks ADMIN from ALL 8 tools", async () => {
    const tools = [
      getStudentProfile,
      getStudentCourses,
      getStudentResults,
      getStudentGPA,
      getStudentAttendance,
      getStudentAssignments,
      getStudentSchedule,
      getStudentNotifications,
    ];

    for (const tool of tools) {
      const result = await tool.execute({}, adminCtx);
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.error.code).toBe("FORBIDDEN");
    }
  });
});
