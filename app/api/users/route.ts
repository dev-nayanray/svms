import { NextRequest } from "next/server";
import { ok, handleApiError } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/users — unified user management list.
 *
 * Returns ALL users (admin + employees + students) with their role,
 * status, last login, and linked profile (student/employee).
 *
 * Supports: search (name/email), filter (role, status), pagination.
 */
export async function GET(req: NextRequest) {
  try {
    const g = await guard("employees.read");
    if (g.error) return g.error;

    const sp = req.nextUrl.searchParams;
    const search = sp.get("search") ?? "";
    const roleFilter = sp.get("role") ?? "";
    const statusFilter = sp.get("status") ?? "";
    const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(sp.get("pageSize") ?? "20", 10)));

    const where: Record<string, unknown> = { deletedAt: null };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }
    if (roleFilter) where.roleName = roleFilter;
    if (statusFilter) where.status = statusFilter;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          roleName: true,
          status: true,
          lastLoginAt: true,
          emailVerifiedAt: true,
          createdAt: true,
          updatedAt: true,
          branchId: true,
          student: { select: { id: true, studentId: true, firstName: true, lastName: true, profilePhotoUrl: true } },
          employee: { select: { id: true, title: true } },
          branch: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.user.count({ where }),
    ]);

    return ok({
      users,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
