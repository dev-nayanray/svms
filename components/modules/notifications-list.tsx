import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { EmptyState } from "@/components/shared";
import { formatDate } from "@/lib/utils";

export async function NotificationsList() {
  const session = await getSession();
  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <>
      {notifications.length === 0 ? (
        <EmptyState title="No notifications" />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {notifications.map((n) => (
            <li key={n.id} className="flex items-start justify-between gap-4 p-4">
              <div>
                <p className="text-sm font-medium">
                  {n.title}
                  {!n.readAt && (
                    <span className="ml-2 inline-block h-2 w-2 rounded-full bg-primary" aria-label="Unread" />
                  )}
                </p>
                <p className="text-sm text-muted-foreground">{n.message}</p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">{formatDate(n.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
