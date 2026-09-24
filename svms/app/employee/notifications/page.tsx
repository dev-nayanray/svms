import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { EmployeePageHeader } from "@/components/employee/ui";
import {
  listNotifications,
  getUnreadCount,
  NOTIFICATION_CATEGORIES,
  type NotificationCategory,
} from "@/lib/services/notification-cases";
import { NotificationsClient } from "@/components/employee/notifications/notifications-client";

export const dynamic = "force-dynamic";

export default async function EmployeeNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/employee/notifications");
  const role = (session.user as { role?: string }).role;
  if (role !== "EMPLOYEE" && role !== "ADMIN") redirect("/403");

  let employeeId: string | null = null;
  if (role === "EMPLOYEE") {
    const employee = await prisma.employee.findFirst({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (!employee) redirect("/403");
    employeeId = employee.id;
  }
  const scope = { isAdmin: role === "ADMIN", userId: session.user.id, employeeId };

  const sp = await searchParams;
  const categoryParam = sp.category ?? undefined;
  const category =
    categoryParam && NOTIFICATION_CATEGORIES.includes(categoryParam as NotificationCategory)
      ? (categoryParam as NotificationCategory)
      : undefined;

  let result;
  let unreadBreakdown;
  let loadError: string | null = null;
  try {
    [result, unreadBreakdown] = await Promise.all([
      listNotifications(scope, {
        filters: {
          unreadOnly: sp.unreadOnly === "true",
          category,
          type: sp.type,
        },
        page: Number(sp.page ?? 1),
        pageSize: Number(sp.pageSize ?? 30),
      }),
      getUnreadCount(scope),
    ]);
  } catch (err) {
    console.error("[employee/notifications]", err);
    loadError = "Could not load notifications — server error.";
    result = { rows: [], total: 0, unread: 0, page: 1, pageSize: 30, totalPages: 1 };
    unreadBreakdown = { total: 0, byCategory: Object.fromEntries(NOTIFICATION_CATEGORIES.map((c) => [c, 0])) as Record<NotificationCategory, number> };
  }

  return (
    <div>
      <EmployeePageHeader
        title="Notifications"
        description={
          loadError
            ? loadError
            : result.unread > 0
              ? `${result.unread} unread of ${result.total} total`
              : `${result.total} notification${result.total === 1 ? "" : "s"}`
        }
      />

      <NotificationsClient
        initialRows={result.rows}
        initialTotal={result.total}
        initialUnread={result.unread}
        initialPage={result.page}
        initialPageSize={result.pageSize}
        initialTotalPages={result.totalPages}
        initialUnreadBreakdown={unreadBreakdown}
        initialFilterCategory={category}
        initialFilterUnreadOnly={sp.unreadOnly === "true"}
      />
    </div>
  );
}
