import type { Metadata } from "next";
import { ModulePage } from "@/components/student/module-page";

export const metadata: Metadata = { title: "Payments" };

export default function PaymentsPage() {
  return <ModulePage title="Payments" description="Make and track payments securely." module="04" />;
}
