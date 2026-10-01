import { describe, it, expect, vi, beforeEach } from "vitest";

const mockApptFindMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    appointment: { findMany: (...a: unknown[]) => mockApptFindMany(...a) },
  },
}));

import { getStudentSchedule } from "@/lib/ai/tools/student-schedule";
import { makeStudentCtx, makeAdminCtx, asOkData } from "./_helpers";

describe("getStudentSchedule", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns upcoming appointments for a student", async () => {
    const future = new Date(Date.now() + 86400000); // tomorrow
    mockApptFindMany.mockResolvedValue([
      {
        id: "appt-1",
        scheduledAt: future,
        durationMins: 30,
        purpose: "Document review",
        location: "Online",
        meetingMethod: "VIDEO_CALL",
        meetingLink: "https://meet.example.com/abc", // should be stripped by sanitizer
        status: "CONFIRMED",
        notes: "Bring passport",
        employee: { title: "Counselor", user: { name: "Sarah J" } },
      },
    ]);

    const result = await getStudentSchedule.execute({}, makeStudentCtx());

    expect(result.ok).toBe(true);
    expect(asOkData(result).hasUpcoming).toBe(true);
    expect(asOkData(result).count).toBe(1);
    expect(asOkData(result).nextAppointment.purpose).toBe("Document review");
    expect(asOkData(result).nextAppointment.counselor.name).toBe("Sarah J");
    expect(asOkData(result).note).toContain("counseling appointments");
  });

  it("queries with the authenticated studentId + future date filter", async () => {
    mockApptFindMany.mockResolvedValue([]);

    await getStudentSchedule.execute({}, makeStudentCtx({ studentId: "stu-xyz" }));

    expect(mockApptFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          studentId: "stu-xyz",
          scheduledAt: { gte: expect.any(Date) },
          status: { in: ["SCHEDULED", "CONFIRMED"] },
        }),
      }),
    );
  });

  it("returns hasUpcoming: false when no appointments", async () => {
    mockApptFindMany.mockResolvedValue([]);

    const result = await getStudentSchedule.execute({}, makeStudentCtx());

    expect(result.ok).toBe(true);
    expect(asOkData(result).hasUpcoming).toBe(false);
    expect(asOkData(result).nextAppointment).toBeNull();
    expect(asOkData(result).suggestion).toContain("request an appointment");
  });

  it("wraps database errors in INTERNAL", async () => {
    mockApptFindMany.mockRejectedValue(new Error("fail"));

    const result = await getStudentSchedule.execute({}, makeStudentCtx());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INTERNAL");
  });

  it("rejects ADMIN role", async () => {
    const result = await getStudentSchedule.execute({}, makeAdminCtx());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("FORBIDDEN");
    expect(mockApptFindMany).not.toHaveBeenCalled();
  });
});
