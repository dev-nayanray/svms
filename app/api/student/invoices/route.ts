import { NextRequest } from "next/server";
import { ok, handleApiError } from "@/lib/api";
import { studentApiGuard } from "@/lib/student/guard";
import { studentInvoiceService } from "@/lib/services/student-invoices";

export const dynamic = "force-dynamic";

/**
 * GET /api/student/invoices
 *
 * Returns ALL student-visible invoices for the caller. DRAFT invoices
 * are excluded — they're internal drafts not yet finalized. Scoped by
 * `studentId` from the session.
 *
 * Each invoice includes: invoiceNumber, status, total, paidAmount,
 * dueAmount, discount, issueDate, dueDate, and the linked application.
 * All financial values are server-side (from the DB row — never
 * client-computed).
 *
 * Students CANNOT create, update, delete, or modify invoices — this
 * route is GET-only. Invoice management goes through the admin
 * `/api/invoices` routes (ADMIN only, `finance.manage`).
 */
export async function GET(_req: NextRequest) {
  try {
    const g = await studentApiGuard();
    if (!g.ok) return g.error;

    const invoices = await studentInvoiceService.list(g.student.id);
    return ok({ invoices });
  } catch (err) {
    return handleApiError(err);
  }
}
