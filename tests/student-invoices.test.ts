import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────

const mockAuth = vi.fn();
const mockStudentFindFirst = vi.fn();
const mockInvoiceFindMany = vi.fn();
const mockInvoiceFindFirst = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    student: { findFirst: (args: unknown) => mockStudentFindFirst(args) },
    invoice: {
      findMany: (args: unknown) => mockInvoiceFindMany(args),
      findFirst: (args: unknown) => mockInvoiceFindFirst(args),
    },
  },
}));

import { GET as GET_list } from "@/app/api/student/invoices/route";
import { GET as GET_detail } from "@/app/api/student/invoices/[id]/route";

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

const baseInvoice = {
  id: "inv-1",
  invoiceNumber: "INV-2026-000001",
  studentId: "stu-1",
  applicationId: "app-1",
  items: [
    { description: "Application Fee", quantity: 1, unitPrice: 500 },
    { description: "Service Charge", quantity: 1, unitPrice: 200 },
  ],
  subtotal: 700,
  discount: 0,
  total: 700,
  paidAmount: 300,
  dueAmount: 400,
  status: "PARTIAL",
  issueDate: new Date("2026-03-01T00:00:00Z"),
  dueDate: new Date("2026-04-01T00:00:00Z"),
  deletedAt: null,
  deletedBy: null,
  createdAt: new Date("2026-03-01T08:00:00Z"),
  updatedAt: new Date("2026-03-01T08:00:00Z"),
  application: { id: "app-1", applicationNumber: "SV-2026-000001" },
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const draftInvoice = {
  ...baseInvoice,
  id: "inv-draft",
  invoiceNumber: "INV-DRAFT",
  status: "DRAFT",
  issueDate: null,
  paidAmount: 0,
  dueAmount: 700,
};

const detailInvoice = {
  ...baseInvoice,
  student: {
    firstName: "Karim",
    lastName: "Ahmed",
    email: "k@x.com",
    studentId: "STD-2026-000001",
  },
  payments: [
    {
      id: "pay-1",
      amount: 300,
      currency: "USD",
      paymentMethod: "BKASH",
      status: "PAID",
      paymentDate: new Date("2026-03-15T10:00:00Z"),
      transactionReference: "tx-abc-123",
    },
    {
      id: "pay-2",
      amount: 100,
      currency: "USD",
      paymentMethod: "CASH",
      status: "PENDING",
      paymentDate: null,
      transactionReference: "tx-pending-456",
    },
  ],
};

beforeEach(() => {
  vi.resetAllMocks();
  mockAuth.mockResolvedValue({ user: { id: "user-1", role: "STUDENT" } });
  mockStudentFindFirst.mockResolvedValue(baseStudent);
  mockInvoiceFindMany.mockResolvedValue([baseInvoice]);
  mockInvoiceFindFirst.mockResolvedValue(detailInvoice);
});

function mockAuthResolved(user: { id: string | null; role?: string }) {
  mockAuth.mockResolvedValue(user.id ? { user } : null);
}

// ─────────────────────────────────────────────
// GET /api/student/invoices (list)
// ─────────────────────────────────────────────

describe("GET /api/student/invoices (list)", () => {
  it("rejects unauthenticated callers with 401", async () => {
    mockAuthResolved({ id: null });
    const res = await GET_list(new NextRequest("http://localhost/api/student/invoices"));
    expect(res.status).toBe(401);
  });

  it("rejects non-STUDENT roles with 403", async () => {
    mockAuthResolved({ id: "user-1", role: "ADMIN" });
    const res = await GET_list(new NextRequest("http://localhost/api/student/invoices"));
    expect(res.status).toBe(403);
  });

  it("returns only the caller's invoices (scoped by studentId)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await GET_list(new NextRequest("http://localhost/api/student/invoices"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.invoices.length).toBe(1);
    expect(body.data.invoices[0].invoiceNumber).toBe("INV-2026-000001");
    expect(body.data.invoices[0].statusLabel).toBe("Partial");
    expect(body.data.invoices[0].total).toBe(700);
    expect(body.data.invoices[0].paidAmount).toBe(300);
    expect(body.data.invoices[0].dueAmount).toBe(400);
  });

  it("scopes findMany by studentId from the session", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await GET_list(new NextRequest("http://localhost/api/student/invoices"));
    expect(mockInvoiceFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          studentId: "stu-1",
          deletedAt: null,
        }),
      }),
    );
  });

  it("excludes DRAFT invoices (only ISSUED, PARTIAL, PAID, OVERDUE, CANCELLED)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await GET_list(new NextRequest("http://localhost/api/student/invoices"));
    const whereArg = mockInvoiceFindMany.mock.calls[0][0].where as Record<string, unknown>;
    expect(whereArg.status).toEqual({ in: ["ISSUED", "PARTIAL", "PAID", "OVERDUE", "CANCELLED"] });
    // DRAFT is explicitly NOT in the list
    const statusIn = whereArg.status as { in: string[] };
    expect(statusIn.in).not.toContain("DRAFT");
  });

  it("never exposes internal fields (deletedAt, deletedBy)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await GET_list(new NextRequest("http://localhost/api/student/invoices"));
    const body = await res.json();
    for (const inv of body.data.invoices) {
      expect("deletedAt" in inv).toBe(false);
      expect("deletedBy" in inv).toBe(false);
    }
  });

  it("includes statusLabel for each invoice (human-readable)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await GET_list(new NextRequest("http://localhost/api/student/invoices"));
    const body = await res.json();
    expect(body.data.invoices[0].statusLabel).toBe("Partial");
  });

  it("returns all financial values from the server (total, paidAmount, dueAmount)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await GET_list(new NextRequest("http://localhost/api/student/invoices"));
    const body = await res.json();
    const inv = body.data.invoices[0];
    expect(inv.total).toBe(700);
    expect(inv.paidAmount).toBe(300);
    expect(inv.dueAmount).toBe(400);
    expect(inv.discount).toBe(0);
  });
});

// ─────────────────────────────────────────────
// GET /api/student/invoices/[id] (detail)
// ─────────────────────────────────────────────

describe("GET /api/student/invoices/[id] (detail)", () => {
  async function callDetail(id: string) {
    return GET_detail(
      new NextRequest(`http://localhost/api/student/invoices/${id}`),
      { params: Promise.resolve({ id }) },
    );
  }

  it("rejects unauthenticated callers with 401", async () => {
    mockAuthResolved({ id: null });
    const res = await callDetail("inv-1");
    expect(res.status).toBe(401);
  });

  it("returns 404 when the invoice doesn't belong to the caller (IDOR-safe)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    mockInvoiceFindFirst.mockResolvedValue(null);
    const res = await callDetail("foreign-inv-id");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
    // Never confirm the existence of another student's invoice.
    expect(body.error.message).not.toContain("foreign");
  });

  it("returns 404 for DRAFT invoices (not student-visible)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    mockInvoiceFindFirst.mockResolvedValue(null); // DRAFT excluded by where clause
    const res = await callDetail("inv-draft");
    expect(res.status).toBe(404);
  });

  it("returns the full invoice detail with items + payments", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await callDetail("inv-1");
    expect(res.status).toBe(200);
    const body = await res.json();
    const inv = body.data.invoice;
    expect(inv.id).toBe("inv-1");
    expect(inv.invoiceNumber).toBe("INV-2026-000001");
    expect(inv.statusLabel).toBe("Partial");
    expect(inv.items.length).toBe(2);
    expect(inv.items[0].description).toBe("Application Fee");
    expect(inv.items[0].lineTotal).toBe(500); // 1 × 500
    expect(inv.items[1].lineTotal).toBe(200); // 1 × 200
    expect(inv.subtotal).toBe(700);
    expect(inv.total).toBe(700);
    expect(inv.paidAmount).toBe(300);
    expect(inv.dueAmount).toBe(400);
    expect(inv.student.firstName).toBe("Karim");
    expect(inv.payments.length).toBe(2);
  });

  it("all financial values come from the server (subtotal, discount, total, paid, balance)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await callDetail("inv-1");
    const body = await res.json();
    const inv = body.data.invoice;
    // These are the raw DB values — never client-computed.
    expect(inv.subtotal).toBe(700);
    expect(inv.discount).toBe(0);
    expect(inv.total).toBe(700);
    expect(inv.paidAmount).toBe(300);
    expect(inv.dueAmount).toBe(400);
  });

  it("line items have computed lineTotal (quantity × unitPrice)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await callDetail("inv-1");
    const body = await res.json();
    const inv = body.data.invoice;
    expect(inv.items[0].quantity).toBe(1);
    expect(inv.items[0].unitPrice).toBe(500);
    expect(inv.items[0].lineTotal).toBe(500);
    expect(inv.items[1].quantity).toBe(1);
    expect(inv.items[1].unitPrice).toBe(200);
    expect(inv.items[1].lineTotal).toBe(200);
  });

  it("masks transactionReference for PENDING payments in the detail view", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await callDetail("inv-1");
    const body = await res.json();
    const pendingPayment = body.data.invoice.payments.find((p: { status: string }) => p.status === "PENDING");
    expect(pendingPayment.transactionReference).toBeNull();
    const paidPayment = body.data.invoice.payments.find((p: { status: string }) => p.status === "PAID");
    expect(paidPayment.transactionReference).toBe("tx-abc-123");
  });

  it("never exposes internal fields (deletedAt, deletedBy)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await callDetail("inv-1");
    const body = await res.json();
    expect("deletedAt" in body.data.invoice).toBe(false);
    expect("deletedBy" in body.data.invoice).toBe(false);
  });

  it("scopes findFirst by studentId from the session (ownership check)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await callDetail("inv-1");
    expect(mockInvoiceFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "inv-1",
          studentId: "stu-1",
          deletedAt: null,
        }),
      }),
    );
  });

  it("includes the student information (firstName, lastName, email, studentId)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await callDetail("inv-1");
    const body = await res.json();
    expect(body.data.invoice.student.firstName).toBe("Karim");
    expect(body.data.invoice.student.lastName).toBe("Ahmed");
    expect(body.data.invoice.student.email).toBe("k@x.com");
    expect(body.data.invoice.student.studentId).toBe("STD-2026-000001");
  });

  it("includes the linked application (if any)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await callDetail("inv-1");
    const body = await res.json();
    expect(body.data.invoice.application).not.toBeNull();
    expect(body.data.invoice.application.applicationNumber).toBe("SV-2026-000001");
  });
});
