import type { Metadata } from "next";
import { UniversityDetailView } from "@/components/student/universities/university-detail-view";

export const metadata: Metadata = {
  title: "University Details",
  description: "Explore university courses, intakes, requirements, and application information.",
};

export const dynamic = "force-dynamic";

/**
 * Module 07 — University Detail (/student/universities/[id])
 *
 * Server component renders the client-side UniversityDetailView. The
 * view fetches via the secure /api/student/universities/[id]
 * endpoint, which enforces the student-visibility rule (only ACTIVE
 * universities in ACTIVE countries are returned; archived/inactive
 * universities 404 cleanly).
 *
 * Internal administrative fields (deletedAt, deletedBy, internal _count)
 * are stripped by the API route before the payload reaches the client.
 */
export default async function StudentUniversityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <UniversityDetailView id={id} />;
}
