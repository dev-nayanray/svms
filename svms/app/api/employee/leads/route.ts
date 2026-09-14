import { NextRequest } from "next/server";
import { ok, handleApiError, HttpError } from "@/lib/api";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { z } from "zod";
import { listLeads, createLead, type LeadListFilters } from "@/lib/services/lead-cases";

const createSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  phone: z.string().max(40).optional(),
  email: z.string().email().optional().or(z.literal("")),
  interestedCountry: z.string().max(100).optional(),
  preferredCourse: z.string().max(200).optional(),
  source: z.string().max(50).optional(),
  notes: z.string().max(5000).optional(),
  nextFollowUp: z.string().datetime().optional(),
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
    const result = await listLeads(scope, {
      filters: {
        search: sp.get("search") ?? undefined,
        status: sp.get("status") ?? undefined,
        source: sp.get("source") ?? undefined,
        employeeId: sp.get("employeeId") ?? undefined,
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
    if (!hasPermission(role, "leads.manage")) throw new HttpError(403, "FORBIDDEN", "Missing leads.manage permission");

    let employeeId: string | null = null;
    if (role === "EMPLOYEE") {
      const employee = await prisma.employee.findFirst({ where: { userId: session.user.id }, select: { id: true } });
      if (!employee) throw new HttpError(403, "FORBIDDEN", "No employee record");
      employeeId = employee.id;
    }
    const scope = { isAdmin: role === "ADMIN", userId: session.user.id, employeeId };
    const body = createSchema.parse(await req.json());
    const result = await createLead(scope, {
      name: body.name, phone: body.phone, email: body.email || undefined,
      interestedCountry: body.interestedCountry, preferredCourse: body.preferredCourse,
      source: body.source, notes: body.notes,
      nextFollowUp: body.nextFollowUp ? new Date(body.nextFollowUp) : undefined,
    }, { id: session.user.id });
    return ok(result, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
