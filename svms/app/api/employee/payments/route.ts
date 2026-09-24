import { NextRequest } from "next/server";
import { ok, handleApiError, HttpError } from "@/lib/api";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { z } from "zod";
import { listPayments, createPayment } from "@/lib/services/payment-cases";

const createSchema = z.object({
  studentId: z.string().min(1, "Student is required"),
  applicationId: z.string().optional(),
  invoiceId: z.string().optional(),
  amount: z.number().positive("Amount must be positive"),
  currency: z.string().default("EUR"),
  paymentMethod: z.enum(["CASH", "BANK_TRANSFER", "BKASH", "NAGAD", "CARD", "OTHER"]),
  transactionReference: z.string().max(200).optional(),
  paymentDate: z.string().datetime().optional(),
  status: z.enum(["PENDING", "PAID", "PARTIAL"]).default("PAID"),
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
    const result = await listPayments(scope, {
      filters: {
        search: sp.get("search") ?? undefined,
        status: sp.get("status") ?? undefined,
        method: sp.get("method") ?? undefined,
        studentId: sp.get("studentId") ?? undefined,
        applicationId: sp.get("applicationId") ?? undefined,
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
    if (!hasPermission(role, "payments.manage")) throw new HttpError(403, "FORBIDDEN", "Missing payments.manage permission");

    let employeeId: string | null = null;
    if (role === "EMPLOYEE") {
      const employee = await prisma.employee.findFirst({ where: { userId: session.user.id }, select: { id: true } });
      if (!employee) throw new HttpError(403, "FORBIDDEN", "No employee record");
      employeeId = employee.id;
    }
    const scope = { isAdmin: role === "ADMIN", userId: session.user.id, employeeId };
    const body = createSchema.parse(await req.json());
    const result = await createPayment(scope, {
      studentId: body.studentId,
      applicationId: body.applicationId,
      invoiceId: body.invoiceId,
      amount: body.amount,
      currency: body.currency,
      paymentMethod: body.paymentMethod,
      transactionReference: body.transactionReference,
      paymentDate: body.paymentDate ? new Date(body.paymentDate) : undefined,
      status: body.status,
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
