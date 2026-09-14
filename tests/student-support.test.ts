import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────

const mockAuth = vi.fn();
const mockStudentFindFirst = vi.fn();
const mockSupportFindMany = vi.fn();
const mockSupportFindFirst = vi.fn();
const mockSupportCreate = vi.fn();
const mockAuditRecord = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    student: { findFirst: (args: unknown) => mockStudentFindFirst(args) },
    supportRequest: {
      findMany: (args: unknown) => mockSupportFindMany(args),
      findFirst: (args: unknown) => mockSupportFindFirst(args),
      create: (args: unknown) => mockSupportCreate(args),
    },
  },
}));
vi.mock("@/lib/services/audit", () => ({
  auditLog: { record: (input: unknown) => mockAuditRecord(input) },
}));

import { GET as GET_list, POST as POST_create } from "@/app/api/student/support/route";
import { GET as GET_detail } from "@/app/api/student/support/[id]/route";
import { GET as GET_faq } from "@/app/api/student/support/faq/route";

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

const baseRequest = {
  id: "sr-1",
  studentId: "stu-1",
  subject: "Can't upload passport",
  category: "DOCUMENTS",
  description: "I keep getting an error when uploading my passport scan.",
  attachmentUrl: null,
  attachmentName: null,
  status: "OPEN",
  priority: "MEDIUM",
  response: null,
  respondedAt: null,
  createdAt: new Date("2026-09-12T10:00:00Z"),
  updatedAt: new Date("2026-09-12T10:00:00Z"),
};

beforeEach(() => {
  vi.resetAllMocks();
  mockAuth.mockResolvedValue({ user: { id: "user-1", role: "STUDENT" } });
  mockStudentFindFirst.mockResolvedValue(baseStudent);
  mockSupportFindMany.mockResolvedValue([baseRequest]);
  mockSupportFindFirst.mockResolvedValue(baseRequest);
  mockSupportCreate.mockResolvedValue(baseRequest);
  mockAuditRecord.mockResolvedValue(undefined);
});

function mockAuthResolved(user: { id: string | null; role?: string }) {
  mockAuth.mockResolvedValue(user.id ? { user } : null);
}

function makePostReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/student/support", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

// ─────────────────────────────────────────────
// GET /api/student/support (list)
// ─────────────────────────────────────────────

describe("GET /api/student/support (list)", () => {
  it("rejects unauthenticated callers with 401", async () => {
    mockAuthResolved({ id: null });
    const res = await GET_list(new NextRequest("http://localhost/api/student/support"));
    expect(res.status).toBe(401);
  });

  it("rejects non-STUDENT roles with 403", async () => {
    mockAuthResolved({ id: "user-1", role: "ADMIN" });
    const res = await GET_list(new NextRequest("http://localhost/api/student/support"));
    expect(res.status).toBe(403);
  });

  it("returns the caller's support requests (scoped by studentId)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await GET_list(new NextRequest("http://localhost/api/student/support"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.requests.length).toBe(1);
    expect(body.data.requests[0].subject).toBe("Can't upload passport");
    expect(body.data.requests[0].statusLabel).toBe("Open");
  });

  it("scopes findMany by studentId from the session", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await GET_list(new NextRequest("http://localhost/api/student/support"));
    expect(mockSupportFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ studentId: "stu-1" }),
      }),
    );
  });

  it("supports ?status=OPEN filter", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await GET_list(new NextRequest("http://localhost/api/student/support?status=OPEN"));
    expect(mockSupportFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ studentId: "stu-1", status: "OPEN" }),
      }),
    );
  });

  it("never exposes internal fields (studentId, respondedById)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await GET_list(new NextRequest("http://localhost/api/student/support"));
    const body = await res.json();
    for (const r of body.data.requests) {
      expect("studentId" in r).toBe(false);
      expect("respondedById" in r).toBe(false);
    }
  });
});

// ─────────────────────────────────────────────
// POST /api/student/support (create)
// ─────────────────────────────────────────────

describe("POST /api/student/support (create)", () => {
  it("rejects unauthenticated callers with 401", async () => {
    mockAuthResolved({ id: null });
    const res = await POST_create(makePostReq({ subject: "Test", category: "VISA", description: "Test description here" }));
    expect(res.status).toBe(401);
  });

  it("returns 422 when subject is too short (<3 chars)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await POST_create(makePostReq({ subject: "Hi", category: "VISA", description: "Test description here" }));
    expect(res.status).toBe(422);
  });

  it("returns 422 when description is too short (<10 chars)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await POST_create(makePostReq({ subject: "Valid subject", category: "VISA", description: "short" }));
    expect(res.status).toBe(422);
  });

  it("returns 422 when category is invalid", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await POST_create(makePostReq({ subject: "Valid subject", category: "INVALID_CAT", description: "Valid description here" }));
    expect(res.status).toBe(422);
  });

  it("creates a support request with studentId from the session", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await POST_create(makePostReq({ subject: "Need help", category: "PAYMENTS", description: "I have a question about my invoice." }));
    expect(res.status).toBe(201);
    expect(mockSupportCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          studentId: "stu-1",
          subject: "Need help",
          category: "PAYMENTS",
          status: "OPEN",
          priority: "MEDIUM",
        }),
      }),
    );
  });

  it("audit-logs the creation", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await POST_create(makePostReq({ subject: "Need help", category: "ACCOUNT", description: "I can't log in properly." }));
    expect(mockAuditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "support_request.created",
        entity: "SupportRequest",
      }),
    );
  });

  it("never trusts studentId from the body — uses session", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await POST_create(makePostReq({ subject: "Need help", category: "ACCOUNT", description: "Valid description here.", studentId: "stu-hack" }));
    expect(mockSupportCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ studentId: "stu-1" }), // from session, not body
      }),
    );
  });
});

// ─────────────────────────────────────────────
// GET /api/student/support/[id] (detail)
// ─────────────────────────────────────────────

describe("GET /api/student/support/[id] (detail)", () => {
  async function callDetail(id: string) {
    return GET_detail(
      new NextRequest(`http://localhost/api/student/support/${id}`),
      { params: Promise.resolve({ id }) },
    );
  }

  it("rejects unauthenticated callers with 401", async () => {
    mockAuthResolved({ id: null });
    const res = await callDetail("sr-1");
    expect(res.status).toBe(401);
  });

  it("returns 404 when the request doesn't belong to the caller (IDOR-safe)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    mockSupportFindFirst.mockResolvedValue(null);
    const res = await callDetail("foreign-sr-id");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns the full support request detail", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await callDetail("sr-1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.request.id).toBe("sr-1");
    expect(body.data.request.subject).toBe("Can't upload passport");
    expect(body.data.request.statusLabel).toBe("Open");
  });

  it("scopes findFirst by studentId (ownership check)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await callDetail("sr-1");
    expect(mockSupportFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "sr-1", studentId: "stu-1" }),
      }),
    );
  });
});

// ─────────────────────────────────────────────
// GET /api/student/support/faq
// ─────────────────────────────────────────────

describe("GET /api/student/support/faq", () => {
  it("rejects unauthenticated callers with 401", async () => {
    mockAuthResolved({ id: null });
    const res = await GET_faq(new NextRequest("http://localhost/api/student/support/faq"));
    expect(res.status).toBe(401);
  });

  it("returns all FAQ items when no filter", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await GET_faq(new NextRequest("http://localhost/api/student/support/faq"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.faq.length).toBeGreaterThan(0);
    // Each FAQ has id, category, question, answer
    expect(body.data.faq[0].id).toBeDefined();
    expect(body.data.faq[0].category).toBeDefined();
    expect(body.data.faq[0].question).toBeDefined();
    expect(body.data.faq[0].answer).toBeDefined();
  });

  it("supports ?category=Documents filter", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await GET_faq(new NextRequest("http://localhost/api/student/support/faq?category=Documents"));
    const body = await res.json();
    for (const item of body.data.faq) {
      expect(item.category).toBe("Documents");
    }
  });

  it("supports ?search=upload filter", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await GET_faq(new NextRequest("http://localhost/api/student/support/faq?search=upload"));
    const body = await res.json();
    for (const item of body.data.faq) {
      expect(
        item.question.toLowerCase().includes("upload") ||
        item.answer.toLowerCase().includes("upload")
      ).toBe(true);
    }
  });

  it("returns empty array when search matches nothing", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await GET_faq(new NextRequest("http://localhost/api/student/support/faq?search=xyznotfound"));
    const body = await res.json();
    expect(body.data.faq).toEqual([]);
  });
});
