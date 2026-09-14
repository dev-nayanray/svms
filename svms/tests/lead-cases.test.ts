import { describe, it, expect, vi, beforeEach } from "vitest";

const prismaMock = vi.hoisted(() => ({
  lead: { findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn(), update: vi.fn(), create: vi.fn() },
  leadNote: { create: vi.fn() },
  student: { findFirst: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn() },
  user: { create: vi.fn() },
  task: { findMany: vi.fn() },
  appointment: { findMany: vi.fn() },
  notification: { create: vi.fn() },
  auditLog: { create: vi.fn() },
  $transaction: vi.fn((fn: unknown) => {
    if (typeof fn === "function") return fn(prismaMock);
    return Promise.all(fn as unknown[]);
  }),
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import {
  listLeads,
  getLeadById,
  requireLead,
  createLead,
  updateLead,
  changeLeadStatus,
  convertLeadToStudent,
  addLeadNote,
  LEAD_STATUSES,
  LEAD_SOURCES,
} from "@/lib/services/lead-cases";
import type { EmployeeScope } from "@/lib/services/employee-dashboard";
import { HttpError } from "@/lib/api";

const ADMIN_SCOPE: EmployeeScope = { isAdmin: true, userId: "u-admin", employeeId: null };
const EMPLOYEE_SCOPE: EmployeeScope = { isAdmin: false, userId: "u-emp", employeeId: "emp-1" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("lead constants", () => {
  it("has 6 statuses", () => {
    expect(LEAD_STATUSES).toEqual(["NEW", "CONTACTED", "COUNSELING", "QUALIFIED", "CONVERTED", "LOST"]);
  });
  it("has 8 sources", () => {
    expect(LEAD_SOURCES).toHaveLength(8);
    expect(LEAD_SOURCES).toContain("WEBSITE");
    expect(LEAD_SOURCES).toContain("OTHER");
  });
});

describe("lead IDOR closure", () => {
  it("EMPLOYEE scope embeds assignedEmployeeId filter", async () => {
    prismaMock.lead.findMany.mockResolvedValue([]);
    prismaMock.lead.count.mockResolvedValue(0);
    await listLeads(EMPLOYEE_SCOPE, {});
    const call = prismaMock.lead.findMany.mock.calls[0][0];
    expect(call.where.assignedEmployeeId).toBe("emp-1");
  });

  it("ADMIN scope is empty — sees all leads", async () => {
    prismaMock.lead.findMany.mockResolvedValue([]);
    prismaMock.lead.count.mockResolvedValue(0);
    await listLeads(ADMIN_SCOPE, {});
    const call = prismaMock.lead.findMany.mock.calls[0][0];
    expect(call.where.assignedEmployeeId).toBeUndefined();
  });

  it("getLeadById returns null for foreign leads", async () => {
    prismaMock.lead.findFirst.mockResolvedValue(null);
    const result = await getLeadById(EMPLOYEE_SCOPE, "lead-foreign");
    expect(result).toBeNull();
  });

  it("requireLead throws 404 for missing/foreign", async () => {
    prismaMock.lead.findFirst.mockResolvedValue(null);
    await expect(requireLead(EMPLOYEE_SCOPE, "lead-missing")).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
  });
});

describe("createLead", () => {
  it("creates a lead with default values", async () => {
    prismaMock.lead.create.mockResolvedValue({ id: "lead-1" });
    prismaMock.auditLog.create.mockResolvedValue({});
    const result = await createLead(EMPLOYEE_SCOPE, {
      name: "Karim Ahmed", phone: "+880171", email: "karim@example.com",
      interestedCountry: "Germany", preferredCourse: "B.Sc. CS",
    }, { id: "u-emp" });
    expect(result.id).toBe("lead-1");
    expect(prismaMock.lead.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        name: "Karim Ahmed", status: "NEW", assignedEmployeeId: "emp-1",
      }),
    }));
  });

  it("rejects empty name (422)", async () => {
    await expect(createLead(EMPLOYEE_SCOPE, { name: "" }, { id: "u-emp" })).rejects.toMatchObject({ status: 422, code: "VALIDATION_ERROR" });
  });

  it("lowercases email", async () => {
    prismaMock.lead.create.mockResolvedValue({ id: "l1" });
    prismaMock.auditLog.create.mockResolvedValue({});
    await createLead(EMPLOYEE_SCOPE, { name: "Test", email: "TEST@EXAMPLE.COM" }, { id: "u-emp" });
    expect(prismaMock.lead.create.mock.calls[0][0].data.email).toBe("test@example.com");
  });
});

describe("updateLead", () => {
  it("updates permitted fields", async () => {
    prismaMock.lead.findFirst.mockResolvedValue({ id: "l1" });
    prismaMock.lead.update.mockResolvedValue({});
    prismaMock.auditLog.create.mockResolvedValue({});
    await updateLead(EMPLOYEE_SCOPE, "l1", {
      name: "Updated Name", phone: "+880172", notes: "New note",
    }, { id: "u-emp" });
    expect(prismaMock.lead.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ name: "Updated Name", phone: "+880172", notes: "New note" }),
    }));
  });

  it("IDOR: foreign lead returns 404", async () => {
    prismaMock.lead.findFirst.mockResolvedValue(null);
    await expect(updateLead(EMPLOYEE_SCOPE, "lead-foreign", { name: "X" }, { id: "u-emp" })).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
  });
});

describe("changeLeadStatus", () => {
  it("rejects an invalid status (400)", async () => {
    await expect(changeLeadStatus(EMPLOYEE_SCOPE, "l1", "INVALID", { id: "u-emp" })).rejects.toMatchObject({ status: 400, code: "BAD_REQUEST" });
  });

  it("changes status from NEW to CONTACTED", async () => {
    prismaMock.lead.findFirst.mockResolvedValue({ id: "l1", status: "NEW", name: "Test" });
    prismaMock.lead.update.mockResolvedValue({});
    prismaMock.auditLog.create.mockResolvedValue({});
    await changeLeadStatus(EMPLOYEE_SCOPE, "l1", "CONTACTED", { id: "u-emp" });
    expect(prismaMock.lead.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "CONTACTED" }),
    }));
  });

  it("is a no-op when status is the same", async () => {
    prismaMock.lead.findFirst.mockResolvedValue({ id: "l1", status: "CONTACTED", name: "Test" });
    await changeLeadStatus(EMPLOYEE_SCOPE, "l1", "CONTACTED", { id: "u-emp" });
    expect(prismaMock.lead.update).not.toHaveBeenCalled();
  });

  it("blocks changing status of a CONVERTED lead (409)", async () => {
    prismaMock.lead.findFirst.mockResolvedValue({ id: "l1", status: "CONVERTED", name: "Test" });
    await expect(changeLeadStatus(EMPLOYEE_SCOPE, "l1", "LOST", { id: "u-emp" })).rejects.toMatchObject({ status: 409, code: "CONFLICT" });
  });

  it("IDOR: foreign lead returns 404", async () => {
    prismaMock.lead.findFirst.mockResolvedValue(null);
    await expect(changeLeadStatus(EMPLOYEE_SCOPE, "lead-foreign", "CONTACTED", { id: "u-emp" })).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
  });
});

describe("convertLeadToStudent", () => {
  it("rejects conversion of non-QUALIFIED lead (409)", async () => {
    prismaMock.lead.findFirst.mockResolvedValue({
      id: "l1", name: "Karim", email: "k@x.com", phone: "+88", interestedCountry: "Germany",
      status: "NEW", convertedStudentId: null, assignedEmployeeId: "emp-1",
    });
    await expect(convertLeadToStudent(EMPLOYEE_SCOPE, "l1", { id: "u-emp" })).rejects.toMatchObject({ status: 409, code: "CONFLICT" });
  });

  it("rejects conversion of already-converted lead (409)", async () => {
    prismaMock.lead.findFirst.mockResolvedValue({
      id: "l1", name: "Karim", email: "k@x.com", phone: null, interestedCountry: null,
      status: "QUALIFIED", convertedStudentId: "existing-stu", assignedEmployeeId: "emp-1",
    });
    await expect(convertLeadToStudent(EMPLOYEE_SCOPE, "l1", { id: "u-emp" })).rejects.toMatchObject({ status: 409, code: "CONFLICT" });
  });

  it("rejects conversion when duplicate student email exists (409)", async () => {
    prismaMock.lead.findFirst.mockResolvedValue({
      id: "l1", name: "Karim", email: "existing@example.com", phone: null, interestedCountry: null,
      status: "QUALIFIED", convertedStudentId: null, assignedEmployeeId: "emp-1",
    });
    prismaMock.student.findFirst.mockResolvedValue({ id: "existing-stu" }); // duplicate found
    await expect(convertLeadToStudent(EMPLOYEE_SCOPE, "l1", { id: "u-emp" })).rejects.toMatchObject({ status: 409, code: "CONFLICT" });
  });

  it("creates user + student + marks lead as CONVERTED + audit + notification", async () => {
    prismaMock.lead.findFirst.mockResolvedValue({
      id: "l1", name: "Karim Ahmed", email: "karim@example.com", phone: "+880171",
      interestedCountry: "Germany", status: "QUALIFIED", convertedStudentId: null, assignedEmployeeId: "emp-1",
    });
    prismaMock.student.findFirst.mockResolvedValue(null); // no duplicate
    prismaMock.student.count.mockResolvedValue(0);
    prismaMock.user.create.mockResolvedValue({ id: "u-stu" });
    prismaMock.student.create.mockResolvedValue({ id: "stu-1" });
    prismaMock.student.update.mockResolvedValue({});
    prismaMock.lead.update.mockResolvedValue({});
    prismaMock.auditLog.create.mockResolvedValue({});
    prismaMock.notification.create.mockResolvedValue({});

    const result = await convertLeadToStudent(EMPLOYEE_SCOPE, "l1", { id: "u-emp" });
    expect(result.studentId).toBe("stu-1");

    // Verify lead was marked CONVERTED
    expect(prismaMock.lead.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "CONVERTED", convertedStudentId: "stu-1" }),
    }));

    // Verify audit log
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "lead.converted" }),
    }));

    // Verify notification
    expect(prismaMock.notification.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ type: "WELCOME" }),
    }));
  });

  it("IDOR: foreign lead returns 404", async () => {
    prismaMock.lead.findFirst.mockResolvedValue(null);
    await expect(convertLeadToStudent(EMPLOYEE_SCOPE, "lead-foreign", { id: "u-emp" })).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
  });
});

describe("addLeadNote", () => {
  it("adds a note to the lead", async () => {
    prismaMock.lead.findFirst.mockResolvedValue({ id: "l1" });
    prismaMock.leadNote.create.mockResolvedValue({ id: "n1" });
    const result = await addLeadNote(EMPLOYEE_SCOPE, "l1", "Important follow-up note", { id: "u-emp" });
    expect(result.id).toBe("n1");
  });

  it("blocks empty notes (422)", async () => {
    await expect(addLeadNote(EMPLOYEE_SCOPE, "l1", "", { id: "u-emp" })).rejects.toMatchObject({ status: 422, code: "VALIDATION_ERROR" });
    await expect(addLeadNote(EMPLOYEE_SCOPE, "l1", "   ", { id: "u-emp" })).rejects.toMatchObject({ status: 422, code: "VALIDATION_ERROR" });
  });

  it("IDOR: foreign lead returns 404", async () => {
    prismaMock.lead.findFirst.mockResolvedValue(null);
    await expect(addLeadNote(EMPLOYEE_SCOPE, "lead-foreign", "note", { id: "u-emp" })).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
  });
});

describe("error propagation", () => {
  it("listLeads lets prisma errors bubble", async () => {
    prismaMock.lead.findMany.mockRejectedValue(new Error("DB lost"));
    prismaMock.lead.count.mockResolvedValue(0);
    await expect(listLeads(EMPLOYEE_SCOPE, {})).rejects.toThrow("DB lost");
  });
});
