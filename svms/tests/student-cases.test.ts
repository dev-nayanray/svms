import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────
// Mocks: prisma + db stubbed so we can drive every query path with
// controlled inputs without touching a real database.
// ─────────────────────────────────────────────

const prismaMock = vi.hoisted(() => ({
  student: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
  },
  visaApplication: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import {
  listStudents,
  getStudentById,
  requireStudent,
  buildStudentTimeline,
  type StudentListFilters,
} from "@/lib/services/student-cases";
import type { EmployeeScope } from "@/lib/services/employee-dashboard";
import { HttpError } from "@/lib/api";

const ADMIN_SCOPE: EmployeeScope = { isAdmin: true, userId: "u-admin", employeeId: null };
const EMPLOYEE_SCOPE: EmployeeScope = { isAdmin: false, userId: "u-emp", employeeId: "emp-1" };

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────
// listStudents — IDOR closure
// ─────────────────────────────────────────────

describe("listStudents — IDOR scope closure", () => {
  it("ADMIN scope: empty where-filter — sees all students", async () => {
    prismaMock.student.findMany.mockResolvedValue([]);
    prismaMock.student.count.mockResolvedValue(0);
    await listStudents(ADMIN_SCOPE, {});
    const call = prismaMock.student.findMany.mock.calls[0][0];
    expect(call.where.assignedEmployeeId).toBeUndefined();
  });

  it("EMPLOYEE scope: embeds assignedEmployeeId in the where clause", async () => {
    prismaMock.student.findMany.mockResolvedValue([]);
    prismaMock.student.count.mockResolvedValue(0);
    await listStudents(EMPLOYEE_SCOPE, {});
    const call = prismaMock.student.findMany.mock.calls[0][0];
    expect(call.where.assignedEmployeeId).toBe("emp-1");
  });

  it("never accepts a client-supplied employeeId / userId override", async () => {
    prismaMock.student.findMany.mockResolvedValue([]);
    prismaMock.student.count.mockResolvedValue(0);
    // Even if a malicious filter tried to pass `assignedEmployeeId` as a
    // filter value, the service only reads typed fields from `StudentListFilters`.
    const maliciousFilters: StudentListFilters = {
      // @ts-expect-error — the type disallows this on purpose
      assignedEmployeeId: "emp-other",
    };
    await listStudents(EMPLOYEE_SCOPE, { filters: maliciousFilters });
    const call = prismaMock.student.findMany.mock.calls[0][0];
    // The where clause still uses the session-derived employeeId.
    expect(call.where.assignedEmployeeId).toBe("emp-1");
    expect(call.where.assignedEmployeeId).not.toBe("emp-other");
  });
});

// ─────────────────────────────────────────────
// listStudents — search
// ─────────────────────────────────────────────

describe("listStudents — search", () => {
  it("builds an OR clause across name, email, studentId, phone", async () => {
    prismaMock.student.findMany.mockResolvedValue([]);
    prismaMock.student.count.mockResolvedValue(0);
    await listStudents(EMPLOYEE_SCOPE, { filters: { search: "Karim" } });
    const call = prismaMock.student.findMany.mock.calls[0][0];
    expect(call.where.OR).toEqual([
      { firstName: { contains: "Karim", mode: "insensitive" } },
      { lastName: { contains: "Karim", mode: "insensitive" } },
      { email: { contains: "Karim", mode: "insensitive" } },
      { studentId: { contains: "Karim", mode: "insensitive" } },
      { phone: { contains: "Karim", mode: "insensitive" } },
    ]);
  });

  it("trims whitespace from the search term", async () => {
    prismaMock.student.findMany.mockResolvedValue([]);
    prismaMock.student.count.mockResolvedValue(0);
    await listStudents(EMPLOYEE_SCOPE, { filters: { search: "  Karim  " } });
    const call = prismaMock.student.findMany.mock.calls[0][0];
    expect(call.where.OR[0].firstName.contains).toBe("Karim");
  });

  it("does not add an OR clause when search is empty", async () => {
    prismaMock.student.findMany.mockResolvedValue([]);
    prismaMock.student.count.mockResolvedValue(0);
    await listStudents(EMPLOYEE_SCOPE, { filters: { search: "   " } });
    const call = prismaMock.student.findMany.mock.calls[0][0];
    expect(call.where.OR).toBeUndefined();
  });
});

// ─────────────────────────────────────────────
// listStudents — filters
// ─────────────────────────────────────────────

describe("listStudents — filters", () => {
  it("applies the status filter", async () => {
    prismaMock.student.findMany.mockResolvedValue([]);
    prismaMock.student.count.mockResolvedValue(0);
    await listStudents(EMPLOYEE_SCOPE, { filters: { status: "ACTIVE" } });
    const call = prismaMock.student.findMany.mock.calls[0][0];
    expect(call.where.status).toBe("ACTIVE");
  });

  it("applies the country filter", async () => {
    prismaMock.student.findMany.mockResolvedValue([]);
    prismaMock.student.count.mockResolvedValue(0);
    await listStudents(EMPLOYEE_SCOPE, { filters: { country: "Bangladesh" } });
    const call = prismaMock.student.findMany.mock.calls[0][0];
    expect(call.where.country).toBe("Bangladesh");
  });

  it("applies the application stage filter via the applications relation", async () => {
    prismaMock.student.findMany.mockResolvedValue([]);
    prismaMock.student.count.mockResolvedValue(0);
    await listStudents(EMPLOYEE_SCOPE, { filters: { stage: "VISA_SUBMITTED" } });
    const call = prismaMock.student.findMany.mock.calls[0][0];
    expect(call.where.applications.some.stageKey).toBe("VISA_SUBMITTED");
  });

  it("applies the university filter via the applications relation", async () => {
    prismaMock.student.findMany.mockResolvedValue([]);
    prismaMock.student.count.mockResolvedValue(0);
    await listStudents(EMPLOYEE_SCOPE, { filters: { universityId: "uni-1" } });
    const call = prismaMock.student.findMany.mock.calls[0][0];
    expect(call.where.applications.some.universityId).toBe("uni-1");
  });

  it("applies the visa stage filter via applications.visaApplications", async () => {
    prismaMock.student.findMany.mockResolvedValue([]);
    prismaMock.student.count.mockResolvedValue(0);
    await listStudents(EMPLOYEE_SCOPE, { filters: { visaStage: "APPROVED" } });
    const call = prismaMock.student.findMany.mock.calls[0][0];
    expect(call.where.applications.some.visaApplications.some.stage).toBe("APPROVED");
  });

  it("applies the date range filter on createdAt", async () => {
    prismaMock.student.findMany.mockResolvedValue([]);
    prismaMock.student.count.mockResolvedValue(0);
    await listStudents(EMPLOYEE_SCOPE, {
      filters: { createdFrom: "2026-01-01T00:00:00Z", createdTo: "2026-12-31T23:59:59Z" },
    });
    const call = prismaMock.student.findMany.mock.calls[0][0];
    expect(call.where.createdAt.gte).toEqual(new Date("2026-01-01T00:00:00Z"));
    expect(call.where.createdAt.lte).toEqual(new Date("2026-12-31T23:59:59Z"));
  });

  it("ignores invalid date strings rather than crashing", async () => {
    prismaMock.student.findMany.mockResolvedValue([]);
    prismaMock.student.count.mockResolvedValue(0);
    await listStudents(EMPLOYEE_SCOPE, {
      filters: { createdFrom: "not-a-date", createdTo: "still-bad" },
    });
    const call = prismaMock.student.findMany.mock.calls[0][0];
    expect(call.where.createdAt).toBeUndefined();
  });

  it("archived=true filters to INACTIVE status", async () => {
    prismaMock.student.findMany.mockResolvedValue([]);
    prismaMock.student.count.mockResolvedValue(0);
    await listStudents(EMPLOYEE_SCOPE, { filters: { archived: true } });
    const call = prismaMock.student.findMany.mock.calls[0][0];
    expect(call.where.status).toBe("INACTIVE");
  });

  it("default (no status filter) excludes INACTIVE students", async () => {
    prismaMock.student.findMany.mockResolvedValue([]);
    prismaMock.student.count.mockResolvedValue(0);
    await listStudents(EMPLOYEE_SCOPE, {});
    const call = prismaMock.student.findMany.mock.calls[0][0];
    expect(call.where.status).toEqual({ not: "INACTIVE" });
  });
});

// ─────────────────────────────────────────────
// listStudents — sorting
// ─────────────────────────────────────────────

describe("listStudents — sorting", () => {
  it("uses an allowlist — unknown sort keys fall back to createdAt", async () => {
    prismaMock.student.findMany.mockResolvedValue([]);
    prismaMock.student.count.mockResolvedValue(0);
    // @ts-expect-error — intentionally passing a bad key
    await listStudents(EMPLOYEE_SCOPE, { sortBy: "evil" });
    const call = prismaMock.student.findMany.mock.calls[0][0];
    expect(call.orderBy[0]).toHaveProperty("createdAt");
  });

  it("supports asc and desc on allowed keys", async () => {
    prismaMock.student.findMany.mockResolvedValue([]);
    prismaMock.student.count.mockResolvedValue(0);
    await listStudents(EMPLOYEE_SCOPE, { sortBy: "name", sortOrder: "asc" });
    const call = prismaMock.student.findMany.mock.calls[0][0];
    expect(call.orderBy[0].firstName).toBe("asc");
  });
});

// ─────────────────────────────────────────────
// listStudents — pagination
// ─────────────────────────────────────────────

describe("listStudents — pagination", () => {
  it("defaults to page 1, pageSize 20", async () => {
    prismaMock.student.findMany.mockResolvedValue([]);
    prismaMock.student.count.mockResolvedValue(0);
    const result = await listStudents(EMPLOYEE_SCOPE, {});
    const call = prismaMock.student.findMany.mock.calls[0][0];
    expect(call.skip).toBe(0);
    expect(call.take).toBe(20);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
    expect(result.totalPages).toBe(1); // Math.max(1, ceil(0/20))
  });

  it("computes skip = (page - 1) * pageSize for page 3 of 25", async () => {
    prismaMock.student.findMany.mockResolvedValue([]);
    prismaMock.student.count.mockResolvedValue(75);
    const result = await listStudents(EMPLOYEE_SCOPE, { page: 3, pageSize: 25 });
    const call = prismaMock.student.findMany.mock.calls[0][0];
    expect(call.skip).toBe(50);
    expect(call.take).toBe(25);
    expect(result.totalPages).toBe(3);
  });

  it("clamps pageSize to a max of 100 (avoid huge queries)", async () => {
    prismaMock.student.findMany.mockResolvedValue([]);
    prismaMock.student.count.mockResolvedValue(0);
    await listStudents(EMPLOYEE_SCOPE, { pageSize: 5000 });
    const call = prismaMock.student.findMany.mock.calls[0][0];
    expect(call.take).toBe(100);
  });

  it("clamps pageSize to a min of 1", async () => {
    prismaMock.student.findMany.mockResolvedValue([]);
    prismaMock.student.count.mockResolvedValue(0);
    await listStudents(EMPLOYEE_SCOPE, { pageSize: 0 });
    const call = prismaMock.student.findMany.mock.calls[0][0];
    expect(call.take).toBe(1);
  });

  it("clamps page to a min of 1", async () => {
    prismaMock.student.findMany.mockResolvedValue([]);
    prismaMock.student.count.mockResolvedValue(0);
    const result = await listStudents(EMPLOYEE_SCOPE, { page: -5 });
    expect(result.page).toBe(1);
    const call = prismaMock.student.findMany.mock.calls[0][0];
    expect(call.skip).toBe(0);
  });
});

// ─────────────────────────────────────────────
// listStudents — empty + large dataset
// ─────────────────────────────────────────────

describe("listStudents — empty + large datasets", () => {
  it("returns an empty rows array when the database has no matches", async () => {
    prismaMock.student.findMany.mockResolvedValue([]);
    prismaMock.student.count.mockResolvedValue(0);
    const result = await listStudents(EMPLOYEE_SCOPE, { filters: { search: "no-one-matches-this" } });
    expect(result.rows).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(1);
  });

  it("returns mapped rows when the database returns records", async () => {
    prismaMock.student.findMany.mockResolvedValue([
      {
        id: "stu-1",
        studentId: "STD-2026-000001",
        firstName: "Karim",
        lastName: "Ahmed",
        email: "karim@example.com",
        phone: "+8801711111111",
        country: "Bangladesh",
        city: "Dhaka",
        status: "ACTIVE",
        createdAt: new Date("2026-08-01"),
        updatedAt: new Date("2026-08-10"),
        applications: [
          {
            id: "app-1",
            applicationNumber: "APP-001",
            stageKey: "VISA_SUBMITTED",
            status: "NEW",
            country: { name: "Germany" },
            university: { name: "TU Munich" },
            visaApplications: [{ stage: "BIOMETRICS" }],
            tasks: [{ dueDate: new Date("2026-08-20"), priority: "HIGH" }],
          },
        ],
        tasks: [{ priority: "HIGH" }],
      },
    ]);
    prismaMock.student.count.mockResolvedValue(1);
    const result = await listStudents(EMPLOYEE_SCOPE, {});
    expect(result.rows).toHaveLength(1);
    const r = result.rows[0];
    expect(r.firstName).toBe("Karim");
    expect(r.primaryApplication?.applicationNumber).toBe("APP-001");
    expect(r.primaryApplication?.universityName).toBe("TU Munich");
    expect(r.visaStage).toBe("BIOMETRICS");
    expect(r.priority).toBe("HIGH");
    expect(r.nextDeadline).toEqual(new Date("2026-08-20"));
  });
});

// ─────────────────────────────────────────────
// getStudentById — IDOR closure + relationship loading
// ─────────────────────────────────────────────

describe("getStudentById — IDOR closure", () => {
  it("EMPLOYEE: foreign student returns null (never 403 — ownership never confirmed)", async () => {
    // findFirst with the scope filter returns null because the student is
    // assigned to another employee.
    prismaMock.student.findFirst.mockResolvedValue(null);
    prismaMock.visaApplication.findMany.mockResolvedValue([]);
    const result = await getStudentById(EMPLOYEE_SCOPE, "stu-other");
    expect(result).toBeNull();
    // The where clause MUST embed the scope filter so Prisma rejects foreign rows.
    const call = prismaMock.student.findFirst.mock.calls[0][0];
    expect(call.where.id).toBe("stu-other");
    expect(call.where.assignedEmployee).toEqual({ userId: "u-emp" });
  });

  it("ADMIN: scope filter is empty — sees any student by id", async () => {
    prismaMock.student.findFirst.mockResolvedValue(null); // missing student
    prismaMock.visaApplication.findMany.mockResolvedValue([]);
    await getStudentById(ADMIN_SCOPE, "stu-anything");
    const call = prismaMock.student.findFirst.mock.calls[0][0];
    expect(call.where.id).toBe("stu-anything");
    expect(call.where.assignedEmployee).toBeUndefined();
  });

  it("returns the full Student 360 aggregate when the student is owned", async () => {
    const fakeStudent = {
      id: "stu-1",
      userId: "u-stu-1",
      studentId: "STD-2026-000001",
      firstName: "Karim",
      lastName: "Ahmed",
      email: "karim@example.com",
      phone: "+8801711111111",
      dateOfBirth: null,
      gender: null,
      nationality: null,
      country: "Bangladesh",
      city: "Dhaka",
      status: "ACTIVE",
      createdAt: new Date("2026-08-01"),
      updatedAt: new Date("2026-08-10"),
      assignedEmployeeId: "emp-1",
      assignedEmployee: { id: "emp-1", title: "Counselor", user: { name: "Counselor Name", email: "c@x.com" } },
      applications: [],
      documents: [],
      payments: [],
      invoices: [],
      tasks: [],
      conversations: [],
      appointments: [],
    };
    prismaMock.student.findFirst.mockResolvedValue(fakeStudent);
    prismaMock.visaApplication.findMany.mockResolvedValue([]);
    const result = await getStudentById(EMPLOYEE_SCOPE, "stu-1");
    expect(result).not.toBeNull();
    expect(result?.firstName).toBe("Karim");
    expect(result?.assignedEmployee?.user.name).toBe("Counselor Name");
    expect(result?.visaApplications).toEqual([]);
  });
});

// ─────────────────────────────────────────────
// requireStudent — 404 when not found / not owned
// ─────────────────────────────────────────────

describe("requireStudent — throws HttpError 404", () => {
  it("throws a 404 HttpError when the student is not found (or not owned)", async () => {
    prismaMock.student.findFirst.mockResolvedValue(null);
    prismaMock.visaApplication.findMany.mockResolvedValue([]);
    await expect(requireStudent(EMPLOYEE_SCOPE, "stu-missing")).rejects.toThrow(HttpError);
    await expect(requireStudent(EMPLOYEE_SCOPE, "stu-missing")).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
    });
  });
});

// ─────────────────────────────────────────────
// buildStudentTimeline — merges across all related entities
// ─────────────────────────────────────────────

describe("buildStudentTimeline — merge + sort", () => {
  it("merges applications, documents, tasks, payments, invoices, visa, appointments, messages and sorts by date desc", () => {
    const student = {
      id: "stu-1",
      userId: "u-stu-1",
      studentId: "STD-1",
      firstName: "Karim",
      lastName: "Ahmed",
      email: "k@x.com",
      phone: null,
      dateOfBirth: null,
      gender: null,
      nationality: null,
      country: null,
      city: null,
      status: "ACTIVE",
      createdAt: new Date("2026-07-01"),
      updatedAt: new Date("2026-07-01"),
      assignedEmployeeId: null,
      assignedEmployee: null,
      applications: [
        {
          id: "a1",
          applicationNumber: "APP-1",
          stageKey: "VISA_SUBMITTED",
          status: "NEW",
          createdAt: new Date("2026-08-01"),
          updatedAt: new Date("2026-08-10"),
          country: { name: "Germany" },
          university: { name: "TU Munich" },
          course: null,
        },
      ],
      documents: [
        {
          id: "d1",
          name: "Passport",
          status: "APPROVED",
          fileName: "passport.pdf",
          mimeType: "application/pdf",
          fileSize: 1024,
          uploadedAt: new Date("2026-08-05"),
          reviewedAt: new Date("2026-08-06"),
          reviewNote: "Looks good",
          createdAt: new Date("2026-08-04"),
        },
      ],
      payments: [],
      invoices: [],
      tasks: [],
      conversations: [],
      visaApplications: [],
      appointments: [],
    };
    const items = buildStudentTimeline(student);
    expect(items.length).toBeGreaterThan(0);
    // Sorted desc — most recent first.
    for (let i = 1; i < items.length; i++) {
      expect(items[i - 1].at.getTime()).toBeGreaterThanOrEqual(items[i].at.getTime());
    }
    // Application_created at 2026-08-01 should be in there.
    const created = items.find((i) => i.kind === "application_created");
    expect(created).toBeDefined();
    expect(created!.title).toContain("APP-1");
  });

  it("returns an empty array when the student has no activity", () => {
    const empty = {
      id: "stu-empty",
      userId: "u-x",
      studentId: "STD-x",
      firstName: "Nobody",
      lastName: "Here",
      email: "n@x.com",
      phone: null,
      dateOfBirth: null,
      gender: null,
      nationality: null,
      country: null,
      city: null,
      status: "ACTIVE",
      createdAt: new Date(),
      updatedAt: new Date(),
      assignedEmployeeId: null,
      assignedEmployee: null,
      applications: [],
      documents: [],
      payments: [],
      invoices: [],
      tasks: [],
      conversations: [],
      visaApplications: [],
      appointments: [],
    };
    expect(buildStudentTimeline(empty)).toEqual([]);
  });
});

// ─────────────────────────────────────────────
// Error propagation
// ─────────────────────────────────────────────

describe("error propagation", () => {
  it("listStudents lets prisma errors bubble (never swallows)", async () => {
    prismaMock.student.findMany.mockRejectedValue(new Error("DB connection lost"));
    prismaMock.student.count.mockResolvedValue(0);
    await expect(listStudents(EMPLOYEE_SCOPE, {})).rejects.toThrow("DB connection lost");
  });

  it("getStudentById lets prisma errors bubble", async () => {
    prismaMock.student.findFirst.mockRejectedValue(new Error("findFirst failed"));
    await expect(getStudentById(EMPLOYEE_SCOPE, "stu-1")).rejects.toThrow("findFirst failed");
  });
});
