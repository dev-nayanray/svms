import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { EmptyState, StatusBadge } from "@/components/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { formatDate, titleCase, cn } from "@/lib/utils";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function StudentDashboard() {
  const session = await getSession();
  if (session.user.role === "EMPLOYEE") redirect("/403");
  const student = await prisma.student.findUnique({
    where: { userId: session.user.id },
    include: {
      employee: { include: { user: true } },
      applications: {
        where: { deletedAt: null },
        include: { country: true, statusHistory: { orderBy: { createdAt: "desc" }, take: 5 } },
      },
    },
  });
  if (!student) {
    return <EmptyState title="Profile not set up" description="Please contact your counselor." />;
  }

  const [pendingDocs, notifications, invoices] = await Promise.all([
    prisma.document.count({
      where: { studentId: student.id, deletedAt: null, status: { in: ["REQUESTED", "REJECTED"] } },
    }),
    prisma.notification.findMany({ where: { userId: session.user.id }, orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.invoice.findMany({ where: { studentId: student.id, deletedAt: null }, orderBy: { createdAt: "desc" }, take: 5 }),
  ]);

  const stages = await prisma.applicationStage.findMany({ where: { enabled: true }, orderBy: { sortOrder: "asc" } });
  const mainApp = student.applications[0];
  const currentIdx = stages.findIndex((s) => s.key === mainApp?.stageKey);

  return (
    <>
      <h1 className="text-xl font-semibold">Hello, {student.firstName} 👋</h1>

      <Card>
        <CardHeader>
          <CardTitle>
            Application Progress
            {mainApp ? ` — ${mainApp.applicationNumber} (${mainApp.country.name})` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!mainApp ? (
            <EmptyState
              title="No application yet"
              description="Your counselor will create your application soon."
            />
          ) : (
            <ol className="flex gap-1 overflow-x-auto pb-2" aria-label="Application progress">
              {stages.map((stage, i) => {
                const done = i <= currentIdx;
                return (
                  <li key={stage.id} className="flex min-w-20 flex-1 flex-col items-center gap-1 text-center">
                    <div className="flex w-full items-center">
                      <span className={cn("h-0.5 flex-1", i === 0 ? "bg-transparent" : done ? "bg-primary" : "bg-border")} />
                      <span
                        className={cn(
                          "grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-semibold",
                          done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        )}
                      >
                        {i + 1}
                      </span>
                      <span className={cn("h-0.5 flex-1", i === stages.length - 1 ? "bg-transparent" : i < currentIdx ? "bg-primary" : "bg-border")} />
                    </div>
                    <span className={cn("text-[10px] leading-tight", i === currentIdx ? "font-semibold text-primary" : "text-muted-foreground")}>
                      {titleCase(stage.name)}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>My Counselor</CardTitle></CardHeader>
          <CardContent className="text-sm">
            {student.employee ? (
              <>
                <p className="font-medium">{student.employee.user.name}</p>
                <p className="text-muted-foreground">{student.employee.user.email}</p>
              </>
            ) : (
              <p className="text-muted-foreground">Not assigned yet</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Pending Documents</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{pendingDocs}</p>
            <Link href="/student/documents" className="text-sm text-primary hover:underline">
              View documents →
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Payment Summary</CardTitle></CardHeader>
          <CardContent className="text-sm">
            {invoices.length === 0 && <p className="text-muted-foreground">No invoices yet</p>}
            {invoices.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between py-0.5">
                <span>{inv.invoiceNumber}</span>
                <StatusBadge status={inv.status} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Recent Updates</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {notifications.length === 0 && <p className="text-muted-foreground">No notifications yet.</p>}
          {notifications.map((n) => (
            <div key={n.id} className="flex items-center justify-between border-b border-border pb-2 last:border-0">
              <div>
                <p className="font-medium">{n.title}</p>
                <p className="text-muted-foreground">{n.message}</p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">{formatDate(n.createdAt)}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
