import type { Metadata } from "next";
import { InvoiceDetailView } from "@/components/student/invoices/invoice-detail-view";

export const metadata: Metadata = {
  title: "Invoice Details",
  description: "View invoice details, line items, and payment status.",
};

export const dynamic = "force-dynamic";

/**
 * Module 12 — Invoice Detail (/student/invoices/[id])
 *
 * Server component renders the client-side InvoiceDetailView. The view
 * fetches via the secure /api/student/invoices/[id] endpoint, which
 * enforces student ownership (scoped by studentId) and excludes DRAFT
 * invoices. Foreign/missing invoice ids 404 cleanly.
 *
 * The detail view is optimized for both mobile (card-based) and print
 * (CSS @media print styles hide navigation and show a clean layout).
 * Students can use the browser's print dialog to save as PDF.
 */
export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <InvoiceDetailView id={id} />;
}
