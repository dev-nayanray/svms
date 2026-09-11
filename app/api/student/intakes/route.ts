import { NextRequest } from "next/server";
import { ok, handleApiError } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { studentIntakeQuerySchema } from "@/lib/validations";
import {
  intakeStartDate,
  intakeDeadlineUrgency,
  type IntakeUrgency,
} from "@/lib/constants/courses";

/**
 * Student-facing intake browsing endpoint.
 *
 * Returns active intakes across all student-visible courses, optionally
 * scoped to a country, university, or specific course. Each intake row is
 * enriched with a derived `startDate` (first day of the intake month) and
 * a `deadlineUrgency` flag ("urgent" / "soon" / "normal" / "past" / "none")
 * so the UI can highlight approaching deadlines without recomputing them.
 *
 * `upcomingOnly=true` filters out intakes whose deadline has already
 * passed. Intakes with no deadline are always included when upcomingOnly
 * is set (an intake without a deadline is treated as "open").
 */
export async function GET(req: NextRequest) {
  try {
    const g = await guard("courses.read");
    if (g.error) return g.error;

    const sp = req.nextUrl.searchParams;
    const params = studentIntakeQuerySchema.parse({
      page: sp.get("page") ?? 1,
      pageSize: Math.min(Number(sp.get("pageSize") ?? 20), 50),
      search: sp.get("search") ?? undefined,
      countryId: sp.get("countryId") ?? undefined,
      universityId: sp.get("universityId") ?? undefined,
      courseId: sp.get("courseId") ?? undefined,
      upcomingOnly: sp.get("upcomingOnly") === "true" ? true : undefined,
    });

    const now = new Date();

    const where = {
      status: "ACTIVE",
      course: {
        deletedAt: null,
        status: "ACTIVE",
        university: {
          deletedAt: null,
          status: "ACTIVE",
          country: { deletedAt: null, status: "ACTIVE" },
          ...(params.countryId ? { countryId: params.countryId } : {}),
        },
        ...(params.universityId ? { universityId: params.universityId } : {}),
        ...(params.courseId ? { id: params.courseId } : {}),
        ...(params.search
          ? {
              OR: [
                { name: { contains: params.search, mode: "insensitive" as const } },
                { university: { name: { contains: params.search, mode: "insensitive" as const } } },
              ],
            }
          : {}),
      },
    };

    const [rows, total] = await Promise.all([
      prisma.intake.findMany({
        where,
        include: {
          course: {
            select: {
              id: true,
              name: true,
              degreeLevel: true,
              tuitionFee: true,
              currency: true,
              university: {
                select: { id: true, name: true, country: { select: { id: true, name: true, flag: true } } },
              },
            },
          },
        },
        orderBy: [{ year: "asc" }, { month: "asc" }],
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      prisma.intake.count({ where }),
    ]);

    // Enrich with derived UI fields: a startDate (first day of the intake
    // month) and a deadlineUrgency flag the UI uses to highlight
    // approaching deadlines. The upcomingOnly filter is applied here
    // (not in the DB query) because a null deadline means "open" — a
    // server-side `gte: now` would exclude those, which is wrong.
    const data = rows
      .map((i) => {
        const startDate = intakeStartDate(i.month, i.year);
        const urgency: IntakeUrgency = intakeDeadlineUrgency(i.deadline, now);
        return {
          id: i.id,
          name: i.name,
          month: i.month,
          year: i.year,
          deadline: i.deadline,
          startDate,
          deadlineUrgency: urgency,
          course: i.course,
        };
      })
      .filter((i) => {
        if (!params.upcomingOnly) return true;
        // Keep intakes with no deadline (open) or future deadlines.
        return i.deadline === null || i.deadlineUrgency !== "past";
      });

    return ok({
      data,
      pagination: {
        page: params.page,
        pageSize: params.pageSize,
        total,
        totalPages: Math.max(Math.ceil(total / params.pageSize), 1),
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
