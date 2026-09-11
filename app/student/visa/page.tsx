import type { Metadata } from "next";
import { ModulePage } from "@/components/student/module-page";

export const metadata: Metadata = { title: "Visa" };

export default function VisaPage() {
  return <ModulePage title="Visa" description="Visa application tracking and requirements." module="03" />;
}
