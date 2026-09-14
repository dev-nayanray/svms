import { NextRequest } from "next/server";
import { ok, handleApiError, HttpError } from "@/lib/api";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { z } from "zod";
import { listAppointments, createAppointment, type AppointmentView } from "@/lib/services/appointment-cases";

const createSchema = z.object({
  studentId: z.string().min(1, "Student is required"),
  applicationId: z.string().optional(),
  type: z.string().min(1, "Type is required"),
  title: z.string().min(1, "Title is required").max(200),
  scheduledAt: z.string().min(1, "Date/time is required"),
  durationMinutes: z.number().int().min(5).max(480).default(30),
  location: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
    const role = (session.user as { role?: string }).role;
    if (role !== "EMPLOYEE" && role !== "ADMIN") throw new HttpError(403, "FORBIDDEN", "Employees only");

    let employeeId: string | null = null;
    if (role === "EMPLOYEE") {
      const employee = await prisma.employee.findFirst({ where: { userId: session.user.id }, select: { id: true } });
      if (!employee) throw new HttpError(403, "FORBIDDEN", "No employee record");
      employeeId = employee.id;
    }
    const scope = { isAdmin: role === "ADMIN", userId: session.user.id, employeeId };
    const sp = req.nextUrl.searchParams;
    const result = await listAppointments(scope, {
      view: (sp.get("view") as AppointmentView) ?? "upcoming",
      filters: {
        search: sp.get("search") ?? undefined,
        type: sp.get("type") ?? undefined,
        status: sp.get("status") ?? undefined,
        studentId: sp.get("studentId") ?? undefined,
        dateFrom: sp.get("dateFrom") ?? undefined,
        dateTo: sp.get("dateTo") ?? undefined,
      },
      page: Number(sp.get("page") ?? 1),
      pageSize: Number(sp.get("pageSize") ?? 20),
    });
    return ok(result);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
    const role = (session.user as { role?: string }).role;
    if (role !== "EMPLOYEE" && role !== "ADMIN") throw new HttpError(403, "FORBIDDEN", "Employees only");
    if (!hasPermission(role, "appointments.manage")) throw new HttpError(403, "FORBIDDEN", "Missing appointments.manage permission");

    let employeeId: string | null = null;
    if (role === "EMPLOYEE") {
      const employee = await prisma.employee.findFirst({ where: { userId: session.user.id }, select: { id: true } });
      if (!employee) throw new HttpError(403, "FORBIDDEN", "No employee record");
      employeeId = employee.id;
    }
    const scope = { isAdmin: role === "ADMIN", userId: session.user.id, employeeId };
    const body = createSchema.parse(await req.json());
    const result = await createAppointment(scope, {
      studentId: body.studentId,
      applicationId: body.applicationId,
      type: body.type,
      title: body.title,
      scheduledAt: new Date(body.scheduledAt),
      durationMinutes: body.durationMinutes,
      location: body.location,
      notes: body.notes,
    }, { id: session.user.id });
    return ok(result, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
