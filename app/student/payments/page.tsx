import type { Metadata } from "next";
import { PaymentsView } from "@/components/student/payments/payments-view";

export const metadata: Metadata = {
  title: "Payments",
  description: "View your payment history, financial summary, and outstanding balances.",
};

export const dynamic = "force-dynamic";

/**
 * Module 11 — Student Payments (/student/payments)
 *
 * Server component renders the client-side PaymentsView. Identity
 * and ownership are enforced at the layout level (StudentLayout →
 * requireStudentProfile) and at the API level (studentApiGuard in
 * every /api/student/payments* route).
 *
 * Students can view their own financial records ONLY. They CANNOT
 * create, update, delete, or refund payments — all routes are
 * GET-only. Payment management goes through the admin /api/payments
 * routes (ADMIN only, `finance.manage`).
 *
 * All financial totals are computed server-side from the Invoice +
 * Payment tables — the client never sends totals.
 */
export default function PaymentsPage() {
  return <PaymentsView />;
}
