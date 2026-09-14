import { describe, it, expect } from "vitest";
import { computeInvoiceTotals } from "@/lib/services/finance";

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
