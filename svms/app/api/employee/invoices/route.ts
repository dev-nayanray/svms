import { NextRequest } from "next/server";
import { ok, handleApiError, HttpError } from "@/lib/api";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { z } from "zod";
import { listInvoices, createInvoice, type InvoiceListFilters } from "@/lib/services/invoice-cases";

const createSchema = z.object({
  studentId: z.string().min(1, "Student is required"),
  applicationId: z.string().optional(),
  items: z.array(z.object({
    description: z.string().min(1, "Description required"),
    quantity: z.number().int().positive(),
    unitPrice: z.number().nonnegative(),
  })).min(1, "At least one item required"),
  discount: z.number().nonnegative().default(0),
  taxRate: z.number().nonnegative().max(100).default(0),
  currency: z.string().default("EUR"),
  dueDate: z.string().datetime().optional(),
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
    const result = await listInvoices(scope, {
      filters: {
        search: sp.get("search") ?? undefined,
        status: sp.get("status") ?? undefined,
        studentId: sp.get("studentId") ?? undefined,
        applicationId: sp.get("applicationId") ?? undefined,
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
    if (!hasPermission(role, "invoices.manage")) throw new HttpError(403, "FORBIDDEN", "Missing invoices.manage permission");

    let employeeId: string | null = null;
    if (role === "EMPLOYEE") {
      const employee = await prisma.employee.findFirst({ where: { userId: session.user.id }, select: { id: true } });
      if (!employee) throw new HttpError(403, "FORBIDDEN", "No employee record");
      employeeId = employee.id;
    }
    const scope = { isAdmin: role === "ADMIN", userId: session.user.id, employeeId };
    const body = createSchema.parse(await req.json());
    const result = await createInvoice(scope, {
      studentId: body.studentId,
      applicationId: body.applicationId,
      items: body.items,
      discount: body.discount,
      taxRate: body.taxRate,
      currency: body.currency,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      notes: body.notes,
    }, {
      id: session.user.id,
      ipAddress: req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip"),
      userAgent: req.headers.get("user-agent"),
    });
    return ok(result, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
