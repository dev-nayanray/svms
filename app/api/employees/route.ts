import { NextRequest } from "next/server";
import { ok, handleApiError, sortFrom } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { employeeService } from "@/lib/services/employee";
import { employeeSchema, paginationSchema } from "@/lib/validations";

export async function GET(req: NextRequest) {
  try {
    const g = await guard("employees.read");
    if (g.error) return g.error;
    const sp = req.nextUrl.searchParams;
    const params = paginationSchema.parse({
      page: sp.get("page") ?? 1,
      pageSize: sp.get("pageSize") ?? 20,
      search: sp.get("search") ?? undefined,
    });
    const { data, total } = await employeeService.list({
      ...params,
      branchId: sp.get("branchId") ?? undefined,
      sortBy: sortFrom(sp, ["name", "status", "createdAt"], {}),
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

export async function POST(req: NextRequest) {
  try {
    const g = await guard("employees.create");
    if (g.error) return g.error;
    const body = employeeSchema.parse(await req.json());
    const employee = await employeeService.create(body, g.user);
    return ok(employee, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
