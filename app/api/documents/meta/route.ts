import { ok, handleApiError } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";

/**
 * Returns the filter options for the admin documents UI:
 * the list of countries, students, applications, and employees that
 * have at least one document. Aggregate-only response — no document
 * records are leaked.
 */
export async function GET() {
  try {
    const g = await guard("documents.read");
    if (g.error) return g.error;

    const [countries, students, applications, employees] = await Promise.all([
      prisma.country.findMany({
        where: {
          deletedAt: null,
          status: "ACTIVE",
          applications: {
            some: { deletedAt: null, documents: { some: { deletedAt: null } } },
          },
        },
        orderBy: { name: "asc" },
        select: { id: true, name: true, flag: true },
      }),
      prisma.student.findMany({
        where: {
          deletedAt: null,
          documents: { some: { deletedAt: null } },
        },
        orderBy: { firstName: "asc" },
        select: { id: true, firstName: true, lastName: true, studentId: true },
        take: 200,
      }),
      prisma.application.findMany({
        where: {
          deletedAt: null,
          documents: { some: { deletedAt: null } },
        },
        orderBy: { createdAt: "desc" },
        select: { id: true, applicationNumber: true },
        take: 200,
      }),
      prisma.employee.findMany({
        where: {
          students: {
            some: { deletedAt: null, documents: { some: { deletedAt: null } } },
          },
        },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          user: { select: { name: true } },
        },
        take: 200,
      }),
    ]);

    return ok({ countries, students, applications, employees });
  } catch (err) {
    return handleApiError(err);
  }
}
