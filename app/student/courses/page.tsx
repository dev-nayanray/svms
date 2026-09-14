import type { Metadata } from "next";
import { StudentCoursesList } from "@/components/modules/student-courses-list";
import { MobilePage } from "@/components/student/ui";

export const metadata: Metadata = {
  title: "Courses",
  description:
    "Browse programs offered by partner universities. Filter by country, tuition, degree level, intake, or English-test requirement.",
};

export const dynamic = "force-dynamic";

/**
 * Module 08 — Courses (/student/courses)
 *
 * Server component renders the mobile-first StudentCoursesList inside
 * a MobilePage wrapper for consistent spacing with the other student
 * modules. The list component handles:
 *  - Sticky search bar (server-side search across course name,
 *    university name, country name)
 *  - Filter drawer (country, university, degree, tuition range,
 *    intake, englishTest)
 *  - Sort dropdown (name, tuitionFee, degreeLevel, createdAt)
 *  - Active filter chips (horizontal scroll on mobile)
 *  - Loading skeletons + empty + error states
 *  - Server-side pagination
 *  - Per-card "View details" + "Request counseling" actions
 *
 * Visibility rule: only ACTIVE courses in ACTIVE universities in
 * ACTIVE countries are returned — enforced at the DB level by
 * buildStudentCourseWhere in lib/constants/courses.ts.
 */
export default function Page() {
  return (
    <MobilePage>
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Courses</h1>
        <p className="text-sm text-muted-foreground">
          Browse programs offered by partner universities. Filter by country, tuition,
          degree level, intake, or English-test requirement.
        </p>
      </header>
      <StudentCoursesList basePath="/student/courses" />
    </MobilePage>
  );
}
