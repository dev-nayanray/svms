import { NextRequest } from "next/server";
import { ok, handleApiError, sortFrom } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { paginationSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

/**
 * GET /api/support
 *
 * Admin/Employee support request list. Supports filters:
 *  - search (subject, description, student name)
 *  - status (OPEN, IN_PROGRESS, RESOLVED, CLOSED)
 *  - category (APPLICATION, DOCUMENTS, UNIVERSITY, VISA, PAYMENTS, APPOINTMENTS, ACCOUNT, OTHER)
 *  - priority (LOW, MEDIUM, HIGH, URGENT)
 *  - studentId
 */
export async function GET(req: NextRequest) {
  try {
    const g = await guard();
    if (g.error) return g.error;

    const sp = req.nextUrl.searchParams;
    const params = paginationSchema.parse({
      page: sp.get("page") ?? 1,
      pageSize: sp.get("pageSize") ?? 20,
      search: sp.get("search") ?? undefined,
      status: sp.get("status") ?? undefined,
    });

    const category = sp.get("category") ?? undefined;
    const priority = sp.get("priority") ?? undefined;
    const studentId = sp.get("studentId") ?? undefined;

    const where: Record<string, unknown> = {};
    if (params.status) where.status = params.status;
    if (category) where.category = category;
    if (priority) where.priority = priority;
    if (studentId) where.studentId = studentId;

    if (params.search) {
      const s = params.search.trim();
      where.OR = [
        { subject: { contains: s, mode: "insensitive" } },
        { description: { contains: s, mode: "insensitive" } },
        { student: { firstName: { contains: s, mode: "insensitive" } } },
        { student: { lastName: { contains: s, mode: "insensitive" } } },
      ];
    }

    const orderBy = sortFrom(sp, ["createdAt", "updatedAt", "priority"], { createdAt: "desc" });

    const [rows, total] = await Promise.all([
      prisma.supportRequest.findMany({
        where,
        include: {
          student: {
            select: { id: true, firstName: true, lastName: true, studentId: true, email: true },
          },
        },
        orderBy,
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      prisma.supportRequest.count({ where }),
    ]);

    return ok({
      data: rows,
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
