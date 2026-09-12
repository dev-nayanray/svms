import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────

const mockAuth = vi.fn();
const mockStudentFindFirst = vi.fn();
const mockVisaFindMany = vi.fn();
const mockVisaFindFirst = vi.fn();
const mockStatusHistoryFindMany = vi.fn();
const mockVisaRequirementFindMany = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    student: { findFirst: (args: unknown) => mockStudentFindFirst(args) },
    visaApplication: {
      findMany: (args: unknown) => mockVisaFindMany(args),
      findFirst: (args: unknown) => mockVisaFindFirst(args),
    },
    applicationStatusHistory: { findMany: (args: unknown) => mockStatusHistoryFindMany(args) },
    visaRequirement: { findMany: (args: unknown) => mockVisaRequirementFindMany(args) },
  },
}));

import { GET as GET_list } from "@/app/api/student/visa/route";
import { GET as GET_detail } from "@/app/api/student/visa/[id]/route";
import { GET as GET_requirements } from "@/app/api/student/visa/requirements/route";

// ─────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────

const baseStudent = {
  id: "stu-1",
  userId: "user-1",
  studentId: "STD-2026-000001",
  firstName: "Karim",
  lastName: "Ahmed",
  email: "k@x.com",
  deletedAt: null,
};

const baseVisa = {
  id: "visa-1",
  applicationId: "app-1",
  stage: "BIOMETRICS",
  visaType: "Student Visa (Tier 4)",
  submittedAt: new Date("2026-03-01T10:00:00Z"),
  biometricsAt: new Date("2026-04-15T09:00:00Z"),
  interviewAt: null,
  decisionAt: null,
  notes: "Internal note about this visa case — should NOT be exposed.",
  deletedAt: null,
  deletedBy: null,
  createdAt: new Date("2026-02-15T08:00:00Z"),
  updatedAt: new Date("2026-04-16T12:00:00Z"),
  application: {
    id: "app-1",
    applicationNumber: "SV-2026-000001",
    stageKey: "BIOMETRICS",
    status: "ACTIVE",
    country: { id: "c-1", name: "UK", flag: "🇬🇧" },
    university: { id: "u-1", name: "University of Example" },
    course: { id: "course-1", name: "BSc CS" },
  },
};

// Pre-sorted newest-first (h3 → h2 → h1) to simulate Prisma's
// orderBy: { createdAt: "desc" } — the mock ignores the orderBy
// clause, so the fixture must already be in the expected order.
const historyRows = [
  {
    id: "h3",
    fromStage: "SUBMITTED",
    toStage: "BIOMETRICS",
    note: "Biometrics appointment completed",
    createdAt: new Date("2026-04-15T09:00:00Z"),
  },
  {
    id: "h2",
    fromStage: "PREPARATION",
    toStage: "SUBMITTED",
    note: "Visa submitted to embassy",
    createdAt: new Date("2026-03-01T10:00:00Z"),
  },
  {
    id: "h1",
    fromStage: null,
    toStage: "PREPARATION",
    note: "Visa preparation started",
    createdAt: new Date("2026-02-15T08:00:00Z"),
  },
];

const visaRequirements = [
  { id: "vr-1", name: "Valid Passport", description: "Must be valid for 6+ months", required: true, sortOrder: 1 },
  { id: "vr-2", name: "Visa Application Form", description: "Completed online", required: true, sortOrder: 2 },
  { id: "vr-3", name: "Financial Evidence", description: "Bank statements for last 28 days", required: true, sortOrder: 3 },
  { id: "vr-4", name: "TB Test Certificate", description: "If applicable", required: false, sortOrder: 4 },
];

beforeEach(() => {
  vi.resetAllMocks();
  mockAuth.mockResolvedValue({ user: { id: "user-1", role: "STUDENT" } });
  mockStudentFindFirst.mockResolvedValue(baseStudent);
  mockVisaFindMany.mockResolvedValue([baseVisa]);
  mockVisaFindFirst.mockResolvedValue(baseVisa);
  mockStatusHistoryFindMany.mockResolvedValue(historyRows);
  mockVisaRequirementFindMany.mockResolvedValue(visaRequirements);
});

function mockAuthResolved(user: { id: string | null; role?: string }) {
  mockAuth.mockResolvedValue(user.id ? { user } : null);
}

// ─────────────────────────────────────────────
// GET /api/student/visa (list)
// ─────────────────────────────────────────────

describe("GET /api/student/visa (list)", () => {
  it("rejects unauthenticated callers with 401", async () => {
    mockAuthResolved({ id: null });
    const res = await GET_list(new NextRequest("http://localhost/api/student/visa"));
    expect(res.status).toBe(401);
  });

  it("rejects non-STUDENT roles with 403", async () => {
    mockAuthResolved({ id: "user-1", role: "ADMIN" });
    const res = await GET_list(new NextRequest("http://localhost/api/student/visa"));
    expect(res.status).toBe(403);
  });

  it("returns only the caller's visa applications (scoped by studentId)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await GET_list(new NextRequest("http://localhost/api/student/visa"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.visas.length).toBe(1);
    expect(body.data.visas[0].id).toBe("visa-1");
    expect(body.data.visas[0].stage).toBe("BIOMETRICS");
    expect(body.data.visas[0].stageLabel).toBe("Biometrics");
    expect(body.data.visas[0].visaType).toBe("Student Visa (Tier 4)");
    expect(body.data.visas[0].application.country.name).toBe("UK");
    // The `notes` field must NEVER be on the wire.
    expect("notes" in body.data.visas[0]).toBe(false);
  });

  it("scopes the findMany by application.studentId from the session", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await GET_list(new NextRequest("http://localhost/api/student/visa"));
    expect(mockVisaFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deletedAt: null,
          application: expect.objectContaining({ studentId: "stu-1", deletedAt: null }),
        }),
      }),
    );
  });

  it("never exposes internal fields (notes, deletedBy, deletedAt)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await GET_list(new NextRequest("http://localhost/api/student/visa"));
    const body = await res.json();
    for (const v of body.data.visas) {
      expect("notes" in v).toBe(false);
      expect("deletedAt" in v).toBe(false);
      expect("deletedBy" in v).toBe(false);
      expect("applicationId" in v).toBe(false);
    }
  });

  it("returns stageLabel for each visa (human-readable)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await GET_list(new NextRequest("http://localhost/api/student/visa"));
    const body = await res.json();
    expect(body.data.visas[0].stageLabel).toBe("Biometrics");
  });
});

// ─────────────────────────────────────────────
// GET /api/student/visa/[id] (detail)
// ─────────────────────────────────────────────

describe("GET /api/student/visa/[id] (detail)", () => {
  async function callDetail(id: string) {
    return GET_detail(
      new NextRequest(`http://localhost/api/student/visa/${id}`),
      { params: Promise.resolve({ id }) },
    );
  }

  it("rejects unauthenticated callers with 401", async () => {
    mockAuthResolved({ id: null });
    const res = await callDetail("visa-1");
    expect(res.status).toBe(401);
  });

  it("returns 404 when the visa doesn't belong to the caller (IDOR-safe)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    mockVisaFindFirst.mockResolvedValue(null);
    const res = await callDetail("foreign-visa-id");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
    // The 404 message must NOT confirm the visa's existence.
    expect(body.error.message).not.toContain("foreign");
  });

  it("returns the full detail with pipeline + timeline", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await callDetail("visa-1");
    expect(res.status).toBe(200);
    const body = await res.json();
    const visa = body.data.visa;
    expect(visa.id).toBe("visa-1");
    expect(visa.stage).toBe("BIOMETRICS");
    expect(visa.stageLabel).toBe("Biometrics");
    expect(visa.visaType).toBe("Student Visa (Tier 4)");
    expect(visa.submittedAt).toBeDefined();
    expect(visa.biometricsAt).toBeDefined();
    expect(visa.application.country.name).toBe("UK");
    expect(visa.pipeline).toBeDefined();
    expect(visa.pipeline.length).toBeGreaterThan(0);
    expect(visa.timeline).toBeDefined();
    expect(visa.timeline.length).toBe(3);
  });

  it("the `notes` field is NEVER exposed in the detail view", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await callDetail("visa-1");
    const body = await res.json();
    expect("notes" in body.data.visa).toBe(false);
    // Also check the internal notes string is not anywhere in the response
    const bodyStr = JSON.stringify(body);
    expect(bodyStr).not.toContain("Internal note about this visa case");
  });

  it("the pipeline marks the current stage as current and prior as completed", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await callDetail("visa-1");
    const body = await res.json();
    const pipeline = body.data.visa.pipeline;
    // BIOMETRICS is the current stage
    const current = pipeline.find((s: { key: string }) => s.key === "BIOMETRICS");
    expect(current.state).toBe("current");
    // PREPARATION and SUBMITTED are before BIOMETRICS → completed
    const prep = pipeline.find((s: { key: string }) => s.key === "PREPARATION");
    expect(prep.state).toBe("completed");
    const submitted = pipeline.find((s: { key: string }) => s.key === "SUBMITTED");
    expect(submitted.state).toBe("completed");
    // INTERVIEW is after BIOMETRICS → upcoming
    const interview = pipeline.find((s: { key: string }) => s.key === "INTERVIEW");
    expect(interview.state).toBe("upcoming");
  });

  it("the timeline is newest-first", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await callDetail("visa-1");
    const body = await res.json();
    const timeline = body.data.visa.timeline;
    // Newest first: h3 (Apr 15) → h2 (Mar 1) → h1 (Feb 15)
    expect(timeline[0].id).toBe("h3");
    expect(timeline[1].id).toBe("h2");
    expect(timeline[2].id).toBe("h1");
    // Each entry has fromLabel + toLabel (title-cased)
    expect(timeline[0].fromLabel).toBe("Submitted");
    expect(timeline[0].toLabel).toBe("Biometrics");
  });

  it("scopes the findFirst by application.studentId (ownership check)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await callDetail("visa-1");
    expect(mockVisaFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "visa-1",
          deletedAt: null,
          application: expect.objectContaining({ studentId: "stu-1", deletedAt: null }),
        }),
      }),
    );
  });
});

// ─────────────────────────────────────────────
// GET /api/student/visa/requirements
// ─────────────────────────────────────────────

describe("GET /api/student/visa/requirements", () => {
  it("rejects unauthenticated callers with 401", async () => {
    mockAuthResolved({ id: null });
    const res = await GET_requirements(
      new NextRequest("http://localhost/api/student/visa/requirements?countryId=c-1"),
    );
    expect(res.status).toBe(401);
  });

  it("returns 422 when countryId is missing", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await GET_requirements(
      new NextRequest("http://localhost/api/student/visa/requirements"),
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns ACTIVE requirements for the given country", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await GET_requirements(
      new NextRequest("http://localhost/api/student/visa/requirements?countryId=c-1"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.requirements.length).toBe(4);
    expect(body.data.requirements[0].name).toBe("Valid Passport");
    expect(body.data.requirements[0].required).toBe(true);
    expect(body.data.requirements[3].name).toBe("TB Test Certificate");
    expect(body.data.requirements[3].required).toBe(false);
  });

  it("filters by status=ACTIVE at the DB level", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await GET_requirements(
      new NextRequest("http://localhost/api/student/visa/requirements?countryId=c-1"),
    );
    expect(mockVisaRequirementFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          countryId: "c-1",
          status: "ACTIVE",
        }),
      }),
    );
  });

  it("returns requirements sorted by sortOrder then name", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await GET_requirements(
      new NextRequest("http://localhost/api/student/visa/requirements?countryId=c-1"),
    );
    expect(mockVisaRequirementFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
    );
  });

  it("returns an empty array when no requirements exist for the country", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    mockVisaRequirementFindMany.mockResolvedValue([]);
    const res = await GET_requirements(
      new NextRequest("http://localhost/api/student/visa/requirements?countryId=c-99"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.requirements).toEqual([]);
  });
});

// ─────────────────────────────────────────────
// Dates display
// ─────────────────────────────────────────────

describe("visa dates display", () => {
  it("the detail view includes all four date fields (submittedAt, biometricsAt, interviewAt, decisionAt)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await GET_detail(
      new NextRequest("http://localhost/api/student/visa/visa-1"),
      { params: Promise.resolve({ id: "visa-1" }) },
    );
    const body = await res.json();
    expect(body.data.visa.submittedAt).toBeDefined();
    expect(body.data.visa.biometricsAt).toBeDefined();
    expect(body.data.visa.interviewAt).toBeNull(); // not yet scheduled
    expect(body.data.visa.decisionAt).toBeNull(); // not yet decided
  });

  it("the list view includes all four date fields", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await GET_list(new NextRequest("http://localhost/api/student/visa"));
    const body = await res.json();
    const v = body.data.visas[0];
    expect(v.submittedAt).toBeDefined();
    expect(v.biometricsAt).toBeDefined();
    expect(v.interviewAt).toBeNull();
    expect(v.decisionAt).toBeNull();
  });
});
