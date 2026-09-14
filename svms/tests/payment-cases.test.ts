import { describe, it, expect, vi, beforeEach } from "vitest";

// Pure validation tests
import {
  validateAmount,
  validatePaymentMethod,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
} from "@/lib/services/payment-cases";

describe("validateAmount", () => {
  it("accepts positive amounts with ≤2 decimal places", () => {
    expect(validateAmount(100)).toBeNull();
    expect(validateAmount(0.01)).toBeNull();
    expect(validateAmount(9999.99)).toBeNull();
  });

  it("rejects negative amounts", () => {
    expect(validateAmount(-1)).toContain("positive");
    expect(validateAmount(-0.01)).toContain("positive");
  });

  it("rejects zero", () => {
    expect(validateAmount(0)).toContain("positive");
  });

  it("rejects NaN / non-numbers", () => {
    expect(validateAmount(NaN)).toContain("number");
    // Infinity passes the number check but exceeds the max check
    expect(validateAmount(Infinity)).toContain("maximum");
  });

  it("rejects amounts with more than 2 decimal places", () => {
    expect(validateAmount(100.001)).toContain("decimal places");
    expect(validateAmount(0.999)).toContain("decimal places");
  });

  it("rejects amounts exceeding 10,000,000", () => {
    expect(validateAmount(10_000_001)).toContain("maximum");
  });
});

describe("validatePaymentMethod", () => {
  it("accepts all 6 payment methods", () => {
    for (const m of PAYMENT_METHODS) {
      expect(validatePaymentMethod(m)).toBeNull();
    }
  });

  it("rejects unknown methods", () => {
    expect(validatePaymentMethod("CRYPTO")).toContain("Invalid");
    expect(validatePaymentMethod("")).toContain("Invalid");
  });
});

describe("PAYMENT constants", () => {
  it("has 6 payment methods", () => {
    expect(PAYMENT_METHODS).toEqual(["CASH", "BANK_TRANSFER", "BKASH", "NAGAD", "CARD", "OTHER"]);
  });

  it("has 5 payment statuses", () => {
    expect(PAYMENT_STATUSES).toEqual(["PENDING", "PAID", "PARTIAL", "REFUNDED", "CANCELLED"]);
  });
});

// Service tests with mocked prisma
const prismaMock = vi.hoisted(() => ({
  payment: { findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn(), update: vi.fn(), create: vi.fn() },
  student: { findFirst: vi.fn(), findUnique: vi.fn() },
  user: { findMany: vi.fn() },
  notification: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  auditLog: { create: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import {
  listPayments,
  createPayment,
  refundPayment,
  cancelPayment,
  updatePayment,
  computePaymentSummary,
} from "@/lib/services/payment-cases";
import type { EmployeeScope } from "@/lib/services/employee-dashboard";

const ADMIN_SCOPE: EmployeeScope = { isAdmin: true, userId: "u-admin", employeeId: null };
const EMPLOYEE_SCOPE: EmployeeScope = { isAdmin: false, userId: "u-emp", employeeId: "emp-1" };

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────
// IDOR closure
// ─────────────────────────────────────────────

describe("payment IDOR closure", () => {
  it("EMPLOYEE scope embeds student.assignedEmployeeId filter", async () => {
    prismaMock.payment.findMany.mockResolvedValue([]);
    prismaMock.payment.count.mockResolvedValue(0);
    prismaMock.payment.findMany.mockResolvedValue([]); // summary query
    await listPayments(EMPLOYEE_SCOPE, {});
    const call = prismaMock.payment.findMany.mock.calls[0][0];
    expect(call.where.student).toEqual({ assignedEmployeeId: "emp-1" });
  });

  it("ADMIN scope is empty — sees all payments", async () => {
    prismaMock.payment.findMany.mockResolvedValue([]);
    prismaMock.payment.count.mockResolvedValue(0);
    prismaMock.payment.findMany.mockResolvedValue([]);
    await listPayments(ADMIN_SCOPE, {});
    const call = prismaMock.payment.findMany.mock.calls[0][0];
    expect(call.where.student).toBeUndefined();
  });
});

// ─────────────────────────────────────────────
// Create — validation + duplicate + audit
// ─────────────────────────────────────────────

describe("createPayment", () => {
  it("creates a payment with valid input", async () => {
    prismaMock.student.findFirst.mockResolvedValue({ id: "s1" });
    prismaMock.payment.findFirst.mockResolvedValue(null); // no duplicate
    prismaMock.payment.create.mockResolvedValue({ id: "p1" });
    prismaMock.auditLog.create.mockResolvedValue({});
    const result = await createPayment(EMPLOYEE_SCOPE, {
      studentId: "s1", amount: 500, paymentMethod: "BKASH",
      transactionReference: "TXN-001",
    }, { id: "u-emp" });
    expect(result.id).toBe("p1");
    expect(prismaMock.payment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        amount: 500, paymentMethod: "BKASH", status: "PAID", recordedById: "u-emp",
      }),
    }));
  });

  it("rejects negative amounts (422)", async () => {
    await expect(createPayment(EMPLOYEE_SCOPE, {
      studentId: "s1", amount: -100, paymentMethod: "CASH",
    }, { id: "u-emp" })).rejects.toMatchObject({ status: 422, code: "VALIDATION_ERROR" });
  });

  it("rejects invalid payment methods (422)", async () => {
    await expect(createPayment(EMPLOYEE_SCOPE, {
      studentId: "s1", amount: 100, paymentMethod: "CRYPTO",
    }, { id: "u-emp" })).rejects.toMatchObject({ status: 422, code: "VALIDATION_ERROR" });
  });

  it("rejects amounts with >2 decimal places (422)", async () => {
    await expect(createPayment(EMPLOYEE_SCOPE, {
      studentId: "s1", amount: 100.001, paymentMethod: "CASH",
    }, { id: "u-emp" })).rejects.toMatchObject({ status: 422, code: "VALIDATION_ERROR" });
  });

  it("blocks creating payments for foreign students (IDOR 403)", async () => {
    prismaMock.student.findFirst.mockResolvedValue(null);
    await expect(createPayment(EMPLOYEE_SCOPE, {
      studentId: "stu-foreign", amount: 100, paymentMethod: "CASH",
    }, { id: "u-emp" })).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
  });

  it("blocks duplicate transaction references (409)", async () => {
    prismaMock.student.findFirst.mockResolvedValue({ id: "s1" });
    prismaMock.payment.findFirst.mockResolvedValue({ id: "existing" }); // duplicate found
    await expect(createPayment(EMPLOYEE_SCOPE, {
      studentId: "s1", amount: 100, paymentMethod: "CASH", transactionReference: "DUP-001",
    }, { id: "u-emp" })).rejects.toMatchObject({ status: 409, code: "CONFLICT" });
  });

  it("emits an audit log on creation", async () => {
    prismaMock.student.findFirst.mockResolvedValue({ id: "s1" });
    prismaMock.payment.findFirst.mockResolvedValue(null);
    prismaMock.payment.create.mockResolvedValue({ id: "p1" });
    prismaMock.auditLog.create.mockResolvedValue({});
    await createPayment(EMPLOYEE_SCOPE, {
      studentId: "s1", amount: 500, paymentMethod: "BKASH",
    }, { id: "u-emp" });
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: "u-emp", action: "payment.created", entity: "Payment",
      }),
    }));
  });
});

// ─────────────────────────────────────────────
// Refund
// ─────────────────────────────────────────────

describe("refundPayment", () => {
  it("refunds a PAID payment with reason", async () => {
    prismaMock.payment.findFirst.mockResolvedValue({
      id: "p1", status: "PAID", amount: 500, currency: "EUR", studentId: "s1",
    });
    prismaMock.payment.update.mockResolvedValue({});
    prismaMock.auditLog.create.mockResolvedValue({});
    prismaMock.student.findUnique.mockResolvedValue({ userId: "u-stu" });
    await refundPayment(EMPLOYEE_SCOPE, "p1", "Duplicate payment", { id: "u-emp" });
    expect(prismaMock.payment.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "REFUNDED", refundReason: "Duplicate payment" }),
    }));
  });

  it("blocks refunding an already-refunded payment (409)", async () => {
    prismaMock.payment.findFirst.mockResolvedValue({ id: "p1", status: "REFUNDED", amount: 500, currency: "EUR", studentId: "s1" });
    await expect(refundPayment(EMPLOYEE_SCOPE, "p1", undefined, { id: "u-emp" })).rejects.toMatchObject({ status: 409, code: "CONFLICT" });
  });

  it("blocks refunding a cancelled payment (409)", async () => {
    prismaMock.payment.findFirst.mockResolvedValue({ id: "p1", status: "CANCELLED", amount: 500, currency: "EUR", studentId: "s1" });
    await expect(refundPayment(EMPLOYEE_SCOPE, "p1", undefined, { id: "u-emp" })).rejects.toMatchObject({ status: 409, code: "CONFLICT" });
  });

  it("blocks refunding a pending payment (409)", async () => {
    prismaMock.payment.findFirst.mockResolvedValue({ id: "p1", status: "PENDING", amount: 500, currency: "EUR", studentId: "s1" });
    await expect(refundPayment(EMPLOYEE_SCOPE, "p1", undefined, { id: "u-emp" })).rejects.toMatchObject({ status: 409, code: "CONFLICT" });
  });

  it("emits audit log + notification on refund", async () => {
    prismaMock.payment.findFirst.mockResolvedValue({ id: "p1", status: "PAID", amount: 500, currency: "EUR", studentId: "s1" });
    prismaMock.payment.update.mockResolvedValue({});
    prismaMock.auditLog.create.mockResolvedValue({});
    prismaMock.student.findUnique.mockResolvedValue({ userId: "u-stu" });
    prismaMock.notification.findFirst.mockResolvedValue(null);
    prismaMock.notification.create.mockResolvedValue({ id: "n1" });
    await refundPayment(EMPLOYEE_SCOPE, "p1", "Test reason", { id: "u-emp" });
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "payment.refunded" }),
    }));
    expect(prismaMock.notification.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ type: "PAYMENT_REFUNDED" }),
    }));
  });

  it("IDOR: foreign payment returns 404", async () => {
    prismaMock.payment.findFirst.mockResolvedValue(null);
    await expect(refundPayment(EMPLOYEE_SCOPE, "p-foreign", undefined, { id: "u-emp" })).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
  });
});

// ─────────────────────────────────────────────
// Cancel
// ─────────────────────────────────────────────

describe("cancelPayment", () => {
  it("cancels a PENDING payment", async () => {
    prismaMock.payment.findFirst.mockResolvedValue({ id: "p1", status: "PENDING", amount: 500, currency: "EUR", studentId: "s1" });
    prismaMock.payment.update.mockResolvedValue({});
    prismaMock.auditLog.create.mockResolvedValue({});
    await cancelPayment(EMPLOYEE_SCOPE, "p1", { id: "u-emp" });
    expect(prismaMock.payment.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "CANCELLED" }),
    }));
  });

  it("is a no-op when already CANCELLED", async () => {
    prismaMock.payment.findFirst.mockResolvedValue({ id: "p1", status: "CANCELLED", amount: 500, currency: "EUR", studentId: "s1" });
    await cancelPayment(EMPLOYEE_SCOPE, "p1", { id: "u-emp" });
    expect(prismaMock.payment.update).not.toHaveBeenCalled();
  });

  it("blocks cancelling a PAID payment (409 — use refund)", async () => {
    prismaMock.payment.findFirst.mockResolvedValue({ id: "p1", status: "PAID", amount: 500, currency: "EUR", studentId: "s1" });
    await expect(cancelPayment(EMPLOYEE_SCOPE, "p1", { id: "u-emp" })).rejects.toMatchObject({ status: 409, code: "CONFLICT" });
  });

  it("blocks cancelling a REFUNDED payment (409)", async () => {
    prismaMock.payment.findFirst.mockResolvedValue({ id: "p1", status: "REFUNDED", amount: 500, currency: "EUR", studentId: "s1" });
    await expect(cancelPayment(EMPLOYEE_SCOPE, "p1", { id: "u-emp" })).rejects.toMatchObject({ status: 409, code: "CONFLICT" });
  });

  it("emits audit log on cancellation", async () => {
    prismaMock.payment.findFirst.mockResolvedValue({ id: "p1", status: "PENDING", amount: 500, currency: "EUR", studentId: "s1" });
    prismaMock.payment.update.mockResolvedValue({});
    prismaMock.auditLog.create.mockResolvedValue({});
    await cancelPayment(EMPLOYEE_SCOPE, "p1", { id: "u-emp" });
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "payment.cancelled" }),
    }));
  });
});

// ─────────────────────────────────────────────
// Update
// ─────────────────────────────────────────────

describe("updatePayment", () => {
  it("updates permitted fields on a PENDING payment", async () => {
    prismaMock.payment.findFirst.mockResolvedValue({ id: "p1", status: "PENDING", studentId: "s1", transactionReference: null });
    prismaMock.payment.findFirst // duplicate check
      .mockResolvedValueOnce({ id: "p1", status: "PENDING", studentId: "s1", transactionReference: null })
      .mockResolvedValueOnce(null); // no conflict on new reference
    prismaMock.payment.update.mockResolvedValue({});
    prismaMock.auditLog.create.mockResolvedValue({});
    await updatePayment(EMPLOYEE_SCOPE, "p1", {
      paymentMethod: "BANK_TRANSFER", transactionReference: "NEW-REF",
    }, { id: "u-emp" });
    expect(prismaMock.payment.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ paymentMethod: "BANK_TRANSFER", transactionReference: "NEW-REF" }),
    }));
  });

  it("blocks editing non-PENDING payments (409)", async () => {
    prismaMock.payment.findFirst.mockResolvedValue({ id: "p1", status: "PAID", studentId: "s1", transactionReference: null });
    await expect(updatePayment(EMPLOYEE_SCOPE, "p1", { paymentMethod: "CASH" }, { id: "u-emp" })).rejects.toMatchObject({ status: 409, code: "CONFLICT" });
  });

  it("blocks duplicate reference on update (409)", async () => {
    prismaMock.payment.findFirst
      .mockResolvedValueOnce({ id: "p1", status: "PENDING", studentId: "s1", transactionReference: "OLD" })
      .mockResolvedValueOnce({ id: "p2" }); // conflict
    await expect(updatePayment(EMPLOYEE_SCOPE, "p1", { transactionReference: "TAKEN-REF" }, { id: "u-emp" })).rejects.toMatchObject({ status: 409, code: "CONFLICT" });
  });

  it("IDOR: foreign payment returns 404", async () => {
    prismaMock.payment.findFirst.mockResolvedValue(null);
    await expect(updatePayment(EMPLOYEE_SCOPE, "p-foreign", { paymentMethod: "CASH" }, { id: "u-emp" })).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
  });
});

// ─────────────────────────────────────────────
// Summary — server-side calculations
// ─────────────────────────────────────────────

describe("computePaymentSummary", () => {
  it("computes totalBilled, totalPaid, outstanding, pending from payment rows", async () => {
    prismaMock.payment.findMany.mockResolvedValue([
      { amount: 500, currency: "EUR", status: "PAID" },
      { amount: 300, currency: "EUR", status: "PENDING" },
      { amount: 200, currency: "EUR", status: "PAID" },
    ]);
    prismaMock.payment.count.mockResolvedValue(1); // pending count
    const summary = await computePaymentSummary(EMPLOYEE_SCOPE);
    expect(summary.totalBilled).toBe(1000); // 500 + 300 + 200
    expect(summary.totalPaid).toBe(700); // 500 + 200
    expect(summary.outstanding).toBe(300); // 1000 - 700
    expect(summary.pending).toBe(1);
    expect(summary.currency).toBe("EUR");
  });

  it("excludes CANCELLED payments from totalBilled", async () => {
    // The service filters by status: { not: "CANCELLED" } in the query,
    // so only non-cancelled rows are returned. We mock findMany to return
    // only non-cancelled payments, simulating what Prisma would return.
    prismaMock.payment.findMany.mockResolvedValue([
      { amount: 500, currency: "EUR", status: "PAID" },
      // CANCELLED row would NOT appear because the where clause excludes it
    ]);
    prismaMock.payment.count.mockResolvedValue(0);
    const summary = await computePaymentSummary(EMPLOYEE_SCOPE);
    expect(summary.totalBilled).toBe(500);
    expect(summary.totalPaid).toBe(500);
    expect(summary.outstanding).toBe(0);
    // Verify the query excluded CANCELLED
    const findManyCall = prismaMock.payment.findMany.mock.calls[0][0];
    expect(findManyCall.where.status).toEqual({ not: "CANCELLED" });
  });

  it("returns zeros when no payments exist", async () => {
    prismaMock.payment.findMany.mockResolvedValue([]);
    prismaMock.payment.count.mockResolvedValue(0);
    const summary = await computePaymentSummary(EMPLOYEE_SCOPE);
    expect(summary.totalBilled).toBe(0);
    expect(summary.totalPaid).toBe(0);
    expect(summary.outstanding).toBe(0);
    expect(summary.pending).toBe(0);
  });
});

// ─────────────────────────────────────────────
// Error propagation
// ─────────────────────────────────────────────

describe("error propagation", () => {
  it("listPayments lets prisma errors bubble", async () => {
    prismaMock.payment.findMany.mockRejectedValue(new Error("DB lost"));
    prismaMock.payment.count.mockResolvedValue(0);
    await expect(listPayments(EMPLOYEE_SCOPE, {})).rejects.toThrow("DB lost");
  });
});
