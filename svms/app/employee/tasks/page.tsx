import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, ArrowRight } from "lucide-react";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { EmployeePageHeader } from "@/components/employee/ui";
import { Card, CardContent, Badge, Button } from "@/components/ui";
import { formatDate, titleCase, cn } from "@/lib/utils";
import { listTasks, type TaskView, TASK_VIEWS } from "@/lib/services/task-cases";
import { DataTable, Th, Td } from "@/components/employee/data-table";

export const dynamic = "force-dynamic";

const VIEW_LABELS: Record<TaskView, string> = {
  all: "All", today: "Today", upcoming: "Upcoming", overdue: "Overdue", completed: "Completed",
};

const PRIORITY_TONE: Record<string, "default" | "warning" | "destructive"> = {
  URGENT: "destructive", HIGH: "destructive", MEDIUM: "warning", LOW: "default",
};

export default async function EmployeeTasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/employee/tasks");
  const role = (session.user as { role?: string }).role;
  if (role !== "EMPLOYEE" && role !== "ADMIN") redirect("/403");

  let employeeId: string | null = null;
  if (role === "EMPLOYEE") {
    const employee = await prisma.employee.findFirst({ where: { userId: session.user.id }, select: { id: true } });
    if (!employee) redirect("/403");
    employeeId = employee.id;
  }
  const scope = { isAdmin: role === "ADMIN", userId: session.user.id, employeeId };
  const canManage = hasPermission(role, "tasks.manage");

  const sp = await searchParams;
  const view = (TASK_VIEWS.includes(sp.view as TaskView) ? sp.view : "all") as TaskView;
  const page = sp.page ? Number(sp.page) : 1;
  const pageSize = sp.pageSize ? Number(sp.pageSize) : 20;

  let result;
  try {
    result = await listTasks(scope, {
      view, page, pageSize,
      filters: {
        search: sp.search, status: sp.status, priority: sp.priority,
        studentId: sp.studentId, applicationId: sp.applicationId, assignedToId: sp.assignedToId,
      },
    });
  } catch (err) {
    console.error("[employee/tasks]", err);
    return (
      <div>
        <EmployeePageHeader title="Tasks" description="Could not load — server error." />
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">An unexpected error occurred.</CardContent></Card>
      </div>
    );
  }

  const buildViewHref = (v: TaskView) => {
    const params = new URLSearchParams();
    for (const [k, val] of Object.entries(sp)) if (val && k !== "view" && k !== "page") params.set(k, val);
    params.set("view", v);
    return `/employee/tasks?${params.toString()}`;
  };

  return (
    <div>
      <EmployeePageHeader
        title="Tasks"
        description={`${result.total} task${result.total === 1 ? "" : "s"}`}
        actions={canManage && (
          <Link href="/employee/tasks?new=true"><Button size="sm"><Plus className="h-3.5 w-3.5" aria-hidden /> New Task</Button></Link>
        )}
      />

      {/* View tabs with counts */}
      <div className="mb-4 flex flex-wrap gap-1">
        {TASK_VIEWS.map((v) => (
          <Link key={v} href={buildViewHref(v)}>
            <Button variant={view === v ? "default" : "outline"} size="sm" className="gap-1.5">
              {VIEW_LABELS[v]}
              <Badge tone={view === v ? "info" : "default"}>{result.counts[v]}</Badge>
            </Button>
          </Link>
        ))}
      </div>

      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input type="search" name="search" defaultValue={sp.search} placeholder="Search tasks…" className="h-9 min-w-[150px] flex-1 rounded-md border border-input bg-background px-3 text-sm" aria-label="Search tasks" />
        <select name="priority" defaultValue={sp.priority ?? ""} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option value="">All priorities</option>
          <option value="URGENT">Urgent</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>
        <select name="status" defaultValue={sp.status ?? ""} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option value="">All statuses</option>
          <option value="TODO">To Do</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      <DataTable
        empty={result.rows.length === 0 ? "No tasks match these filters." : undefined}
        headers={
          <tr>
            <Th>Task</Th>
            <Th className="hidden md:table-cell">Student</Th>
            <Th className="hidden lg:table-cell">Application</Th>
            <Th className="hidden xl:table-cell">Assignee</Th>
            <Th>Priority</Th>
            <Th>Status</Th>
            <Th className="hidden md:table-cell">Due date</Th>
            <Th className="hidden lg:table-cell">Created</Th>
            <Th className="text-right"><span className="sr-only">Actions</span></Th>
          </tr>
        }
      >
        {result.rows.map((t) => (
          <tr key={t.id} className="hover:bg-muted/30">
            <Td>
              <p className="font-medium">{t.title}</p>
              {t.description && <p className="text-xs text-muted-foreground line-clamp-1">{t.description}</p>}
            </Td>
            <Td className="hidden md:table-cell text-muted-foreground">
              {t.student ? (
                <Link href={`/employee/students/${t.student.id}`} className="hover:underline">{t.student.firstName} {t.student.lastName}</Link>
              ) : "—"}
            </Td>
            <Td className="hidden lg:table-cell text-muted-foreground">
              {t.application ? (
                <Link href={`/employee/applications/${t.application.id}`} className="font-mono text-xs hover:underline">{t.application.applicationNumber}</Link>
              ) : "—"}
            </Td>
            <Td className="hidden xl:table-cell text-muted-foreground">{t.assignee?.name ?? "—"}</Td>
            <Td><Badge tone={PRIORITY_TONE[t.priority] ?? "default"}>{titleCase(t.priority)}</Badge></Td>
            <Td>
              <Badge tone={t.status === "COMPLETED" ? "success" : t.status === "CANCELLED" ? "destructive" : t.overdue ? "destructive" : "info"}>
                {titleCase(t.status)}
              </Badge>
            </Td>
            <Td className="hidden md:table-cell">
              {t.dueDate ? (
                <span className={cn("text-xs", t.overdue ? "font-medium text-destructive" : "text-muted-foreground")}>
                  {formatDate(t.dueDate)}
                  {t.overdue && <span className="ml-1 text-destructive">⚠</span>}
                </span>
              ) : "—"}
            </Td>
            <Td className="hidden lg:table-cell text-muted-foreground">{formatDate(t.createdAt)}</Td>
            <Td>
              <Link href={`/employee/tasks?view=${view}&task=${t.id}`} aria-label="View task">
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><ArrowRight className="h-3.5 w-3.5" /></Button>
              </Link>
            </Td>
          </tr>
        ))}
      </DataTable>

      {result.totalPages > 1 && (
        <nav aria-label="Pagination" className="mt-4 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Showing {(page - 1) * pageSize + 1}–{Math.min(result.total, page * pageSize)} of {result.total}</p>
          <div className="flex items-center gap-1">
            {page > 1 && (() => {
              const params = new URLSearchParams();
              for (const [k, v] of Object.entries(sp)) if (v) params.set(k, v);
              params.set("page", String(page - 1));
              return <Link href={`/employee/tasks?${params.toString()}`}><Button variant="outline" size="sm">Previous</Button></Link>;
            })()}
            <span className="text-sm font-medium">Page {page} / {result.totalPages}</span>
            {page < result.totalPages && (() => {
              const params = new URLSearchParams();
              for (const [k, v] of Object.entries(sp)) if (v) params.set(k, v);
              params.set("page", String(page + 1));
              return <Link href={`/employee/tasks?${params.toString()}`}><Button variant="outline" size="sm">Next</Button></Link>;
            })()}
          </div>
        </nav>
      )}
    </div>
  );
}
