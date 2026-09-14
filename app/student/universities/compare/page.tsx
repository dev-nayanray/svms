import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MobilePage } from "@/components/student/ui";
import { UniversitiesCompareView } from "@/components/student/universities/universities-compare-view";

export const metadata: Metadata = {
  title: "Compare universities",
  description: "Compare up to 3 universities side-by-side — ranking, fees, courses, requirements, and intakes.",
};

export const dynamic = "force-dynamic";

/**
 * /student/universities/compare?ids=a,b,c
 *
 * Server component parses the `ids` query param and renders the
 * UniversitiesCompareView client component, which fetches each
 * university via /api/student/universities/[id] in parallel.
 *
 * Enforces:
 *  - At least 2 ids required (else redirect to /student/universities)
 *  - At most 3 ids accepted (extra ones ignored)
 *  - Invalid ObjectId-shaped ids are filtered out client-side
 *
 * The compare view handles its own loading + error + empty states
 * per university, so a 404 on one of the universities doesn't break
 * the whole comparison.
 */
export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const { ids } = await searchParams;
  const idList = (ids ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length >= 12 && /^[a-f0-9]+$/i.test(s)) // crude ObjectId shape check
    .slice(0, 3);

  if (idList.length < 2) {
    // Less than 2 universities to compare — nothing to do here.
    redirect("/student/universities");
  }

  return (
    <MobilePage>
      <UniversitiesCompareView ids={idList} />
    </MobilePage>
  );
}
