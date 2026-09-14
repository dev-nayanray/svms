import { ok, handleApiError } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { VISA_STATUSES, VISA_STATUS_LABELS } from "@/lib/constants/visa";

/**
 * Returns filter options for the admin visa applications UI: the list
 * of countries, students, and universities that have at least one visa
 * application. Plus the canonical visa statuses + labels for the stage
 * filter dropdown. Aggregate-only — no visa records are leaked.
 */
export async function GET() {
  try {
    const g = await guard("visa.read");
    if (g.error) return g.error;

    const [countries, students, universities] = await Promise.all([
      prisma.country.findMany({
        where: {
          deletedAt: null,
          status: "ACTIVE",
          applications: {
            some: { deletedAt: null, visaApplication: { isNot: null } },
          },
        },
        orderBy: { name: "asc" },
        select: { id: true, name: true, flag: true },
      }),
      prisma.student.findMany({
        where: {
          deletedAt: null,
          applications: {
            some: {
              deletedAt: null,
              visaApplication: { isNot: null },
            },
          },
        },
        orderBy: { firstName: "asc" },
        select: { id: true, firstName: true, lastName: true, studentId: true },
        take: 200,
      }),
      prisma.university.findMany({
        where: {
          deletedAt: null,
          status: "ACTIVE",
          applications: {
            some: { deletedAt: null, visaApplication: { isNot: null } },
          },
        },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
        take: 200,
      }),
    ]);

    const statuses = VISA_STATUSES.map((s) => ({
      value: s,
      label: VISA_STATUS_LABELS[s],
    }));

    return ok({ countries, students, universities, statuses });
  } catch (err) {
    return handleApiError(err);
  }
}
