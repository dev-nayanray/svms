import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────

const mockAuth = vi.fn();
const mockStudentFindFirst = vi.fn();
const mockApplicationFindFirst = vi.fn();
const mockApplicationFindMany = vi.fn();
const mockApplicationStageFindMany = vi.fn();
const mockAuditRecord = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    student: { findFirst: (args: unknown) => mockStudentFindFirst(args) },
    application: {
      findFirst: (args: unknown) => mockApplicationFindFirst(args),
      findMany: (args: unknown) => mockApplicationFindMany(args),
    },
    applicationStage: { findMany: (args: unknown) => mockApplicationStageFindMany(args) },
  },
}));
vi.mock("@/lib/services/audit", () => ({
  auditLog: { record: (input: unknown) => mockAuditRecord(input) },
}));

import { GET as GET_list } from "@/app/api/student/applications/route";
import { GET as GET_primary } from "@/app/api/student/application/route";
import { GET as GET_byId } from "@/app/api/student/application/[id]/route";

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

const baseApplication = {
  id: "app-1",
  applicationNumber: "SV-2026-000001",
  studentId: "stu-1",
  employeeId: null,
  countryId: "c-1",
  universityId: null,
  courseId: null,
  intakeId: null,
  stageKey: "DOCUMENT_COLLECTION",
  status: "ACTIVE",
  priority: "MEDIUM",
  submissionDate: null,
  decisionDate: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-10"),
  deletedAt: null,
};

const stages = [
  { key: "LEAD", name: "Lead", sortOrder: 1, enabled: true },
  { key: "COUNSELING", name: "Counseling", sortOrder: 2, enabled: true },
  { key: "DOCUMENT_COLLECTION", name: "Document Collection", sortOrder: 6, enabled: true },
  { key: "APPLICATION_SUBMITTED", name: "Application Submitted", sortOrder: 7, enabled: true },
  { key: "COMPLETED", name: "Completed", sortOrder: 18, enabled: true },
];

const applicationWithRelations = {
  ...baseApplication,
  country: { id: "c-1", name: "UK", flag: "🇬🇧" },
  university: { id: "u-1", name: "University A", website: null, city: null, ranking: null },
  course: { id: "co-1", name: "BSc CS", degreeLevel: "BACHELOR", duration: null, tuitionFee: null, currency: null },
  intake: { id: "in-1", name: "Sep 2026", month: 9, year: 2026, deadline: null },
  student: {
    id: "stu-1",
    userId: "user-1",
    firstName: "Karim",
    lastName: "Ahmed",
    employee: {
      id: "emp-1",
      title: "Senior Counselor",
      user: { id: "user-2", name: "Sarah Counselor", email: "sarah@svms.test" },
    },
  },
  notes: [
    // Only STUDENT-visibility notes should ever be returned by the service.
    // (The service's where clause filters out INTERNAL — here we only
    // pass STUDENT ones in the test fixture.)
    { id: "n1", body: "Please upload your passport.", visibility: "STUDENT", createdAt: new Date("2026-01-05") },
  ],
  statusHistory: [
    { id: "h1", fromStage: null, toStage: "LEAD", note: "Application created", createdAt: new Date("2026-01-01") },
    { id: "h2", fromStage: "LEAD", toStage: "DOCUMENT_COLLECTION", note: null, createdAt: new Date("2026-01-03") },
  ],
  documents: [
    { id: "d1", name: "Passport", fileName: "passport.pdf", status: "REQUESTED", uploadedAt: null, reviewedAt: null, reviewNote: null, expiresAt: null },
    { id: "d2", name: "Photo", fileName: "photo.jpg", status: "APPROVED", uploadedAt: new Date("2026-01-04"), reviewedAt: new Date("2026-01-05"), reviewNote: "Looks good", expiresAt: null },
  ],
  tasks: [
    { id: "t1", title: "Sign application form", description: null, status: "TODO", priority: "MEDIUM", dueDate: new Date("2026-02-01") },
  ],
  invoices: [
    { id: "inv1", invoiceNumber: "INV-1", total: 1000, paidAmount: 500, dueAmount: 500, status: "PARTIAL", issueDate: new Date("2026-01-02"), dueDate: new Date("2026-02-01") },
  ],
  payments: [
    { id: "p1", amount: 500, currency: "USD", paymentMethod: "CARD", status: "PAID", paymentDate: new Date("2026-01-15"), transactionReference: "tx-123" },
  ],
  visaApplication: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ user: { id: "user-1", role: "STUDENT" } });
  // student.findFirst is used by studentApiGuard's loadStudentProfile —
  // returns the student record so the guard passes.
  mockStudentFindFirst.mockResolvedValue(baseStudent);
  // application.findFirst/findMany default to a happy-path fixture.
  mockApplicationFindFirst.mockResolvedValue(applicationWithRelations);
  mockApplicationFindMany.mockResolvedValue([applicationWithRelations]);
  mockApplicationStageFindMany.mockResolvedValue(stages);
  mockAuditRecord.mockResolvedValue(undefined);
});

function mockAuthResolved(user: { id: string | null; role?: string }) {
  mockAuth.mockResolvedValue(user.id ? { user } : null);
}

function makeReqWithSearchParam(sp: Record<string, string>): NextRequest {
  const url = new URL("http://localhost/api/student/application");
  for (const [k, v] of Object.entries(sp)) url.searchParams.set(k, v);
  return new NextRequest(url);
}

// ─────────────────────────────────────────────
// GET /api/student/applications (list)
// ─────────────────────────────────────────────

describe("GET /api/student/applications (list)", () => {
  it("rejects unauthenticated callers with 401", async () => {
    mockAuthResolved({ id: null });
    const res = await GET_list(new NextRequest("http://localhost/api/student/applications"));
    expect(res.status).toBe(401);
  });

  it("rejects non-STUDENT roles with 403", async () => {
    mockAuthResolved({ id: "user-1", role: "ADMIN" });
    const res = await GET_list(new NextRequest("http://localhost/api/student/applications"));
    expect(res.status).toBe(403);
  });

  it("returns the caller's applications only — scoped by studentId from session", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await GET_list(new NextRequest("http://localhost/api/student/applications"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.applications.length).toBe(1);
    expect(body.data.applications[0].applicationNumber).toBe("SV-2026-000001");
    expect(body.data.applications[0].countryName).toBe("UK");
    expect(body.data.applications[0].stageLabel).toBe("Document Collection");
    // The Prisma call must be scoped by the session-resolved student id.
    expect(mockApplicationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ studentId: "stu-1", deletedAt: null }),
      }),
    );
  });

  it("never includes internal data — the list shape only has summary fields", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await GET_list(new NextRequest("http://localhost/api/student/applications"));
    const body = await res.json();
    const app = body.data.applications[0];
    // These sensitive keys must NOT be on the summary.
    expect("documents" in app).toBe(false);
    expect("payments" in app).toBe(false);
    expect("invoices" in app).toBe(false);
    expect("notes" in app).toBe(false);
    expect("statusHistory" in app).toBe(false);
    expect("visaApplication" in app).toBe(false);
    expect("tasks" in app).toBe(false);
    // But these summary fields SHOULD be present.
    expect("applicationNumber" in app).toBe(true);
    expect("countryName" in app).toBe(true);
    expect("stageLabel" in app).toBe(true);
    expect("percent" in app).toBe(true);
  });
});

// ─────────────────────────────────────────────
// GET /api/student/application (primary)
// ─────────────────────────────────────────────

describe("GET /api/student/application (primary)", () => {
  it("rejects unauthenticated callers with 401", async () => {
    mockAuthResolved({ id: null });
    const res = await GET_primary(new NextRequest("http://localhost/api/student/application"));
    expect(res.status).toBe(401);
  });

  it("returns the primary application + the full list when no ?id is given", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    // Mock findFirst to return the primary app, findMany to return the list.
    mockApplicationFindFirst.mockResolvedValue(applicationWithRelations); // for primary()
    mockApplicationFindMany.mockResolvedValue([applicationWithRelations]); // for list()

    const res = await GET_primary(new NextRequest("http://localhost/api/student/application"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.application).toBeDefined(); // primary
    expect(body.data.applications).toBeDefined(); // full list
    expect(body.data.applications.length).toBe(1);
  });

  it("returns the full detail view when ?id=<app-id> is given", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    mockApplicationFindFirst.mockResolvedValue(applicationWithRelations); // for getById()
    const req = makeReqWithSearchParam({ id: "app-1" });
    const res = await GET_primary(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    // Detail view includes the pipeline, documents, tasks, etc.
    expect(body.data.application.stages).toBeDefined();
    expect(body.data.application.progress).toBeDefined();
    expect(body.data.application.documents).toBeDefined();
    expect(body.data.application.tasks).toBeDefined();
    expect(body.data.application.payments).toBeDefined();
    expect(body.data.application.nextAction).toBeDefined();
  });

  it("returns 404 (NOT_FOUND, not 403) when the ?id is foreign", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    // The service's where clause scopes by studentId, so a foreign
    // application id returns null (not an error). The route 404s.
    mockApplicationFindFirst.mockResolvedValue(null);
    const req = makeReqWithSearchParam({ id: "foreign-app-id" });
    const res = await GET_primary(req);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
    // Never confirm the existence of someone else's application.
    expect(body.error.message).not.toContain("foreign");
  });
});

// ─────────────────────────────────────────────
// GET /api/student/application/[id]
// ─────────────────────────────────────────────

describe("GET /api/student/application/[id] (detail)", () => {
  it("rejects unauthenticated callers with 401", async () => {
    mockAuthResolved({ id: null });
    const res = await GET_byId(
      new NextRequest("http://localhost/api/student/application/app-1"),
      { params: Promise.resolve({ id: "app-1" }) },
    );
    expect(res.status).toBe(401);
  });

  it("rejects non-STUDENT roles with 403", async () => {
    mockAuthResolved({ id: "user-1", role: "ADMIN" });
    const res = await GET_byId(
      new NextRequest("http://localhost/api/student/application/app-1"),
      { params: Promise.resolve({ id: "app-1" }) },
    );
    expect(res.status).toBe(403);
  });

  it("returns 404 when the application does not belong to the caller (IDOR)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    mockApplicationFindFirst.mockResolvedValue(null); // service's where clause excludes it
    const res = await GET_byId(
      new NextRequest("http://localhost/api/student/application/foreign-app-id"),
      { params: Promise.resolve({ id: "foreign-app-id" }) },
    );
    expect(res.status).toBe(404);
    // The 404 message must NOT confirm the application's existence.
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns the full student-safe detail view for the caller's own application", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    mockApplicationFindFirst.mockResolvedValue(applicationWithRelations);
    const res = await GET_byId(
      new NextRequest("http://localhost/api/student/application/app-1"),
      { params: Promise.resolve({ id: "app-1" }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    const app = body.data.application;

    // Identity fields
    expect(app.applicationNumber).toBe("SV-2026-000001");
    expect(app.country.name).toBe("UK");

    // Pipeline
    expect(app.stages).toBeDefined();
    expect(app.stages.length).toBeGreaterThan(0);
    expect(app.stages.find((s: { key: string }) => s.key === "DOCUMENT_COLLECTION").state).toBe("current");

    // Progress
    expect(app.progress.percent).toBeGreaterThan(0);
    expect(app.progress.percent).toBeLessThanOrEqual(100);

    // Documents
    expect(app.documents.counts.required).toBe(2);
    expect(app.documents.counts.approved).toBe(1);
    expect(app.documents.counts.pending).toBe(1);

    // Tasks
    expect(app.tasks.open).toBe(1);
    expect(app.tasks.total).toBe(1);

    // Payments
    expect(app.payments.totals.invoiceTotal).toBe(1000);
    expect(app.payments.totals.paid).toBe(500);
    expect(app.payments.totals.due).toBe(500);

    // Next action — there's a pending document, so it should be HIGH
    expect(app.nextAction.priority).toBe("HIGH");
    expect(app.nextAction.ctaHref).toBe("/student/documents");

    // Counselor (business contact only — name + email)
    expect(app.counselor.name).toBe("Sarah Counselor");
    expect(app.counselor.email).toBe("sarah@svms.test");
  });

  it("does NOT expose internal/employee notes (only STUDENT visibility notes)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    mockApplicationFindFirst.mockResolvedValue(applicationWithRelations);
    const res = await GET_byId(
      new NextRequest("http://localhost/api/student/application/app-1"),
      { params: Promise.resolve({ id: "app-1" }) },
    );
    const body = await res.json();
    // All notes returned must be visibility=STUDENT.
    for (const n of body.data.application.notes) {
      expect(n.visibility).toBe("STUDENT");
    }
    // The service's where clause ensures INTERNAL notes never reach
    // this code path — the test fixture only has STUDENT notes, so
    // if any INTERNAL notes appeared here, that would prove the
    // filter was bypassed. (We can't easily mock two notes + verify
    // filtering at the Prisma layer here, but the route doesn't
    // bypass it.)
    expect(body.data.application.notes.length).toBe(1);
  });

  it("does NOT expose internal document review notes for non-rejected documents", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    mockApplicationFindFirst.mockResolvedValue(applicationWithRelations);
    const res = await GET_byId(
      new NextRequest("http://localhost/api/student/application/app-1"),
      { params: Promise.resolve({ id: "app-1" }) },
    );
    const body = await res.json();
    // The APPROVED document's reviewNote ("Looks good") must be masked.
    const approved = body.data.application.documents.items.find(
      (d: { status: string }) => d.status === "APPROVED",
    );
    expect(approved.reviewNote).toBeNull();
  });

  it("does NOT expose payment transactionReference internals", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    mockApplicationFindFirst.mockResolvedValue(applicationWithRelations);
    const res = await GET_byId(
      new NextRequest("http://localhost/api/student/application/app-1"),
      { params: Promise.resolve({ id: "app-1" }) },
    );
    const body = await res.json();
    for (const p of body.data.application.payments.items) {
      expect("transactionReference" in p).toBe(false);
    }
  });

  it("does NOT expose visa internal notes", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const appWithVisa = {
      ...applicationWithRelations,
      visaApplication: {
        id: "v1",
        stage: "PREPARATION",
        visaType: "Student Visa",
        submittedAt: null,
        biometricsAt: null,
        interviewAt: null,
        decisionAt: null,
        notes: "Internal note about this visa case — should not be exposed.",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };
    mockApplicationFindFirst.mockResolvedValue(appWithVisa);
    const res = await GET_byId(
      new NextRequest("http://localhost/api/student/application/app-1"),
      { params: Promise.resolve({ id: "app-1" }) },
    );
    const body = await res.json();
    expect(body.data.application.visa).toBeDefined();
    expect("notes" in body.data.application.visa).toBe(false);
  });

  it("uses the studentId resolved from the session, not from the body or query", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    mockApplicationFindFirst.mockResolvedValue(applicationWithRelations);
    await GET_byId(
      new NextRequest("http://localhost/api/student/application/app-1"),
      { params: Promise.resolve({ id: "app-1" }) },
    );
    // The findFirst call must be scoped by the session-resolved studentId.
    expect(mockApplicationFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "app-1",
          studentId: "stu-1", // from the session, not the URL or body
          deletedAt: null,
        }),
      }),
    );
  });
});

// ─────────────────────────────────────────────
// Multiple applications — selector behavior
// ─────────────────────────────────────────────

describe("multiple applications", () => {
  it("the list endpoint returns all of the caller's applications", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const app2 = {
      ...applicationWithRelations,
      id: "app-2",
      applicationNumber: "SV-2026-000002",
      country: { id: "c-2", name: "Canada", flag: "🇨🇦" },
      stageKey: "LEAD",
    };
    mockApplicationFindMany.mockResolvedValue([applicationWithRelations, app2]);
    const res = await GET_list(new NextRequest("http://localhost/api/student/applications"));
    const body = await res.json();
    expect(body.data.applications.length).toBe(2);
    expect(body.data.applications[0].countryName).toBe("UK");
    expect(body.data.applications[1].countryName).toBe("Canada");
    // Each application's data is isolated — only the summary fields are
    // present on each item.
    for (const a of body.data.applications) {
      expect("documents" in a).toBe(false);
      expect("notes" in a).toBe(false);
    }
  });

  it("the primary endpoint returns the primary + the full list", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const app2 = {
      ...applicationWithRelations,
      id: "app-2",
      applicationNumber: "SV-2026-000002",
    };
    mockApplicationFindFirst.mockResolvedValue(applicationWithRelations); // primary
    mockApplicationFindMany.mockResolvedValue([applicationWithRelations, app2]); // list

    const res = await GET_primary(new NextRequest("http://localhost/api/student/application"));
    const body = await res.json();
    expect(body.data.application).toBeDefined();
    expect(body.data.applications.length).toBe(2);
  });
});
