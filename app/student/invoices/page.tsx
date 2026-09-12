import type { Metadata } from "next";
import { InvoicesView } from "@/components/student/invoices/invoices-view";

export const metadata: Metadata = {
  title: "Invoices",
  description: "View your invoices, payment status, and download for printing.",
};

export const dynamic = "force-dynamic";

/**
 * Module 12 — Student Invoices (/student/invoices)
 *
 * Server component renders the client-side InvoicesView. Identity and
 * ownership are enforced at the layout level (StudentLayout →
 * requireStudentProfile) and at the API level (studentApiGuard in
 * every /api/student/invoices* route).
 *
 * Students can view their own invoices ONLY. DRAFT invoices are
 * excluded (internal drafts not yet finalized). All calculations
 * (subtotal, discount, total, paid, balance) come from the server.
 * Students CANNOT create, update, or delete invoices.
 */
export default function InvoicesPage() {
  return <InvoicesView />;
}
