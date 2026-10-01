/**
 * No-Fabrication Tests
 * =====================
 *
 * Verifies that the AI tools NEVER guess missing information.
 *
 * If the database contains no information, the tool returns a
 * structured response indicating the data is unavailable — so the
 * AI can say naturally:
 *
 *   "I couldn't find that information in your account."
 *
 * The tools must NOT fabricate:
 *   - Results
 *   - Grades
 *   - Attendance
 *   - Courses
 *   - Schedules
 *   - GPA
 *   - Notifications
 *   - Profile data
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

const ctx: ToolContext = {
  studentId: "stu-001",
  userId: "user-001",
  role: "STUDENT",
  requestId: "req-no-fab-001",
};

beforeEach(() => {
  vi.clearAllMocks();
  _resetToolRateLimitForTests();
});

// ── Tests ────────────────────────────────────────────────────────

describe("No-Fabrication: tools return structured 'not found' when data is missing", () => {
  describe("1. Profile — returns NOT_FOUND when student doesn't exist", () => {
    it("returns NOT_FOUND error (not fabricated data)", async () => {
      mockStudentFindFirst.mockResolvedValue(null);

      const result = await getStudentProfile.execute({}, ctx);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe("NOT_FOUND");
      expect(result.error.message).toContain("Student profile");
    });
  });

  describe("2. Courses — returns empty list (not fabricated courses)", () => {
    it("returns totalApplications: 0 (not fabricated courses)", async () => {
      mockAppFindMany.mockResolvedValue([]);

      const result = await getStudentCourses.execute({}, ctx);
      expect(result.ok).toBe(true);
      expect(asOkData(result).totalApplications).toBe(0);
      expect(asOkData(result).courses).toEqual([]);
    });
  });

  describe("3. GPA — returns available: false when no parseable GPA", () => {
    it("returns available: false for letter grades (not fabricated GPA)", async () => {
      mockArFindMany.mockResolvedValue([
        { level: "SSC", institution: "School", result: "A+", passingYear: 2018 },
      ]);

      const result = await getStudentGPA.execute({}, ctx);
      expect(result.ok).toBe(true);
      expect(asOkData(result).available).toBe(false);
      expect(asOkData(result).gpa).toBeNull();
      expect(asOkData(result).reason).toContain("non-numeric");
    });

    it("returns available: false for percentage grades (not fabricated GPA)", async () => {
      mockArFindMany.mockResolvedValue([
        { level: "SSC", institution: "School", result: "85%", passingYear: 2018 },
      ]);

      const result = await getStudentGPA.execute({}, ctx);
      expect(result.ok).toBe(true);
      expect(asOkData(result).available).toBe(false);
      expect(asOkData(result).gpa).toBeNull();
    });

    it("returns available: false when no academic records exist", async () => {
      mockArFindMany.mockResolvedValue([]);

      const result = await getStudentGPA.execute({}, ctx);
      expect(result.ok).toBe(true);
      expect(asOkData(result).available).toBe(false);
      expect(asOkData(result).gpa).toBeNull();
      expect(asOkData(result).reason).toContain("No academic records");
    });
  });

  describe("4. Results — returns empty arrays (not fabricated results)", () => {
    it("returns empty arrays when no records exist", async () => {
      mockArFindMany.mockResolvedValue([]);
      mockEpFindMany.mockResolvedValue([]);

      const result = await getStudentResults.execute({}, ctx);
      expect(result.ok).toBe(true);
      expect(asOkData(result).academicRecords).toEqual([]);
      expect(asOkData(result).englishProficiency).toEqual([]);
    });
  });

  describe("5. Attendance — returns available: false (honest, not fabricated)", () => {
    it("returns available: false with clear explanation", async () => {
      const result = await getStudentAttendance.execute({}, ctx);
      expect(result.ok).toBe(true);
      expect(asOkData(result).available).toBe(false);
      expect(asOkData(result).reason).toContain("does not track attendance");
      // Must NOT return fabricated attendance numbers
      expect(asOkData(result).percentage).toBeUndefined();
      expect(asOkData(result).classesAttended).toBeUndefined();
      expect(asOkData(result).totalClasses).toBeUndefined();
    });
  });

  describe("6. Assignments — returns empty summary (not fabricated tasks)", () => {
    it("returns summary.total: 0 when no tasks exist", async () => {
      mockTaskFindMany.mockResolvedValue([]);

      const result = await getStudentAssignments.execute({}, ctx);
      expect(result.ok).toBe(true);
      expect(asOkData(result).summary.total).toBe(0);
      expect(asOkData(result).overdue).toEqual([]);
      expect(asOkData(result).upcoming).toEqual([]);
    });
  });

  describe("7. Schedule — returns hasUpcoming: false (not fabricated appointments)", () => {
    it("returns hasUpcoming: false when no appointments exist", async () => {
      mockApptFindMany.mockResolvedValue([]);

      const result = await getStudentSchedule.execute({}, ctx);
      expect(result.ok).toBe(true);
      expect(asOkData(result).hasUpcoming).toBe(false);
      expect(asOkData(result).nextAppointment).toBeNull();
      // Must NOT return fabricated appointment data
      expect(asOkData(result).upcoming).toEqual([]);
    });
  });

  describe("8. Notifications — returns zero unread (not fabricated notifications)", () => {
    it("returns unreadCount: 0 when no notifications exist", async () => {
      mockStudentFindFirst.mockResolvedValue({ userId: "user-001" });
      mockNotifCount.mockResolvedValue(0);
      mockNotifFindMany.mockResolvedValue([]);

      const result = await getStudentNotifications.execute({}, ctx);
      expect(result.ok).toBe(true);
      expect(asOkData(result).unreadCount).toBe(0);
      expect(asOkData(result).recent).toEqual([]);
    });

    it("returns NOT_FOUND when student doesn't exist (not fabricated notifications)", async () => {
      mockStudentFindFirst.mockResolvedValue(null);

      const result = await getStudentNotifications.execute({}, ctx);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe("NOT_FOUND");
      // Must NOT have queried notifications
      expect(mockNotifCount).not.toHaveBeenCalled();
      expect(mockNotifFindMany).not.toHaveBeenCalled();
    });
  });
});

// ── Error handling: database errors don't leak to the student ────

describe("Error handling: database errors return INTERNAL, not stack traces", () => {
  it("profile tool wraps DB errors in INTERNAL (no stack trace, no connection string)", async () => {
    mockStudentFindFirst.mockRejectedValue(new Error("Connection refused: mongodb://internal-host:27017"));

    const result = await getStudentProfile.execute({}, ctx);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INTERNAL");
    // The error message is safe — no connection string, no hostname
    expect(result.error.message).toContain("getStudentProfile");
    expect(result.error.message).not.toContain("mongodb://");
    expect(result.error.message).not.toContain("internal-host");
    expect(result.error.message).not.toContain("Connection refused");
  });

  it("GPA tool wraps DB errors in INTERNAL", async () => {
    mockArFindMany.mockRejectedValue(new Error("Connection lost"));

    const result = await getStudentGPA.execute({}, ctx);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INTERNAL");
  });

  it("notifications tool wraps DB errors in INTERNAL", async () => {
    mockStudentFindFirst.mockRejectedValue(new Error("Timeout"));

    const result = await getStudentNotifications.execute({}, ctx);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INTERNAL");
  });
});
