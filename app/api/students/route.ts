import { NextRequest } from "next/server";
import { ok, handleApiError, sortFrom } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { studentService } from "@/lib/services/student";
import { studentCreateSchema, paginationSchema } from "@/lib/validations";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const toDate = (raw: string | null, endOfDay = false): Date | undefined => {
  if (!raw || !DATE_RE.test(raw)) return undefined;
  return new Date(`${raw}T${endOfDay ? "23:59:59.999" : "00:00:00"}`);
};

export async function GET(req: NextRequest) {
  try {
    const g = await guard("students.read");
    if (g.error) return g.error;
    const sp = req.nextUrl.searchParams;
    const params = paginationSchema.parse({
      page: sp.get("page") ?? 1,
      pageSize: sp.get("pageSize") ?? 20,
      search: sp.get("search") ?? undefined,
      status: sp.get("status") ?? undefined,
    });

    // Employees see only their assigned students
    let employeeId: string | undefined;
    if (g.user.role === "EMPLOYEE") {
      const emp = await (await import("@/lib/db")).prisma.employee.findUnique({
        where: { userId: g.user.id },
      });
      if (emp) employeeId = emp.id;
    }

    const orderBy = sortFrom(sp, ["firstName", "lastName", "email", "studentId", "status", "createdAt"]);
    const { data, total } = await studentService.list({
      ...params,
      employeeId,
      sortBy: orderBy,
      branchId: sp.get("branchId") ?? undefined,
      country: sp.get("country") ?? undefined,
      appStage: sp.get("appStage") ?? undefined,
      createdFrom: toDate(sp.get("createdFrom")),
      createdTo: toDate(sp.get("createdTo"), true),
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
    const g = await guard("students.create");
    if (g.error) return g.error;
    const body = studentCreateSchema.parse(await req.json());
    const student = await studentService.create(body, g.user);
    return ok(student, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
