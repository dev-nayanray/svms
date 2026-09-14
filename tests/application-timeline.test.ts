import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────

const mockAuth = vi.fn();
const mockStudentFindFirst = vi.fn();
const mockApplicationFindFirst = vi.fn();
const mockApplicationStageFindMany = vi.fn();
const mockStatusHistoryFindMany = vi.fn();
const mockUserFindMany = vi.fn();
const mockAuditRecord = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    student: { findFirst: (args: unknown) => mockStudentFindFirst(args) },
    application: { findFirst: (args: unknown) => mockApplicationFindFirst(args) },
    applicationStage: { findMany: (args: unknown) => mockApplicationStageFindMany(args) },
    applicationStatusHistory: { findMany: (args: unknown) => mockStatusHistoryFindMany(args) },
    user: { findMany: (args: unknown) => mockUserFindMany(args) },
  },
}));
vi.mock("@/lib/services/audit", () => ({
  auditLog: { record: (input: unknown) => mockAuditRecord(input) },
}));

import { GET } from "@/app/api/student/application/[id]/timeline/route";

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

const baseApp = {
  id: "app-1",
  applicationNumber: "SV-2026-000001",
  stageKey: "VISA_PREPARATION",
  status: "ACTIVE",
  priority: "MEDIUM",
  updatedAt: new Date("2026-01-10T10:00:00Z"),
  country: { id: "c-1", name: "UK", flag: "🇬🇧" },
  university: { id: "u-1", name: "University A" },
  course: { id: "co-1", name: "BSc CS" },
};

const stages = [
  { key: "LEAD", name: "Lead", sortOrder: 1, enabled: true },
  { key: "COUNSELING", name: "Counseling", sortOrder: 2, enabled: true },
  { key: "DOCUMENT_COLLECTION", name: "Document Collection", sortOrder: 6, enabled: true },
  { key: "APPLICATION_SUBMITTED", name: "Application Submitted", sortOrder: 7, enabled: true },
  { key: "VISA_PREPARATION", name: "Visa Preparation", sortOrder: 12, enabled: true },
  { key: "COMPLETED", name: "Completed", sortOrder: 18, enabled: true },
];

// Pre-sorted newest-first (h3 to h2 to h1) to simulate Prisma's
// orderBy: { createdAt: desc } clause — the mock ignores orderBy, so
// the fixture must already be in the expected order.
const historyRows = [
  {
    id: "h3",
    fromStage: "COUNSELING",
    toStage: "VISA_PREPARATION",
    changedById: "user-3",
    note: "Visa preparation started by counselor.",
    createdAt: new Date("2026-01-08T14:00:00Z"),
  },
  {
    id: "h2",
    fromStage: "LEAD",
    toStage: "COUNSELING",
    changedById: "user-2",
    note: null,
    createdAt: new Date("2026-01-02T10:00:00Z"),
  },
  {
    id: "h1",
    fromStage: null,
    toStage: "LEAD",
    changedById: "user-2",
    note: "Application created",
    createdAt: new Date("2026-01-01T08:00:00Z"),
  },
];

const users = [
  { id: "user-2", name: "Sarah Counselor" },
  { id: "user-3", name: "Admin User" },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ user: { id: "user-1", role: "STUDENT" } });
  mockStudentFindFirst.mockResolvedValue(baseStudent);
  mockApplicationFindFirst.mockResolvedValue(baseApp);
  mockApplicationStageFindMany.mockResolvedValue(stages);
  mockStatusHistoryFindMany.mockResolvedValue(historyRows);
  mockUserFindMany.mockResolvedValue(users);
  mockAuditRecord.mockResolvedValue(undefined);
});

function mockAuthResolved(user: { id: string | null; role?: string }) {
  mockAuth.mockResolvedValue(user.id ? { user } : null);
}

async function callGet(applicationId: string) {
  return GET(
    new NextRequest(`http://localhost/api/student/application/${applicationId}/timeline`),
    { params: Promise.resolve({ id: applicationId }) },
  );
}

// ─────────────────────────────────────────────
// Access control
// ─────────────────────────────────────────────

describe("GET /api/student/application/[id]/timeline (access control)", () => {
  it("rejects unauthenticated callers with 401", async () => {
    mockAuthResolved({ id: null });
    const res = await callGet("app-1");
    expect(res.status).toBe(401);
  });

  it("rejects non-STUDENT roles with 403", async () => {
    mockAuthResolved({ id: "user-1", role: "ADMIN" });
    const res = await callGet("app-1");
    expect(res.status).toBe(403);
  });

  it("rejects STUDENT-without-profile with 403 (not 404)", async () => {
    mockAuthResolved({ id: "user-9", role: "STUDENT" });
    mockStudentFindFirst.mockResolvedValue(null);
    const res = await callGet("app-1");
    expect(res.status).toBe(403);
  });

  it("returns 404 when the application does not belong to the caller (IDOR-safe)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    // student.findFirst still returns the caller's own student so the
    // guard passes; only application.findFirst returns null because
    // the service's where clause excludes foreign apps.
    mockApplicationFindFirst.mockResolvedValue(null);
    const res = await callGet("foreign-app-id");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
    // The 404 message must NOT confirm the application's existence.
    expect(body.error.message).not.toContain("foreign");
  });

  it("uses the studentId resolved from the session, never from the URL or body", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await callGet("app-1");
    // The application.findFirst call must be scoped by the session-
    // resolved studentId, not the URL id alone.
    expect(mockApplicationFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "app-1",
          studentId: "stu-1",
          deletedAt: null,
        }),
      }),
    );
  });
});

// ─────────────────────────────────────────────
// Timeline payload shape
// ─────────────────────────────────────────────

describe("GET /api/student/application/[id]/timeline (payload shape)", () => {
  it("returns the application header fields", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await callGet("app-1");
    expect(res.status).toBe(200);
    const body = await res.json();
    const app = body.data.application;
    expect(app.id).toBe("app-1");
    expect(app.applicationNumber).toBe("SV-2026-000001");
    expect(app.stageKey).toBe("VISA_PREPARATION");
    expect(app.stageLabel).toBe("Visa Preparation");
    expect(app.country.name).toBe("UK");
    expect(app.country.flag).toBe("🇬🇧");
    expect(app.university.name).toBe("University A");
    expect(app.course.name).toBe("BSc CS");
  });

  it("returns the current-stage callout data (label + description + nextDescription)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await callGet("app-1");
    const body = await res.json();
    const cs = body.data.currentStage;
    expect(cs.key).toBe("VISA_PREPARATION");
    expect(cs.label).toBe("Visa Preparation");
    expect(cs.description.toLowerCase()).toContain("visa"); // student-facing copy
    expect(cs.nextDescription).toContain("counselor"); // actionable next-step
    expect(cs.isComplete).toBe(false);
  });

  it("marks isComplete=true only when stageKey is COMPLETED", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    mockApplicationFindFirst.mockResolvedValue({ ...baseApp, stageKey: "COMPLETED" });
    const res = await callGet("app-1");
    const body = await res.json();
    expect(body.data.currentStage.isComplete).toBe(true);
    expect(body.data.currentStage.key).toBe("COMPLETED");
  });

  it("returns the pipeline stages with state markers (completed/current/upcoming)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await callGet("app-1");
    const body = await res.json();
    const stages = body.data.stages;
    expect(stages.length).toBe(6);
    // VISA_PREPARATION is the current stage
    const current = stages.find((s: { key: string }) => s.key === "VISA_PREPARATION");
    expect(current.state).toBe("current");
    // LEAD, COUNSELING are before the current and were reached (history) → completed
    expect(stages.find((s: { key: string }) => s.key === "LEAD").state).toBe("completed");
    expect(stages.find((s: { key: string }) => s.key === "COUNSELING").state).toBe("completed");
    // DOCUMENT_COLLECTION wasn't in the history (the app jumped over it) → skipped
    expect(stages.find((s: { key: string }) => s.key === "DOCUMENT_COLLECTION").state).toBe("skipped");
    // COMPLETED is after the current → upcoming
    expect(stages.find((s: { key: string }) => s.key === "COMPLETED").state).toBe("upcoming");
  });

  it("returns the timeline items in newest-first order", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await callGet("app-1");
    const body = await res.json();
    const items = body.data.timeline;
    expect(items.length).toBe(3);
    // Newest first: h3 (Jan 8) → h2 (Jan 2) → h1 (Jan 1)
    expect(items[0].id).toBe("h3");
    expect(items[1].id).toBe("h2");
    expect(items[2].id).toBe("h1");
    // Each item's createdAt should be monotonically descending
    const times = items.map((i: { createdAt: string }) => new Date(i.createdAt).getTime());
    expect(times[0]).toBeGreaterThan(times[1]);
    expect(times[1]).toBeGreaterThan(times[2]);
  });

  it("returns each timeline item with the student-safe fields only", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await callGet("app-1");
    const body = await res.json();
    const item = body.data.timeline[0];
    // Required student-safe fields:
    expect(item.id).toBeDefined();
    expect(item.fromStage).toBeDefined();
    expect(item.toStage).toBeDefined();
    expect(item.fromLabel).toBeDefined();
    expect(item.toLabel).toBeDefined();
    expect(item.description).toBeDefined();
    expect(item.createdAt).toBeDefined();
    expect(item.changedByName).toBeDefined();
    // The note field is the change-note (student-visible by design).
    // It SHOULD be present (it's the brief label for the transition).
    expect("note" in item).toBe(true);

    // Forbidden internal fields must NOT be present:
    expect("changedById" in item).toBe(false); // internal ObjectId
    expect("ipAddress" in item).toBe(false);
    expect("userAgent" in item).toBe(false);
    expect("auditId" in item).toBe(false);
    expect("internalNote" in item).toBe(false);
  });

  it("resolves changedByName from the User table (no internal IDs exposed)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await callGet("app-1");
    const body = await res.json();
    // h3 was changed by user-3 (Admin User)
    const h3 = body.data.timeline.find((i: { id: string }) => i.id === "h3");
    expect(h3.changedByName).toBe("Admin User");
    // h1 and h2 were changed by user-2 (Sarah Counselor)
    const h1 = body.data.timeline.find((i: { id: string }) => i.id === "h1");
    expect(h1.changedByName).toBe("Sarah Counselor");
  });

  it("the user.findMany call only selects id + name (no email/phone/role)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await callGet("app-1");
    expect(mockUserFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          id: true,
          name: true,
        }),
      }),
    );
    // The select must NOT include email, phone, role, etc.
    const selectArg = mockUserFindMany.mock.calls[0][0].select as Record<string, unknown>;
    expect("email" in selectArg).toBe(false);
    expect("phone" in selectArg).toBe(false);
    expect("role" in selectArg).toBe(false);
    expect("passwordHash" in selectArg).toBe(false);
  });

  it("returns timelineCount (the full history length, not the latest-only count)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await callGet("app-1");
    const body = await res.json();
    expect(body.data.timelineCount).toBe(3);
    expect(body.data.timelineCount).toBe(body.data.timeline.length);
  });
});

// ─────────────────────────────────────────────
// Empty history
// ─────────────────────────────────────────────

describe("GET /api/student/application/[id]/timeline (empty history)", () => {
  it("returns 200 with an empty timeline array when no history records exist", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    mockStatusHistoryFindMany.mockResolvedValue([]);
    // No users to look up either.
    mockUserFindMany.mockResolvedValue([]);
    const res = await callGet("app-1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.timeline).toEqual([]);
    expect(body.data.timelineCount).toBe(0);
    // The current stage callout is still populated from the app's stageKey.
    expect(body.data.currentStage.key).toBe("VISA_PREPARATION");
    expect(body.data.currentStage.description.toLowerCase()).toContain("visa");
  });

  it("does NOT call user.findMany when there are no history records", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    mockStatusHistoryFindMany.mockResolvedValue([]);
    mockUserFindMany.mockClear();
    await callGet("app-1");
    // No users to look up — the early return on empty changedByIds
    // means we skip the user.findMany call entirely.
    expect(mockUserFindMany).not.toHaveBeenCalled();
  });

  it("still returns the pipeline stages even with no history (optimistic completed)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    mockStatusHistoryFindMany.mockResolvedValue([]);
    const res = await callGet("app-1");
    const body = await res.json();
    // Without history, prior stages are optimistically "completed".
    const stages = body.data.stages;
    const current = stages.find((s: { key: string }) => s.key === "VISA_PREPARATION");
    expect(current.state).toBe("current");
    const lead = stages.find((s: { key: string }) => s.key === "LEAD");
    expect(lead.state).toBe("completed"); // optimistic, no history
  });
});

// ─────────────────────────────────────────────
// Null changedById (system-created records)
// ─────────────────────────────────────────────

describe("GET /api/student/application/[id]/timeline (null changedById)", () => {
  it("returns changedByName=null for history records with no changedById", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const rowsWithNull = [
      {
        id: "h1",
        fromStage: null,
        toStage: "LEAD",
        changedById: null, // system-created, no actor
        note: "Application created (system)",
        createdAt: new Date("2026-01-01T08:00:00Z"),
      },
    ];
    mockStatusHistoryFindMany.mockResolvedValue(rowsWithNull);
    mockUserFindMany.mockResolvedValue([]);
    const res = await callGet("app-1");
    const body = await res.json();
    expect(body.data.timeline.length).toBe(1);
    expect(body.data.timeline[0].changedByName).toBeNull();
  });
});

// ─────────────────────────────────────────────
// Multiple applications — isolation
// ─────────────────────────────────────────────

describe("multiple applications — timeline isolation", () => {
  it("the timeline for app-1 returns app-1's history only, never app-2's", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    mockStatusHistoryFindMany.mockResolvedValue(historyRows);
    await callGet("app-1");
    // The statusHistory.findMany call must be scoped by applicationId.
    expect(mockStatusHistoryFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ applicationId: "app-1" }),
      }),
    );
  });

  it("switching to app-2 re-queries with applicationId=app-2 (no cross-app leak)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await callGet("app-2");
    expect(mockStatusHistoryFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ applicationId: "app-2" }),
      }),
    );
  });
});
