import type { Metadata } from "next";
import { ApplicationView } from "@/components/student/application/application-view";

export const metadata: Metadata = {
  title: "My Application",
  description:
    "Track your visa application journey: pipeline progress, documents, payments, visa status, and timeline.",
};

export const dynamic = "force-dynamic";

/**
 * Module 04 — My Application (/student/application)
 *
 * Server component renders the client-side ApplicationView. Identity
 * and ownership are enforced at the layout level (StudentLayout →
 * requireStudentProfile) and at the API level (studentApiGuard in
 * every /api/student/application* route).
 *
 * /student/applications (plural) is preserved as a separate legacy
 * table-list view; this page is the new mobile-first primary view.
 */
export default function ApplicationPage() {
  return <ApplicationView />;
}
