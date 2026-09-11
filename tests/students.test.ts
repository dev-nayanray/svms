import { describe, it, expect } from "vitest";
import {
  documentCompletion,
  paymentStatus,
  maskPassport,
} from "@/lib/utils/student-insights";
import { studentUpdateSchema, studentCreateSchema } from "@/lib/validations";

describe("documentCompletion", () => {
  it("returns zero percent with no documents", () => {
    expect(documentCompletion([])).toEqual({ total: 0, approved: 0, rejected: 0, pending: 0, percent: 0 });
  });

  it("counts approved, rejected and pending", () => {
    const docs = [
      { status: "APPROVED" },
      { status: "APPROVED" },
      { status: "REJECTED" },
      { status: "UPLOADED" },
    ];
    expect(documentCompletion(docs)).toEqual({ total: 4, approved: 2, rejected: 1, pending: 1, percent: 50 });
  });

  it("rounds to whole percent", () => {
    const docs = [
      { status: "APPROVED" },
      { status: "UPLOADED" },
      { status: "UPLOADED" },
    ];
    expect(documentCompletion(docs).percent).toBe(33);
  });
});

describe("paymentStatus", () => {
  const invoice = (over: Partial<Parameters<typeof paymentStatus>[0][number]>) => ({
    status: "ISSUED",
    total: 100,
    paidAmount: 0,
    dueAmount: 100,
    ...over,
  });

  it("reports NO_INVOICES when there are none", () => {
    expect(paymentStatus([]).label).toBe("NO_INVOICES");
  });

  it("aggregates totals across invoices", () => {
    const r = paymentStatus([invoice({}), invoice({ total: 50, dueAmount: 50 })]);
    expect(r.total).toBe(150);
    expect(r.due).toBe(150);
    expect(r.label).toBe("UNPAID");
  });

  it("classifies partial and fully paid", () => {
    expect(paymentStatus([invoice({ paidAmount: 40, dueAmount: 60 })]).label).toBe("PARTIAL");
    expect(paymentStatus([invoice({ paidAmount: 100, dueAmount: 0, status: "PAID" })]).label).toBe("PAID");
  });
});

describe("maskPassport (sensitive data protection)", () => {
  it("returns a dash for missing values", () => {
    expect(maskPassport(null)).toBe("—");
    expect(maskPassport(undefined)).toBe("—");
  });

  it("fully masks short numbers", () => {
    expect(maskPassport("AB12")).toBe("••••");
  });

  it("keeps only first/last two characters", () => {
    expect(maskPassport("AB1234567")).toBe("AB•••••67");
  });
});

describe("student schemas", () => {
  it("create schema requires names and a valid email", () => {
    expect(studentCreateSchema.safeParse({}).success).toBe(false);
    expect(
      studentCreateSchema.safeParse({ firstName: "A", lastName: "B", email: "bad" }).success
    ).toBe(false);
    expect(
      studentCreateSchema.safeParse({ firstName: "A", lastName: "B", email: "a@b.com" }).success
    ).toBe(true);
  });

  it("update schema accepts assignment/status fields and rejects bad statuses", () => {
    expect(
      studentUpdateSchema.safeParse({ assignedEmployeeId: "x", branchId: "y", status: "SUSPENDED" }).success
    ).toBe(true);
    expect(studentUpdateSchema.safeParse({ status: "BANNED" }).success).toBe(false);
    // password must never be patchable through the update schema
    expect("password" in studentUpdateSchema.shape).toBe(false);
  });
});
