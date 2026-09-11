import { describe, it, expect } from "vitest";
import {
  PAYMENT_STATUSES,
  PAYMENT_STATUS_LABELS,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  INVOICE_STATUSES,
  INVOICE_STATUS_LABELS,
  PAYMENT_SORT_KEYS,
  INVOICE_SORT_KEYS,
  buildAdminPaymentWhere,
  buildAdminInvoiceWhere,
  formatMoney,
  paymentProgress,
} from "@/lib/constants/finance";
import { computeInvoiceTotals } from "@/lib/services/finance";
import {
  paymentSchema,
  paymentUpdateSchema,
  paymentRefundSchema,
  invoiceSchema,
  invoiceUpdateSchema,
} from "@/lib/validations";

describe("payment enums", () => {
  it("exposes the canonical payment statuses", () => {
    expect(PAYMENT_STATUSES).toEqual(["PENDING", "PAID", "PARTIAL", "REFUNDED", "CANCELLED"]);
  });

  it("labels every payment status", () => {
    expect(PAYMENT_STATUS_LABELS.PENDING).toBe("Pending");
    expect(PAYMENT_STATUS_LABELS.PAID).toBe("Paid");
    expect(PAYMENT_STATUS_LABELS.PARTIAL).toBe("Partial");
    expect(PAYMENT_STATUS_LABELS.REFUNDED).toBe("Refunded");
    expect(PAYMENT_STATUS_LABELS.CANCELLED).toBe("Cancelled");
  });

  it("exposes the canonical payment methods", () => {
    expect(PAYMENT_METHODS).toEqual(["CASH", "BANK_TRANSFER", "BKASH", "NAGAD", "CARD", "OTHER"]);
  });

  it("labels every payment method", () => {
    expect(PAYMENT_METHOD_LABELS.CASH).toBe("Cash");
    expect(PAYMENT_METHOD_LABELS.BANK_TRANSFER).toBe("Bank Transfer");
    expect(PAYMENT_METHOD_LABELS.BKASH).toBe("bKash");
    expect(PAYMENT_METHOD_LABELS.NAGAD).toBe("Nagad");
    expect(PAYMENT_METHOD_LABELS.CARD).toBe("Card");
    expect(PAYMENT_METHOD_LABELS.OTHER).toBe("Other");
  });
});

describe("invoice enums", () => {
  it("exposes the canonical invoice statuses", () => {
    expect(INVOICE_STATUSES).toEqual(["DRAFT", "ISSUED", "PARTIAL", "PAID", "OVERDUE", "CANCELLED"]);
  });

  it("labels every invoice status", () => {
    expect(INVOICE_STATUS_LABELS.DRAFT).toBe("Draft");
    expect(INVOICE_STATUS_LABELS.ISSUED).toBe("Issued");
    expect(INVOICE_STATUS_LABELS.PARTIAL).toBe("Partial");
    expect(INVOICE_STATUS_LABELS.PAID).toBe("Paid");
    expect(INVOICE_STATUS_LABELS.OVERDUE).toBe("Overdue");
    expect(INVOICE_STATUS_LABELS.CANCELLED).toBe("Cancelled");
  });
});

describe("sort allow-lists", () => {
  it("exposes a stable payment sort allow-list", () => {
    expect(PAYMENT_SORT_KEYS).toEqual([
      "amount",
      "paymentMethod",
      "paymentDate",
      "status",
      "createdAt",
    ]);
  });

  it("exposes a stable invoice sort allow-list", () => {
    expect(INVOICE_SORT_KEYS).toEqual([
      "invoiceNumber",
      "total",
      "paidAmount",
      "dueAmount",
      "status",
      "issueDate",
      "dueDate",
      "createdAt",
    ]);
  });
});

describe("buildAdminPaymentWhere", () => {
  it("always filters by deletedAt null", () => {
    const where = buildAdminPaymentWhere({});
    expect(where.AND).toContainEqual({ deletedAt: null });
  });

  it("applies status filter", () => {
    const where = buildAdminPaymentWhere({ status: "PAID" });
    expect(where.AND).toContainEqual({ status: "PAID" });
  });

  it("applies studentId filter", () => {
    const where = buildAdminPaymentWhere({ studentId: "s1" });
    expect(where.AND).toContainEqual({ studentId: "s1" });
  });

  it("applies applicationId filter", () => {
    const where = buildAdminPaymentWhere({ applicationId: "a1" });
    expect(where.AND).toContainEqual({ applicationId: "a1" });
  });

  it("applies invoiceId filter", () => {
    const where = buildAdminPaymentWhere({ invoiceId: "inv-1" });
    expect(where.AND).toContainEqual({ invoiceId: "inv-1" });
  });

  it("applies paymentMethod filter", () => {
    const where = buildAdminPaymentWhere({ paymentMethod: "BKASH" });
    expect(where.AND).toContainEqual({ paymentMethod: "BKASH" });
  });

  it("searches by transaction reference", () => {
    const where = buildAdminPaymentWhere({ search: "TXN123" });
    expect(where.AND).toContainEqual({
      OR: [{ transactionReference: { contains: "TXN123", mode: "insensitive" } }],
    });
  });

  it("builds a date range filter on paymentDate (both bounds)", () => {
    const from = new Date("2026-01-01");
    const to = new Date("2026-12-31");
    const where = buildAdminPaymentWhere({ paymentFrom: from, paymentTo: to });
    expect(where.AND).toContainEqual({ paymentDate: { gte: from, lte: to } });
  });

  it("supports a single-sided date range (from only)", () => {
    const from = new Date("2026-01-01");
    const where = buildAdminPaymentWhere({ paymentFrom: from });
    expect(where.AND).toContainEqual({ paymentDate: { gte: from } });
  });

  it("supports a single-sided date range (to only)", () => {
    const to = new Date("2026-12-31");
    const where = buildAdminPaymentWhere({ paymentTo: to });
    expect(where.AND).toContainEqual({ paymentDate: { lte: to } });
  });

  it("combines all filters into a single AND chain", () => {
    const where = buildAdminPaymentWhere({
      status: "PAID",
      studentId: "s1",
      applicationId: "a1",
      invoiceId: "inv-1",
      paymentMethod: "CASH",
      search: "TXN",
      paymentFrom: new Date("2026-01-01"),
      paymentTo: new Date("2026-12-31"),
    });
    // 1 (deletedAt) + 1 (status) + 1 (studentId) + 1 (applicationId) +
    // 1 (invoiceId) + 1 (paymentMethod) + 1 (search) + 1 (paymentDate range)
    expect(where.AND).toHaveLength(8);
  });
});

describe("buildAdminInvoiceWhere", () => {
  it("always filters by deletedAt null", () => {
    const where = buildAdminInvoiceWhere({});
    expect(where.AND).toContainEqual({ deletedAt: null });
  });

  it("applies status filter", () => {
    const where = buildAdminInvoiceWhere({ status: "PAID" });
    expect(where.AND).toContainEqual({ status: "PAID" });
  });

  it("applies studentId filter", () => {
    const where = buildAdminInvoiceWhere({ studentId: "s1" });
    expect(where.AND).toContainEqual({ studentId: "s1" });
  });

  it("applies applicationId filter", () => {
    const where = buildAdminInvoiceWhere({ applicationId: "a1" });
    expect(where.AND).toContainEqual({ applicationId: "a1" });
  });

  it("searches by invoice number", () => {
    const where = buildAdminInvoiceWhere({ search: "INV-2026" });
    expect(where.AND).toContainEqual({
      invoiceNumber: { contains: "INV-2026", mode: "insensitive" },
    });
  });

  it("builds a date range filter on issueDate", () => {
    const from = new Date("2026-01-01");
    const to = new Date("2026-12-31");
    const where = buildAdminInvoiceWhere({ issueFrom: from, issueTo: to });
    expect(where.AND).toContainEqual({ issueDate: { gte: from, lte: to } });
  });
});

describe("formatMoney", () => {
  it("returns em-dash for nullish input", () => {
    expect(formatMoney(null)).toBe("—");
    expect(formatMoney(undefined)).toBe("—");
  });

  it("formats with the given currency", () => {
    expect(formatMoney(500, "BDT")).toMatch(/500/);
    expect(formatMoney(125.50, "USD")).toMatch(/125\.50/);
  });

  it("defaults to BDT when currency not provided", () => {
    expect(formatMoney(1000)).toMatch(/1,000/);
  });

  it("falls back to a plain number for invalid currency codes", () => {
    const out = formatMoney(500, "NOTACURRENCY");
    expect(out).toContain("500");
  });
});

describe("paymentProgress", () => {
  it("returns 0 for an invoice with no payments", () => {
    expect(paymentProgress({ paidAmount: 0, total: 1000 })).toBe(0);
  });

  it("returns 100 for a fully paid invoice", () => {
    expect(paymentProgress({ paidAmount: 1000, total: 1000 })).toBe(100);
  });

  it("returns the correct percentage for a partial payment", () => {
    expect(paymentProgress({ paidAmount: 250, total: 1000 })).toBe(25);
    expect(paymentProgress({ paidAmount: 333, total: 1000 })).toBe(33);
  });

  it("returns 0 for a zero total (edge case)", () => {
    expect(paymentProgress({ paidAmount: 0, total: 0 })).toBe(0);
  });

  it("caps at 100 even if paidAmount exceeds total", () => {
    expect(paymentProgress({ paidAmount: 1500, total: 1000 })).toBe(100);
  });
});

describe("computeInvoiceTotals (server-side invoice math)", () => {
  it("sums quantity × unit price across items", () => {
    const r = computeInvoiceTotals([
      { description: "Service charge", quantity: 1, unitPrice: 500 },
      { description: "Courier", quantity: 2, unitPrice: 50 },
    ]);
    expect(r.subtotal).toBe(600);
    expect(r.total).toBe(600);
    expect(r.discount).toBe(0);
  });

  it("applies the discount to the total", () => {
    const r = computeInvoiceTotals([{ description: "Tuition", quantity: 1, unitPrice: 1000 }], 100);
    expect(r.subtotal).toBe(1000);
    expect(r.discount).toBe(100);
    expect(r.total).toBe(900);
  });

  it("clamps discount above the subtotal", () => {
    const r = computeInvoiceTotals([{ description: "A", quantity: 1, unitPrice: 200 }], 999);
    expect(r.discount).toBe(200);
    expect(r.total).toBe(0);
  });

  it("rejects negative discounts", () => {
    const r = computeInvoiceTotals([{ description: "A", quantity: 1, unitPrice: 200 }], -50);
    expect(r.discount).toBe(0);
    expect(r.total).toBe(200);
  });

  it("handles empty item lists", () => {
    expect(computeInvoiceTotals([])).toEqual({ subtotal: 0, discount: 0, total: 0 });
  });
});

describe("paymentSchema", () => {
  it("requires studentId, amount, and paymentMethod", () => {
    expect(paymentSchema.safeParse({}).success).toBe(false);
    expect(
      paymentSchema.safeParse({
        studentId: "s1",
        amount: 100,
        paymentMethod: "CASH",
      }).success,
    ).toBe(true);
  });

  it("defaults currency to BDT", () => {
    const out = paymentSchema.parse({
      studentId: "s1",
      amount: 100,
      paymentMethod: "BKASH",
    });
    expect(out.currency).toBe("BDT");
  });

  it("rejects non-positive amounts", () => {
    expect(
      paymentSchema.safeParse({
        studentId: "s1",
        amount: 0,
        paymentMethod: "CASH",
      }).success,
    ).toBe(false);
    expect(
      paymentSchema.safeParse({
        studentId: "s1",
        amount: -10,
        paymentMethod: "CASH",
      }).success,
    ).toBe(false);
  });

  it("rejects invalid payment methods", () => {
    expect(
      paymentSchema.safeParse({
        studentId: "s1",
        amount: 100,
        paymentMethod: "PAYPAL",
      }).success,
    ).toBe(false);
  });

  it("accepts optional applicationId, invoiceId, transactionReference, paymentDate", () => {
    expect(
      paymentSchema.safeParse({
        studentId: "s1",
        applicationId: "a1",
        invoiceId: "inv-1",
        amount: 100,
        paymentMethod: "BANK_TRANSFER",
        transactionReference: "TXN-001",
        paymentDate: "2026-06-30",
      }).success,
    ).toBe(true);
  });
});

describe("paymentUpdateSchema", () => {
  it("accepts an empty object (all fields optional)", () => {
    expect(paymentUpdateSchema.safeParse({}).success).toBe(true);
  });

  it("accepts partial updates", () => {
    expect(
      paymentUpdateSchema.safeParse({ amount: 200 }).success,
    ).toBe(true);
    expect(
      paymentUpdateSchema.safeParse({ paymentMethod: "CARD" }).success,
    ).toBe(true);
  });

  it("rejects non-positive amounts", () => {
    expect(
      paymentUpdateSchema.safeParse({ amount: 0 }).success,
    ).toBe(false);
    expect(
      paymentUpdateSchema.safeParse({ amount: -5 }).success,
    ).toBe(false);
  });

  it("accepts nullable paymentDate", () => {
    expect(
      paymentUpdateSchema.safeParse({ paymentDate: null }).success,
    ).toBe(true);
  });
});

describe("paymentRefundSchema", () => {
  it("accepts an empty object (reason is optional)", () => {
    expect(paymentRefundSchema.safeParse({}).success).toBe(true);
  });

  it("accepts a reason", () => {
    expect(
      paymentRefundSchema.safeParse({ reason: "Duplicate payment" }).success,
    ).toBe(true);
  });

  it("rejects a reason longer than 2000 chars", () => {
    expect(
      paymentRefundSchema.safeParse({ reason: "a".repeat(2001) }).success,
    ).toBe(false);
  });
});

describe("invoiceSchema", () => {
  it("requires studentId and at least one item", () => {
    expect(invoiceSchema.safeParse({}).success).toBe(false);
    expect(
      invoiceSchema.safeParse({
        studentId: "s1",
        items: [],
      }).success,
    ).toBe(false);
    expect(
      invoiceSchema.safeParse({
        studentId: "s1",
        items: [{ description: "Service", quantity: 1, unitPrice: 100 }],
      }).success,
    ).toBe(true);
  });

  it("defaults discount to 0", () => {
    const out = invoiceSchema.parse({
      studentId: "s1",
      items: [{ description: "A", quantity: 1, unitPrice: 100 }],
    });
    expect(out.discount).toBe(0);
  });

  it("rejects negative discounts", () => {
    expect(
      invoiceSchema.safeParse({
        studentId: "s1",
        items: [{ description: "A", quantity: 1, unitPrice: 100 }],
        discount: -10,
      }).success,
    ).toBe(false);
  });

  it("rejects items with zero quantity", () => {
    expect(
      invoiceSchema.safeParse({
        studentId: "s1",
        items: [{ description: "A", quantity: 0, unitPrice: 100 }],
      }).success,
    ).toBe(false);
  });

  it("rejects items with negative unitPrice", () => {
    expect(
      invoiceSchema.safeParse({
        studentId: "s1",
        items: [{ description: "A", quantity: 1, unitPrice: -50 }],
      }).success,
    ).toBe(false);
  });
});

describe("invoiceUpdateSchema", () => {
  it("accepts an empty object (all fields optional)", () => {
    expect(invoiceUpdateSchema.safeParse({}).success).toBe(true);
  });

  it("accepts partial updates with items", () => {
    expect(
      invoiceUpdateSchema.safeParse({
        items: [{ description: "Updated", quantity: 2, unitPrice: 150 }],
      }).success,
    ).toBe(true);
  });

  it("rejects an empty items array", () => {
    expect(
      invoiceUpdateSchema.safeParse({ items: [] }).success,
    ).toBe(false);
  });

  it("accepts status changes", () => {
    expect(
      invoiceUpdateSchema.safeParse({ status: "PAID" }).success,
    ).toBe(true);
    expect(
      invoiceUpdateSchema.safeParse({ status: "CANCELLED" }).success,
    ).toBe(true);
  });

  it("rejects invalid statuses", () => {
    expect(
      invoiceUpdateSchema.safeParse({ status: "REFUNDED" }).success,
    ).toBe(false);
  });
});
