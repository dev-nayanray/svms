import { NextRequest } from "next/server";
import { ok, handleApiError, HttpError } from "@/lib/api";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  markAllNotificationsRead,
  NOTIFICATION_CATEGORIES,
  type NotificationCategory,
} from "@/lib/services/notification-cases";

async function resolveScope() {
  const session = await auth();
  if (!session?.user?.id) throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
  const role = (session.user as { role?: string }).role;
  if (role !== "EMPLOYEE" && role !== "ADMIN") throw new HttpError(403, "FORBIDDEN", "Employees only");

  let employeeId: string | null = null;
  if (role === "EMPLOYEE") {
    const employee = await prisma.employee.findFirst({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (!employee) throw new HttpError(403, "FORBIDDEN", "No employee record");
    employeeId = employee.id;
  }
  return { isAdmin: role === "ADMIN", userId: session.user.id, employeeId };
}

export async function POST(req: NextRequest) {
  try {
    const scope = await resolveScope();
    const sp = req.nextUrl.searchParams;
    const categoryParam = sp.get("category") ?? undefined;
    const category =
      categoryParam && NOTIFICATION_CATEGORIES.includes(categoryParam as NotificationCategory)
        ? (categoryParam as NotificationCategory)
        : undefined;
    const result = await markAllNotificationsRead(scope, { category });
    return ok(result);
  } catch (err) {
    return handleApiError(err);
  }
}
