import type { Metadata } from "next";
import { ModulePage } from "@/components/student/module-page";

export const metadata: Metadata = { title: "Appointments" };

export default function AppointmentsPage() {
  return <ModulePage title="Appointments" description="Book and manage counselor appointments." module="06" />;
}
