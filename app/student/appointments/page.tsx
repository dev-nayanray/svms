import type { Metadata } from "next";
import { AppointmentsView } from "@/components/student/appointments/appointments-view";

export const metadata: Metadata = {
  title: "Appointments",
  description: "View and manage your counselor appointments.",
};

export const dynamic = "force-dynamic";

/**
 * Module 15 — Student Appointments (/student/appointments)
 *
 * Students can view their appointments, confirm scheduled ones,
 * and cancel (with a reason). They CANNOT create, reschedule, or
 * mark appointments as COMPLETED/NO_SHOW — those are admin/counselor
 * actions.
 */
export default function AppointmentsPage() {
  return <AppointmentsView />;
}
