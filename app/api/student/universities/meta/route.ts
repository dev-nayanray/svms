import { ok, handleApiError } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";

/**
 * Returns the filter options for the student university discovery UI:
 * the list of countries and cities that have at least one student-visible
 * university, plus the highest ranking among visible universities (used
 * to set the ranking-filter slider ceiling).
 *
 * Aggregate-only response — no university records are leaked.
 */
export async function GET() {
  try {
    const g = await guard("universities.read");
    if (g.error) return g.error;

    const visibleWhere = {
      deletedAt: null,
      status: "ACTIVE",
      country: { deletedAt: null, status: "ACTIVE" },
    };

    const [countries, cities, maxRanking] = await Promise.all([
      prisma.country.findMany({
        where: {
          deletedAt: null,
          status: "ACTIVE",
          universities: { some: { deletedAt: null, status: "ACTIVE" } },
        },
        orderBy: { name: "asc" },
        select: { id: true, name: true, flag: true },
      }),
      prisma.university.findMany({
        where: visibleWhere,
        select: { city: true },
        distinct: ["city"],
      }),
      prisma.university.aggregate({
        where: visibleWhere,
        _max: { ranking: true },
      }),
    ]);

    const cityList = cities
      .map((u) => u.city)
      .filter((c): c is string => !!c)
      .sort((a, b) => a.localeCompare(b));

    return ok({
      countries,
      cities: cityList,
      maxRanking: maxRanking._max.ranking ?? null,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
