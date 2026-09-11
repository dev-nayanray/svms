import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────

const mockAuth = vi.fn();
const mockStudentFindFirst = vi.fn();
const mockPaymentFindMany = vi.fn();
const mockPaymentFindFirst = vi.fn();
const mockInvoiceFindMany = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    student: { findFirst: (args: unknown) => mockStudentFindFirst(args) },
    payment: {
      findMany: (args: unknown) => mockPaymentFindMany(args),
      findFirst: (args: unknown) => mockPaymentFindFirst(args),
    },
    invoice: { findMany: (args: unknown) => mockInvoiceFindMany(args) },
  },
}));

import { GET as GET_list } from "@/app/api/student/payments/route";
import { GET as GET_detail } from "@/app/api/student/payments/[id]/route";
import { GET as GET_summary } from "@/app/api/student/payments/summary/route";

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

const basePayment = {
  id: "pay-1",
  studentId: "stu-1",
  applicationId: "app-1",
  invoiceId: "inv-1",
  amount: 500,
  currency: "USD",
  paymentMethod: "BKASH",
  transactionReference: "tx-abc-123",
  status: "PAID",
  paymentDate: new Date("2026-03-15T10:00:00Z"),
  createdById: "user-2",
  deletedAt: null,
  deletedBy: null,
  createdAt: new Date("2026-03-15T10:00:00Z"),
  updatedAt: new Date("2026-03-15T10:00:00Z"),
  application: { id: "app-1", applicationNumber: "SV-2026-000001" },
  invoice: { id: "inv-1", invoiceNumber: "INV-1", total: 1000, paidAmount: 500, dueAmount: 500, status: "PARTIAL" },
};

const pendingPayment = {
  ...basePayment,
  id: "pay-2",
  status: "PENDING",
  transactionReference: "tx-pending-456",
  paymentDate: null,
};

const refundedPayment = {
  ...basePayment,
  id: "pay-3",
  status: "REFUNDED",
  transactionReference: "tx-refund-789",
};

const cancelledPayment = {
  ...basePayment,
  id: "pay-4",
  status: "CANCELLED",
  transactionReference: "tx-cancel-000",
};

const baseInvoices = [
  {
    id: "inv-1",
    invoiceNumber: "INV-1",
    total: 1000,
    paidAmount: 500,
    dueAmount: 500,
    status: "PARTIAL",
    dueDate: new Date("2026-04-01T00:00:00Z"),
  },
  {
    id: "inv-2",
    invoiceNumber: "INV-2",
    total: 2000,
    paidAmount: 2000,
    dueAmount: 0,
    status: "PAID",
    dueDate: new Date("2026-03-01T00:00:00Z"),
  },
];

const basePaymentsForSummary = [
  { amount: 500, currency: "USD", status: "PAID" },
  { amount: 200, currency: "USD", status: "PENDING" },
];

beforeEach(() => {
  vi.resetAllMocks();
  mockAuth.mockResolvedValue({ user: { id: "user-1", role: "STUDENT" } });
  mockStudentFindFirst.mockResolvedValue(baseStudent);
  mockPaymentFindMany.mockResolvedValue([basePayment]);
  mockPaymentFindFirst.mockResolvedValue(basePayment);
  mockInvoiceFindMany.mockResolvedValue(baseInvoices);
});

function mockAuthResolved(user: { id: string | null; role?: string }) {
  mockAuth.mockResolvedValue(user.id ? { user } : null);
}

// ─────────────────────────────────────────────
// GET /api/student/payments (list)
// ─────────────────────────────────────────────

describe("GET /api/student/payments (list)", () => {
  it("rejects unauthenticated callers with 401", async () => {
    mockAuthResolved({ id: null });
    const res = await GET_list(new NextRequest("http://localhost/api/student/payments"));
    expect(res.status).toBe(401);
  });

  it("rejects non-STUDENT roles with 403", async () => {
    mockAuthResolved({ id: "user-1", role: "ADMIN" });
    const res = await GET_list(new NextRequest("http://localhost/api/student/payments"));
    expect(res.status).toBe(403);
  });

  it("returns only the caller's payments (scoped by studentId)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await GET_list(new NextRequest("http://localhost/api/student/payments"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.payments.length).toBe(1);
    expect(body.data.payments[0].id).toBe("pay-1");
    expect(body.data.payments[0].amount).toBe(500);
    expect(body.data.payments[0].paymentMethodLabel).toBe("bKash");
    expect(body.data.payments[0].statusLabel).toBe("Paid");
  });

  it("scopes findMany by studentId from the session", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await GET_list(new NextRequest("http://localhost/api/student/payments"));
    expect(mockPaymentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ studentId: "stu-1", deletedAt: null }),
      }),
    );
  });

  it("never exposes internal fields (createdById, deletedAt, deletedBy)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await GET_list(new NextRequest("http://localhost/api/student/payments"));
    const body = await res.json();
    for (const p of body.data.payments) {
      expect("createdById" in p).toBe(false);
      expect("deletedAt" in p).toBe(false);
      expect("deletedBy" in p).toBe(false);
    }
  });

  it("shows transactionReference for PAID payments", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await GET_list(new NextRequest("http://localhost/api/student/payments"));
    const body = await res.json();
    expect(body.data.payments[0].transactionReference).toBe("tx-abc-123");
  });

  it("masks transactionReference for PENDING payments", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    mockPaymentFindMany.mockResolvedValue([pendingPayment]);
    const res = await GET_list(new NextRequest("http://localhost/api/student/payments"));
    const body = await res.json();
    expect(body.data.payments[0].transactionReference).toBeNull();
  });

  it("shows transactionReference for REFUNDED payments", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    mockPaymentFindMany.mockResolvedValue([refundedPayment]);
    const res = await GET_list(new NextRequest("http://localhost/api/student/payments"));
    const body = await res.json();
    expect(body.data.payments[0].transactionReference).toBe("tx-refund-789");
  });

  it("masks transactionReference for CANCELLED payments", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    mockPaymentFindMany.mockResolvedValue([cancelledPayment]);
    const res = await GET_list(new NextRequest("http://localhost/api/student/payments"));
    const body = await res.json();
    expect(body.data.payments[0].transactionReference).toBeNull();
  });
});

// ─────────────────────────────────────────────
// GET /api/student/payments/[id] (detail)
// ─────────────────────────────────────────────

describe("GET /api/student/payments/[id] (detail)", () => {
  async function callDetail(id: string) {
    return GET_detail(
      new NextRequest(`http://localhost/api/student/payments/${id}`),
      { params: Promise.resolve({ id }) },
    );
  }

  it("rejects unauthenticated callers with 401", async () => {
    mockAuthResolved({ id: null });
    const res = await callDetail("pay-1");
    expect(res.status).toBe(401);
  });

  it("returns 404 when the payment doesn't belong to the caller (IDOR-safe)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    mockPaymentFindFirst.mockResolvedValue(null);
    const res = await callDetail("foreign-pay-id");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns the full payment detail with invoice + application", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await callDetail("pay-1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.payment.id).toBe("pay-1");
    expect(body.data.payment.amount).toBe(500);
    expect(body.data.payment.invoice.invoiceNumber).toBe("INV-1");
    expect(body.data.payment.application.applicationNumber).toBe("SV-2026-000001");
  });

  it("scopes findFirst by studentId from the session (ownership check)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await callDetail("pay-1");
    expect(mockPaymentFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "pay-1",
          studentId: "stu-1",
          deletedAt: null,
        }),
      }),
    );
  });

  it("never exposes internal fields in the detail view", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await callDetail("pay-1");
    const body = await res.json();
    expect("createdById" in body.data.payment).toBe(false);
    expect("deletedAt" in body.data.payment).toBe(false);
    expect("deletedBy" in body.data.payment).toBe(false);
  });
});

// ─────────────────────────────────────────────
// GET /api/student/payments/summary
// ─────────────────────────────────────────────

describe("GET /api/student/payments/summary", () => {
  it("rejects unauthenticated callers with 401", async () => {
    mockAuthResolved({ id: null });
    const res = await GET_summary(new NextRequest("http://localhost/api/student/payments/summary"));
    expect(res.status).toBe(401);
  });

  it("returns the financial summary computed server-side", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    // The summary service queries both invoices AND payments.
    // Mock the payments to include a PENDING one so the pending
    // total is non-zero.
    mockPaymentFindMany.mockResolvedValue(basePaymentsForSummary);
    const res = await GET_summary(new NextRequest("http://localhost/api/student/payments/summary"));
    expect(res.status).toBe(200);
    const body = await res.json();
    const s = body.data.summary;
    expect(s.totalAmount).toBe(3000); // 1000 + 2000
    expect(s.paid).toBe(2500); // 500 + 2000
    expect(s.outstanding).toBe(500); // 500 + 0
    expect(s.pending).toBe(200); // the PENDING payment amount
    expect(s.currency).toBe("USD");
    expect(s.invoiceCount).toBe(2);
    expect(s.paymentCount).toBe(2);
  });

  it("excludes DRAFT and CANCELLED invoices from totals", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    mockInvoiceFindMany.mockResolvedValue([
      ...baseInvoices,
      { id: "inv-3", invoiceNumber: "INV-3", total: 500, paidAmount: 0, dueAmount: 500, status: "DRAFT", dueDate: null },
      { id: "inv-4", invoiceNumber: "INV-4", total: 300, paidAmount: 300, dueAmount: 0, status: "CANCELLED", dueDate: null },
    ]);
    const res = await GET_summary(new NextRequest("http://localhost/api/student/payments/summary"));
    const body = await res.json();
    // Only INV-1 and INV-2 count (DRAFT and CANCELLED excluded)
    expect(body.data.summary.totalAmount).toBe(3000); // 1000 + 2000 (not 500 or 300)
    expect(body.data.summary.invoiceCount).toBe(2); // not 4
  });

  it("identifies the next open invoice (earliest due with outstanding balance)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await GET_summary(new NextRequest("http://localhost/api/student/payments/summary"));
    const body = await res.json();
    expect(body.data.summary.nextOpenInvoice).not.toBeNull();
    expect(body.data.summary.nextOpenInvoice.invoiceNumber).toBe("INV-1");
    expect(body.data.summary.nextOpenInvoice.dueAmount).toBe(500);
  });

  it("returns null for nextOpenInvoice when all invoices are paid", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    mockInvoiceFindMany.mockResolvedValue([
      { id: "inv-2", invoiceNumber: "INV-2", total: 2000, paidAmount: 2000, dueAmount: 0, status: "PAID", dueDate: new Date("2026-03-01") },
    ]);
    const res = await GET_summary(new NextRequest("http://localhost/api/student/payments/summary"));
    const body = await res.json();
    expect(body.data.summary.nextOpenInvoice).toBeNull();
    expect(body.data.summary.outstanding).toBe(0);
  });

  it("returns zero totals when the student has no invoices or payments", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    mockInvoiceFindMany.mockResolvedValue([]);
    // The service also queries payments — mock them empty
    // (but mockPaymentFindMany is already used by the list route,
    // not the summary. The summary uses a separate query. Let me
    // check the service code...)
    // Actually, the summary queries prisma.invoice.findMany and
    // prisma.payment.findMany in parallel. I need to mock both.
    // But mockPaymentFindMany is shared. Let me set it.
    mockPaymentFindMany.mockResolvedValue([]);
    const res = await GET_summary(new NextRequest("http://localhost/api/student/payments/summary"));
    const body = await res.json();
    expect(body.data.summary.totalAmount).toBe(0);
    expect(body.data.summary.paid).toBe(0);
    expect(body.data.summary.outstanding).toBe(0);
    expect(body.data.summary.pending).toBe(0);
    expect(body.data.summary.nextOpenInvoice).toBeNull();
  });

  it("scopes invoice + payment queries by studentId from the session", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await GET_summary(new NextRequest("http://localhost/api/student/payments/summary"));
    expect(mockInvoiceFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ studentId: "stu-1", deletedAt: null }),
      }),
    );
    expect(mockPaymentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ studentId: "stu-1", deletedAt: null }),
      }),
    );
  });
});

// ─────────────────────────────────────────────
// Payment method labels
// ─────────────────────────────────────────────

describe("payment method labels", () => {
  it("returns the correct human-readable label for each method", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const methods = [
      { method: "CASH", expected: "Cash" },
      { method: "BANK_TRANSFER", expected: "Bank Transfer" },
      { method: "BKASH", expected: "bKash" },
      { method: "NAGAD", expected: "Nagad" },
      { method: "CARD", expected: "Card" },
      { method: "OTHER", expected: "Other" },
    ];

    for (const { method, expected } of methods) {
      mockPaymentFindMany.mockResolvedValue([{ ...basePayment, paymentMethod: method }]);
      const res = await GET_list(new NextRequest("http://localhost/api/student/payments"));
      const body = await res.json();
      expect(body.data.payments[0].paymentMethodLabel).toBe(expected);
    }
  });
});
