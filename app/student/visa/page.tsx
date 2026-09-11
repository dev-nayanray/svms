import type { Metadata } from "next";
import { VisaView } from "@/components/student/visa/visa-view";

export const metadata: Metadata = {
  title: "Visa",
  description: "Track your visa application status, timeline, and requirements.",
};

export const dynamic = "force-dynamic";

/**
 * Module 09 — Student Visa Management (/student/visa)
 *
 * Server component renders the client-side VisaView. Identity and
 * ownership are enforced at the layout level (StudentLayout →
 * requireStudentProfile) and at the API level (studentApiGuard in
 * every /api/student/visa* route).
 *
 * Students can view their visa status, timeline, dates, and
 * requirements — but they CANNOT modify visa status. All routes are
 * GET-only. Stage changes go through the admin /api/visa PATCH
 * endpoint (EMPLOYEE/ADMIN only, `visa.manage` permission).
 *
 * The `notes` field on VisaApplication is NEVER exposed to students —
 * it's internal admin/counselor commentary.
 */
export default function VisaPage() {
  return <VisaView />;
}
