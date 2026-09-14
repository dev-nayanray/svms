import { NextRequest } from "next/server";
import { ok, handleApiError, HttpError } from "@/lib/api";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { z } from "zod";
import { updateLead, getLeadById } from "@/lib/services/lead-cases";

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  phone: z.string().max(40).optional(),
  email: z.string().email().optional().or(z.literal("")),
  interestedCountry: z.string().max(100).optional(),
  preferredCourse: z.string().max(200).optional(),
  source: z.string().max(50).optional(),
  notes: z.string().max(5000).optional(),
  nextFollowUp: z.string().datetime().optional().nullable(),
});

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
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
    const { id } = await ctx.params;
    const lead = await getLeadById(scope, id);
    if (!lead) throw new HttpError(404, "NOT_FOUND", "Lead not found");
    return ok(lead);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
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
    const { id } = await ctx.params;
    const body = updateSchema.parse(await req.json());
    await updateLead(scope, id, {
      ...body, email: body.email || undefined,
      nextFollowUp: body.nextFollowUp === null ? null : body.nextFollowUp ? new Date(body.nextFollowUp) : undefined,
    }, { id: session.user.id });
    return ok({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
