import type { Metadata } from "next";
import { TimelineView } from "@/components/student/application/timeline-view";

export const metadata: Metadata = {
  title: "Application Timeline",
  description:
    "Visual timeline of your visa application journey — from lead creation to travel completion.",
};

export const dynamic = "force-dynamic";

/**
 * Module 05 — Application Timeline (/student/application/timeline)
 *
 * Server component renders the client-side TimelineView. Identity and
 * ownership are enforced at the layout level (StudentLayout →
 * requireStudentProfile) and at the API level (studentApiGuard in
 * /api/student/application/[id]/timeline).
 *
 * The page doesn't take an [id] in the URL — it uses the same
 * "primary + selector" pattern as Module 04. When the student has
 * multiple applications, an ApplicationSelector appears at the top to
 * switch which timeline is shown.
 */
export default function ApplicationTimelinePage() {
  return <TimelineView />;
}
