import { NextRequest } from "next/server";
import { ok, handleApiError, fail, sortFrom } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { branchSchema, paginationSchema } from "@/lib/validations";
import { auditLog } from "@/lib/services/audit";
import { buildAdminBranchWhere, BRANCH_SORT_KEYS } from "@/lib/constants/branches";

/**
 * Admin branch list endpoint.
 *
 * Returns branches with the soft-delete filter driven by the
 * `?archived=true` toggle. Server-side search spans name, code, and
 * address. Filters: status. Sorting via the `sortFrom` allow-list.
 *
 * Each row includes `_count` for employees, students, and users.
 */
export async function GET(req: NextRequest) {
  try {
    const g = await guard("branches.manage");
    if (g.error) return g.error;
    const sp = req.nextUrl.searchParams;
    const params = paginationSchema.parse({
      page: sp.get("page") ?? 1,
      pageSize: sp.get("pageSize") ?? 20,
      search: sp.get("search") ?? undefined,
      status: sp.get("status") ?? undefined,
    });

    const archived = sp.get("archived") === "true";

    const where = buildAdminBranchWhere({
      search: params.search,
      status: params.status,
      archived,
    });

    const [data, total] = await Promise.all([
      prisma.branch.findMany({
        where,
        include: {
          manager: {
            select: {
              id: true,
              user: { select: { name: true } },
            },
          },
          _count: {
            select: {
              users: true,
              students: { where: { deletedAt: null } },
              employees: { where: { deletedAt: null } },
            },
          },
        },
        orderBy: sortFrom(sp, [...BRANCH_SORT_KEYS], { name: "asc" }),
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      prisma.branch.count({ where }),
    ]);
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

export async function POST(req: NextRequest) {
  try {
    const g = await guard("branches.manage");
    if (g.error) return g.error;
    const body = branchSchema.parse(await req.json());

    const existing = await prisma.branch.findUnique({ where: { code: body.code } });
    if (existing) {
      return fail("CONFLICT", "A branch with this code already exists", 409);
    }

    // Validate the manager if provided
    if (body.managerId) {
      const employee = await prisma.employee.findFirst({
        where: { id: body.managerId, deletedAt: null },
      });
      if (!employee) return fail("NOT_FOUND", "Manager (employee) not found", 404);
    }

    const branch = await prisma.branch.create({
      data: {
        ...body,
        email: body.email || undefined,
        address: body.address || undefined,
        phone: body.phone || undefined,
        managerId: body.managerId || undefined,
      },
    });
    await auditLog.record({
      userId: g.user.id,
      action: "branch.created",
      entity: "Branch",
      entityId: branch.id,
      newValue: { name: body.name, code: body.code, managerId: body.managerId },
    });
    return ok(branch, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
