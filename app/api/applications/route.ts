import { NextRequest } from "next/server";
import { ok, handleApiError, sortFrom } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { applicationService } from "@/lib/services/application";
import { applicationSchema, paginationSchema } from "@/lib/validations";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const g = await guard("applications.read");
    if (g.error) return g.error;
    const sp = req.nextUrl.searchParams;
    const params = paginationSchema.parse({
      page: sp.get("page") ?? 1,
      pageSize: sp.get("pageSize") ?? 20,
      search: sp.get("search") ?? undefined,
    });

    let studentId = sp.get("studentId") ?? undefined;
    let employeeId = sp.get("employeeId") ?? undefined;

    if (g.user.role === "STUDENT") {
      const me = await prisma.student.findUnique({ where: { userId: g.user.id } });
      studentId = me?.id ?? "none";
    } else if (g.user.role === "EMPLOYEE") {
      const emp = await prisma.employee.findUnique({ where: { userId: g.user.id } });
      if (emp) employeeId = emp.id;
    }

    const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
    const toDate = (raw: string | null, end = false) =>
      raw && DATE_RE.test(raw) ? new Date(`${raw}T${end ? "23:59:59.999" : "00:00:00"}`) : undefined;

    const { data, total } = await applicationService.list({
      ...params,
      studentId,
      employeeId,
      stageKey: sp.get("stage") ?? undefined,
      status: sp.get("status") ?? undefined,
      countryId: sp.get("countryId") ?? undefined,
      universityId: sp.get("universityId") ?? undefined,
      courseId: sp.get("courseId") ?? undefined,
      intakeId: sp.get("intakeId") ?? undefined,
      branchId: sp.get("branchId") ?? undefined,
      priority: sp.get("priority") ?? undefined,
      createdFrom: toDate(sp.get("createdFrom")),
      createdTo: toDate(sp.get("createdTo"), true),
      sortBy: sortFrom(sp, ["applicationNumber", "stageKey", "status", "priority", "createdAt"]),
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
    const g = await guard("applications.manage");
    if (g.error) return g.error;
    const body = applicationSchema.parse(await req.json());
    const app = await applicationService.create(body, g.user);
    return ok(app, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
