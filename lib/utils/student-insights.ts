/**
 * Pure helpers for student insights — unit-tested, reused by the Student 360
 * page so no statistics are computed ad hoc in components.
 */

export type DocLike = { status: string };

/** Document completion = share of non-requested (i.e. handled) documents. */
export function documentCompletion(documents: DocLike[]): {
  total: number;
  approved: number;
  rejected: number;
  pending: number;
  percent: number;
} {
  const total = documents.length;
  const approved = documents.filter((d) => d.status === "APPROVED").length;
  const rejected = documents.filter((d) => d.status === "REJECTED").length;
  const pending = total - approved - rejected;
  const percent = total === 0 ? 0 : Math.round((approved / total) * 100);
  return { total, approved, rejected, pending, percent };
}

export type InvoiceLike = { status: string; total: number; paidAmount: number; dueAmount: number };

/** Payment health across a student's invoices. */
export function paymentStatus(invoices: InvoiceLike[]): {
  invoices: number;
  total: number;
  paid: number;
  due: number;
  label: "NO_INVOICES" | "PAID" | "PARTIAL" | "UNPAID";
} {
  const total = invoices.reduce((s, i) => s + i.total, 0);
  const paid = invoices.reduce((s, i) => s + i.paidAmount, 0);
  const due = invoices.reduce((s, i) => s + i.dueAmount, 0);
  let label: "NO_INVOICES" | "PAID" | "PARTIAL" | "UNPAID" = "NO_INVOICES";
  if (invoices.length > 0) {
    label = due <= 0 ? "PAID" : paid > 0 ? "PARTIAL" : "UNPAID";
  }
  return { invoices: invoices.length, total, paid, due, label };
}

/** Mask a passport number for display: keep first 2 and last 2 characters. */
export function maskPassport(passport: string | null | undefined): string {
  if (!passport) return "—";
  if (passport.length <= 4) return "•".repeat(passport.length);
  return `${passport.slice(0, 2)}${"•".repeat(passport.length - 4)}${passport.slice(-2)}`;
}
