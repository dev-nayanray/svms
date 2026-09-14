import { AppointmentsAdmin as AppointmentsEmployee } from "@/components/admin/appointments-admin";

export const dynamic = "force-dynamic";

/**
 * Employee Appointments — reuses the same admin component since the
 * API auto-scopes employees to their own appointments. Employees can
 * view, approve, and reject appointment requests assigned to them.
 */
export default function Page() {
  return <AppointmentsEmployee />;
}
