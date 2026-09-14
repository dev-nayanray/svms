import { describe, it, expect, vi, beforeEach } from "vitest";

// Pure calculation tests
import {
  computeInvoiceTotals,
  computeBalance,
  computeInvoiceStatus,
  INVOICE_STATUSES,
} from "@/lib/services/invoice-cases";

describe("computeInvoiceTotals", () => {
  it("computes subtotal, discount, tax, total from line items", () => {
    const items = [
      { quantity: 2, unitPrice: 100 },
      { quantity: 1, unitPrice: 50 },
    ];
    const result = computeInvoiceTotals(items, 50, 19);
    // subtotal = 250, discount = 50, taxable = 200, tax = 38, total = 238
    expect(result.subtotal).toBe(250);
    expect(result.discount).toBe(50);
    expect(result.tax).toBe(38);
    expect(result.total).toBe(238);
  });

  it("handles zero discount and zero tax", () => {
    const items = [{ quantity: 1, unitPrice: 500 }];
    const result = computeInvoiceTotals(items, 0, 0);
    expect(result.subtotal).toBe(500);
    expect(result.discount).toBe(0);
    expect(result.tax).toBe(0);
    expect(result.total).toBe(500);
  });

  it("handles empty items array", () => {
    const result = computeInvoiceTotals([], 0, 0);
    expect(result.subtotal).toBe(0);
    expect(result.total).toBe(0);
  });

  it("discount cannot exceed subtotal (clamped to 0)", () => {
    const items = [{ quantity: 1, unitPrice: 100 }];
    const result = computeInvoiceTotals(items, 200, 0);
    expect(result.subtotal).toBe(100);
    expect(result.discount).toBe(200); // raw value stored
    expect(result.total).toBe(0); // max(0, 100 - 200) = 0
  });

  it("rounds to 2 decimal places", () => {
    const items = [{ quantity: 3, unitPrice: 33.33 }];
    const result = computeInvoiceTotals(items, 0, 19);
    // subtotal = 99.99, tax = 99.99 * 0.19 = 18.9981 → 19.00, total = 118.99
    expect(result.subtotal).toBe(99.99);
    expect(result.tax).toBe(19.0);
    expect(result.total).toBe(118.99);
  });
});

describe("computeBalance", () => {
  it("returns total - paidAmount", () => {
    expect(computeBalance(500, 200)).toBe(300);
    expect(computeBalance(500, 500)).toBe(0);
  });

  it("never returns negative balance", () => {
    expect(computeBalance(100, 200)).toBe(0); // overpayment → clamped to 0
  });

  it("rounds to 2 decimal places", () => {
    expect(computeBalance(100.555, 50.111)).toBe(50.44); // (100.555 - 50.111) * 100 = 5044.4 → 50.44
  });
});

describe("computeInvoiceStatus", () => {
  const now = new Date("2026-09-14T12:00:00Z");
  const pastDue = new Date("2026-08-01");
  const futureDue = new Date("2026-12-01");

  it("returns CANCELLED when current status is CANCELLED", () => {
    expect(computeInvoiceStatus(500, 0, pastDue, "CANCELLED", now)).toBe("CANCELLED");
  });

  it("returns DRAFT when current status is DRAFT", () => {
    expect(computeInvoiceStatus(500, 0, null, "DRAFT", now)).toBe("DRAFT");
  });

  it("returns PAID when paidAmount >= total", () => {
    expect(computeInvoiceStatus(500, 500, null, "ISSUED", now)).toBe("PAID");
    expect(computeInvoiceStatus(500, 600, null, "ISSUED", now)).toBe("PAID");
  });

  it("returns PARTIAL when 0 < paidAmount < total", () => {
    expect(computeInvoiceStatus(500, 200, null, "ISSUED", now)).toBe("PARTIAL");
  });

  it("returns OVERDUE when dueDate is past and unpaid", () => {
    expect(computeInvoiceStatus(500, 0, pastDue, "ISSUED", now)).toBe("OVERDUE");
    expect(computeInvoiceStatus(500, 200, pastDue, "ISSUED", now)).toBe("PARTIAL"); // partial takes precedence
  });

  it("returns ISSUED when not overdue and unpaid", () => {
    expect(computeInvoiceStatus(500, 0, futureDue, "ISSUED", now)).toBe("ISSUED");
    expect(computeInvoiceStatus(500, 0, null, "ISSUED", now)).toBe("ISSUED");
  });
});

describe("INVOICE_STATUSES", () => {
  it("has 6 statuses", () => {
    expect(INVOICE_STATUSES).toEqual(["DRAFT", "ISSUED", "PARTIAL", "PAID", "OVERDUE", "CANCELLED"]);
  });
});

// Service tests with mocked prisma
const prismaMock = vi.hoisted(() => ({
  invoice: { findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn(), update: vi.fn(), create: vi.fn() },
  invoiceItem: { createMany: vi.fn() },
  student: { findFirst: vi.fn(), findUnique: vi.fn() },
  payment: { findMany: vi.fn() },
  notification: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  auditLog: { create: vi.fn() },
  $transaction: vi.fn((fn: unknown) => {
    if (typeof fn === "function") return fn(prismaMock);
    return Promise.all(fn as unknown[]);
  }),
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import {
  listInvoices,
  getInvoiceById,
  requireInvoice,
  createInvoice,
  issueInvoice,
  cancelInvoice,
  generateInvoiceNumber,
} from "@/lib/services/invoice-cases";
import type { EmployeeScope } from "@/lib/services/employee-dashboard";

const ADMIN_SCOPE: EmployeeScope = { isAdmin: true, userId: "u-admin", employeeId: null };
const EMPLOYEE_SCOPE: EmployeeScope = { isAdmin: false, userId: "u-emp", employeeId: "emp-1" };

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────
// IDOR closure
// ─────────────────────────────────────────────

describe("invoice IDOR closure", () => {
  it("EMPLOYEE scope embeds student.assignedEmployeeId filter", async () => {
    prismaMock.invoice.findMany.mockResolvedValue([]);
    prismaMock.invoice.count.mockResolvedValue(0);
    await listInvoices(EMPLOYEE_SCOPE, {});
    const call = prismaMock.invoice.findMany.mock.calls[0][0];
    expect(call.where.student).toEqual({ assignedEmployeeId: "emp-1" });
  });

  it("ADMIN scope is empty — sees all invoices", async () => {
    prismaMock.invoice.findMany.mockResolvedValue([]);
    prismaMock.invoice.count.mockResolvedValue(0);
    await listInvoices(ADMIN_SCOPE, {});
    const call = prismaMock.invoice.findMany.mock.calls[0][0];
    expect(call.where.student).toBeUndefined();
  });

  it("getInvoiceById returns null for foreign invoices", async () => {
    prismaMock.invoice.findFirst.mockResolvedValue(null);
    const result = await getInvoiceById(EMPLOYEE_SCOPE, "inv-foreign");
    expect(result).toBeNull();
  });

  it("requireInvoice throws 404 for missing/foreign", async () => {
    prismaMock.invoice.findFirst.mockResolvedValue(null);
    await expect(requireInvoice(EMPLOYEE_SCOPE, "inv-missing")).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
  });
});

// ─────────────────────────────────────────────
// Create — server-side calculations + invoice number uniqueness
// ─────────────────────────────────────────────

describe("createInvoice", () => {
  it("creates invoice with server-computed totals", async () => {
    prismaMock.student.findFirst.mockResolvedValue({ id: "s1" });
    prismaMock.invoice.count.mockResolvedValue(0);
    prismaMock.invoice.findFirst.mockResolvedValue(null); // invoice number unique
    prismaMock.invoice.create.mockResolvedValue({ id: "inv-1" });
    prismaMock.invoiceItem.createMany.mockResolvedValue({});
    prismaMock.auditLog.create.mockResolvedValue({});

    const result = await createInvoice(EMPLOYEE_SCOPE, {
      studentId: "s1",
      items: [
        { description: "Tuition fee", quantity: 1, unitPrice: 500 },
        { description: "Registration", quantity: 1, unitPrice: 50 },
      ],
      discount: 50,
      taxRate: 19,
    }, { id: "u-emp" });

    expect(result.invoiceNumber).toMatch(/^INV-\d{4}-\d{5}$/);
    // Verify the create call used server-computed totals, not browser-supplied
    const createCall = prismaMock.invoice.create.mock.calls[0][0];
    expect(createCall.data.subtotal).toBe(550);
    expect(createCall.data.discount).toBe(50);
    expect(createCall.data.tax).toBe(95); // (550 - 50) * 0.19 = 95
    expect(createCall.data.total).toBe(595); // 500 + 95 = 595
    expect(createCall.data.paidAmount).toBe(0);
    expect(createCall.data.balance).toBe(595);
    expect(createCall.data.status).toBe("DRAFT");
  });

  it("blocks creating invoices for foreign students (IDOR 403)", async () => {
    prismaMock.student.findFirst.mockResolvedValue(null);
    await expect(createInvoice(EMPLOYEE_SCOPE, {
      studentId: "stu-foreign",
      items: [{ description: "Test", quantity: 1, unitPrice: 100 }],
    }, { id: "u-emp" })).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
  });

  it("rejects empty items array (422)", async () => {
    await expect(createInvoice(ADMIN_SCOPE, {
      studentId: "s1",
      items: [],
    }, { id: "u-admin" })).rejects.toMatchObject({ status: 422, code: "VALIDATION_ERROR" });
  });

  it("rejects negative unit price (422)", async () => {
    await expect(createInvoice(ADMIN_SCOPE, {
      studentId: "s1",
      items: [{ description: "Test", quantity: 1, unitPrice: -100 }],
    }, { id: "u-admin" })).rejects.toMatchObject({ status: 422, code: "VALIDATION_ERROR" });
  });

  it("rejects quantity < 1 (422)", async () => {
    await expect(createInvoice(ADMIN_SCOPE, {
      studentId: "s1",
      items: [{ description: "Test", quantity: 0, unitPrice: 100 }],
    }, { id: "u-admin" })).rejects.toMatchObject({ status: 422, code: "VALIDATION_ERROR" });
  });

  it("emits audit log on creation", async () => {
    prismaMock.student.findFirst.mockResolvedValue({ id: "s1" });
    prismaMock.invoice.count.mockResolvedValue(0);
    prismaMock.invoice.findFirst.mockResolvedValue(null);
    prismaMock.invoice.create.mockResolvedValue({ id: "inv-1" });
    prismaMock.invoiceItem.createMany.mockResolvedValue({});
    prismaMock.auditLog.create.mockResolvedValue({});
    await createInvoice(ADMIN_SCOPE, {
      studentId: "s1",
      items: [{ description: "Test", quantity: 1, unitPrice: 100 }],
    }, { id: "u-admin" });
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "invoice.created" }),
    }));
  });
});

// ─────────────────────────────────────────────
// Issue — DRAFT → ISSUED
// ─────────────────────────────────────────────

describe("issueInvoice", () => {
  it("issues a DRAFT invoice (→ ISSUED)", async () => {
    prismaMock.invoice.findFirst.mockResolvedValue({ id: "inv-1", status: "DRAFT", studentId: "s1", invoiceNumber: "INV-2026-00001" });
    prismaMock.invoice.update.mockResolvedValue({});
    prismaMock.student.findUnique.mockResolvedValue({ userId: "u-stu" });
    prismaMock.notification.findFirst.mockResolvedValue(null);
    prismaMock.notification.create.mockResolvedValue({});
    prismaMock.auditLog.create.mockResolvedValue({});
    await issueInvoice(EMPLOYEE_SCOPE, "inv-1", { id: "u-emp" });
    expect(prismaMock.invoice.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "ISSUED" }),
    }));
  });

  it("blocks issuing a non-DRAFT invoice (409)", async () => {
    prismaMock.invoice.findFirst.mockResolvedValue({ id: "inv-1", status: "ISSUED", studentId: "s1", invoiceNumber: "X" });
    await expect(issueInvoice(EMPLOYEE_SCOPE, "inv-1", { id: "u-emp" })).rejects.toMatchObject({ status: 409, code: "CONFLICT" });
  });

  it("emits notification + audit on issue", async () => {
    prismaMock.invoice.findFirst.mockResolvedValue({ id: "inv-1", status: "DRAFT", studentId: "s1", invoiceNumber: "INV-2026-00001" });
    prismaMock.invoice.update.mockResolvedValue({});
    prismaMock.student.findUnique.mockResolvedValue({ userId: "u-stu" });
    prismaMock.notification.findFirst.mockResolvedValue(null);
    prismaMock.notification.create.mockResolvedValue({});
    prismaMock.auditLog.create.mockResolvedValue({});
    await issueInvoice(EMPLOYEE_SCOPE, "inv-1", { id: "u-emp" });
    expect(prismaMock.notification.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ type: "INVOICE_ISSUED" }),
    }));
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "invoice.issued" }),
    }));
  });

  it("IDOR: foreign invoice returns 404", async () => {
    prismaMock.invoice.findFirst.mockResolvedValue(null);
    await expect(issueInvoice(EMPLOYEE_SCOPE, "inv-foreign", { id: "u-emp" })).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
  });
});

// ─────────────────────────────────────────────
// Cancel
// ─────────────────────────────────────────────

describe("cancelInvoice", () => {
  it("cancels an ISSUED invoice with no payments", async () => {
    prismaMock.invoice.findFirst.mockResolvedValue({ id: "inv-1", status: "ISSUED", paidAmount: 0, total: 500, invoiceNumber: "X" });
    prismaMock.invoice.update.mockResolvedValue({});
    prismaMock.auditLog.create.mockResolvedValue({});
    await cancelInvoice(EMPLOYEE_SCOPE, "inv-1", { id: "u-emp" });
    expect(prismaMock.invoice.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "CANCELLED" }),
    }));
  });

  it("is a no-op when already CANCELLED", async () => {
    prismaMock.invoice.findFirst.mockResolvedValue({ id: "inv-1", status: "CANCELLED", paidAmount: 0, total: 500, invoiceNumber: "X" });
    await cancelInvoice(EMPLOYEE_SCOPE, "inv-1", { id: "u-emp" });
    expect(prismaMock.invoice.update).not.toHaveBeenCalled();
  });

  it("blocks cancelling a PAID invoice (409)", async () => {
    prismaMock.invoice.findFirst.mockResolvedValue({ id: "inv-1", status: "PAID", paidAmount: 500, total: 500, invoiceNumber: "X" });
    await expect(cancelInvoice(EMPLOYEE_SCOPE, "inv-1", { id: "u-emp" })).rejects.toMatchObject({ status: 409, code: "CONFLICT" });
  });

  it("blocks cancelling an invoice with partial payments (409)", async () => {
    prismaMock.invoice.findFirst.mockResolvedValue({ id: "inv-1", status: "PARTIAL", paidAmount: 200, total: 500, invoiceNumber: "X" });
    await expect(cancelInvoice(EMPLOYEE_SCOPE, "inv-1", { id: "u-emp" })).rejects.toMatchObject({ status: 409, code: "CONFLICT" });
  });

  it("IDOR: foreign invoice returns 404", async () => {
    prismaMock.invoice.findFirst.mockResolvedValue(null);
    await expect(cancelInvoice(EMPLOYEE_SCOPE, "inv-foreign", { id: "u-emp" })).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
  });
});

// ─────────────────────────────────────────────
// Invoice number generation
// ─────────────────────────────────────────────

describe("generateInvoiceNumber", () => {
  it("generates a unique invoice number", async () => {
    prismaMock.invoice.count.mockResolvedValue(0);
    prismaMock.invoice.findFirst.mockResolvedValue(null); // no collision
    const num = await generateInvoiceNumber();
    expect(num).toMatch(/^INV-\d{4}-00001$/);
  });

  it("increments on collision", async () => {
    prismaMock.invoice.count.mockResolvedValue(0);
    prismaMock.invoice.findFirst
      .mockResolvedValueOnce({ id: "existing" }) // first candidate collides
      .mockResolvedValueOnce(null); // second candidate is free
    const num = await generateInvoiceNumber();
    expect(num).toMatch(/^INV-\d{4}-00002$/);
  });
});

// ─────────────────────────────────────────────
// Error propagation
// ─────────────────────────────────────────────

describe("error propagation", () => {
  it("listInvoices lets prisma errors bubble", async () => {
    prismaMock.invoice.findMany.mockRejectedValue(new Error("DB lost"));
    prismaMock.invoice.count.mockResolvedValue(0);
    await expect(listInvoices(EMPLOYEE_SCOPE, {})).rejects.toThrow("DB lost");
  });
});
