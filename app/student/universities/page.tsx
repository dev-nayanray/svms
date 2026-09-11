import type { Metadata } from "next";
import { StudentUniversitiesList } from "@/components/modules/student-universities-list";
import { MobilePage } from "@/components/student/ui";

export const metadata: Metadata = {
  title: "Universities",
  description:
    "Explore universities recommended by your counselor. Save favorites, request counseling, and view courses.",
};

export const dynamic = "force-dynamic";

/**
 * Module 07 — Universities (/student/universities)
 *
 * Server component renders the mobile-first StudentUniversitiesList
 * inside a MobilePage wrapper for consistent spacing with the other
 * student modules. The list component handles:
 *  - Sticky search bar (server-side search across name, city, country)
 *  - Filter bottom sheet (country, city, ranking, favorites-only)
 *  - Sort dropdown (name, ranking, applicationFee, createdAt)
 *  - Active filter chips (horizontal scroll on mobile)
 *  - Loading skeletons + empty + error states
 *  - Server-side pagination
 *  - Per-card favorite toggle (optimistic) + counseling request dialog
 *
 * Visibility rule: only ACTIVE universities in ACTIVE countries are
 * returned — enforced at the DB level by buildStudentUniversityWhere.
 */
export default function Page() {
  return (
    <MobilePage>
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Universities</h1>
        <p className="text-sm text-muted-foreground">
          Explore universities recommended by your counselor. Save your
          favorites or request counseling for any that catch your eye.
        </p>
      </header>
      <StudentUniversitiesList basePath="/student/universities" />
    </MobilePage>
  );
}
