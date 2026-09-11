import type { Metadata } from "next";
import { CourseDetailView } from "@/components/student/courses/course-detail-view";

export const metadata: Metadata = {
  title: "Course Details",
  description: "View course details, intakes, requirements, and application information.",
};

export const dynamic = "force-dynamic";

/**
 * Module 08 — Course Detail (/student/courses/[id])
 *
 * Server component renders the client-side CourseDetailView. The view
 * fetches via the secure /api/student/courses/[id] endpoint, which
 * enforces the student-visibility chain (course + university + country
 * all ACTIVE and non-archived). Archived/inactive courses 404 cleanly.
 *
 * Internal administrative fields (deletedAt, deletedBy) are stripped by
 * the API route before the payload reaches the client.
 */
export default async function StudentCourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CourseDetailView id={id} />;
}
