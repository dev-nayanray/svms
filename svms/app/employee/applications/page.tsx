import { redirect } from "next/navigation";
import Link from "next/link";
import { Eye, AlertTriangle, ArrowRight } from "lucide-react";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { EmployeePageHeader } from "@/components/employee/ui";
import { Card, CardContent, Badge, Button } from "@/components/ui";
import { formatDate, titleCase, cn } from "@/lib/utils";
import {
  listApplications,
  getKanbanBoard,
  type ApplicationSortKey,
  type ApplicationListFilters,
} from "@/lib/services/application-cases";
import { ApplicationFilters } from "@/components/employee/applications-filters";
import { DataTable, Th, Td } from "@/components/employee/data-table";

export const dynamic = "force-dynamic";

const _ALL_COLUMNS = [
  "applicationNumber", "student", "country", "university", "course", "intake",
  "stage", "status", "priority", "assignee", "nextAction", "deadline", "updated",
];

const PRIORITY_TONE: Record<string, "default" | "warning" | "destructive" | "info"> = {
  URGENT: "destructive",
  HIGH: "destructive",
  MEDIUM: "warning",
  LOW: "default",
};

export default async function EmployeeApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/employee/applications");
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
  const perms = {
    view: hasPermission(role, "applications.read"),
    edit: hasPermission(role, "applications.update"),
  };

  const sp = await searchParams;
  const view = sp.view === "kanban" ? "kanban" : "list";

  const filters: ApplicationListFilters = {
    search: sp.search,
    stage: sp.stage,
    status: sp.status,
    priority: sp.priority,
    countryId: sp.countryId,
    universityId: sp.universityId,
    courseId: sp.courseId,
    intakeId: sp.intakeId,
    assignedEmployeeId: sp.assignedEmployeeId,
    deadlineFrom: sp.deadlineFrom,
    deadlineTo: sp.deadlineTo,
    archived: sp.archived === "true",
  };

  // Fetch filter dropdown options in parallel — only the ones the employee can see.
  const [countries, universities, courses, intakes, employees] = await Promise.all([
    prisma.country.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.university.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.course.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.intake.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.employee.findMany({ select: { id: true, user: { select: { name: true } } }, orderBy: { createdAt: "desc" } })
      .then((rows) => rows.map((e) => ({ id: e.id, name: e.user.name }))),
  ]);

  // ─── Kanban view ───
  if (view === "kanban") {
    const board = await getKanbanBoard(scope, filters);
    return (
      <div>
        <EmployeePageHeader
          title="My Applications"
          description={scope.isAdmin ? "All applications · Kanban view" : "Applications assigned to you · Kanban view"}
        />
        <ApplicationFilters
          initialSearch={sp.search}
          initialFilters={{
            status: sp.status, priority: sp.priority, countryId: sp.countryId,
            universityId: sp.universityId, courseId: sp.courseId, intakeId: sp.intakeId,
            assignedEmployeeId: sp.assignedEmployeeId, deadlineFrom: sp.deadlineFrom,
            deadlineTo: sp.deadlineTo, archived: sp.archived,
          }}
          countries={countries}
          universities={universities}
          courses={courses}
          intakes={intakes}
          employees={employees}
          view="kanban"
        />
        <KanbanBoard columns={board} perms={perms} />
      </div>
    );
  }

  // ─── List view ───
  const page = sp.page ? Number(sp.page) : 1;
  const pageSize = sp.pageSize ? Number(sp.pageSize) : 20;
  const sortBy = (sp.sortBy as ApplicationSortKey) ?? "updatedAt";
  const sortOrder = (sp.sortOrder as "asc" | "desc") ?? "desc";

  let result;
  try {
    result = await listApplications(scope, { filters, page, pageSize, sortBy, sortOrder });
  } catch (err) {
    console.error("[employee/applications]", err);
    return (
      <div>
        <EmployeePageHeader title="My Applications" description="Could not load — server error." />
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          An unexpected error occurred. Try refreshing the page.
        </CardContent></Card>
      </div>
    );
  }

  const activeSort = { key: sortBy, dir: sortOrder };
  const sortUrl = (key: string) => {
    const params = toParams(sp);
    const dir = sortBy === key && sortOrder === "asc" ? "desc" : "asc";
    params.set("sortBy", key);
    params.set("sortOrder", dir);
    params.set("view", "list");
    return `/employee/applications?${params.toString()}`;
  };

  return (
    <div>
      <EmployeePageHeader
        title="My Applications"
        description={
          scope.isAdmin
            ? `${result.total} applications across the platform`
            : `${result.total} application${result.total === 1 ? "" : "s"} assigned to you`
        }
      />
      <ApplicationFilters
        initialSearch={sp.search}
        initialFilters={{
          stage: sp.stage, status: sp.status, priority: sp.priority,
          countryId: sp.countryId, universityId: sp.universityId, courseId: sp.courseId,
          intakeId: sp.intakeId, assignedEmployeeId: sp.assignedEmployeeId,
          deadlineFrom: sp.deadlineFrom, deadlineTo: sp.deadlineTo, archived: sp.archived,
        }}
        countries={countries}
        universities={universities}
        courses={courses}
        intakes={intakes}
        employees={employees}
        view="list"
      />

      <DataTable
        empty={result.rows.length === 0 ? "No applications match these filters." : undefined}
        headers={
          <tr>
            <Th sortKey="applicationNumber" activeSort={activeSort} onSort={(k) => sortUrl(k)}>Application #</Th>
            <Th>Student</Th>
            <Th className="hidden md:table-cell">Country</Th>
            <Th className="hidden lg:table-cell">University</Th>
            <Th className="hidden lg:table-cell">Course</Th>
            <Th className="hidden xl:table-cell">Intake</Th>
            <Th sortKey="stageKey" activeSort={activeSort} onSort={(k) => sortUrl(k)}>Stage</Th>
            <Th>Status</Th>
            <Th sortKey="priority" activeSort={activeSort} onSort={(k) => sortUrl(k)} className="hidden md:table-cell">Priority</Th>
            <Th className="hidden lg:table-cell">Assignee</Th>
            <Th className="hidden xl:table-cell">Next action</Th>
            <Th sortKey="deadline" activeSort={activeSort} onSort={(k) => sortUrl(k)} className="hidden md:table-cell">Deadline</Th>
            <Th sortKey="updatedAt" activeSort={activeSort} onSort={(k) => sortUrl(k)} className="hidden lg:table-cell">Updated</Th>
            <Th className="text-right"><span className="sr-only">Actions</span></Th>
          </tr>
        }
      >
        {result.rows.map((a) => {
          const overdue = a.nextDeadline && a.nextDeadline < new Date();
          return (
            <tr key={a.id} className="hover:bg-muted/30">
              <Td>
                <Link href={`/employee/applications/${a.id}`} className="font-medium hover:underline">
                  {a.applicationNumber}
                </Link>
              </Td>
              <Td>
                {a.student.firstName} {a.student.lastName}
                <p className="text-xs text-muted-foreground">{a.student.studentId}</p>
              </Td>
              <Td className="hidden text-muted-foreground md:table-cell">{a.country?.name ?? "—"}</Td>
              <Td className="hidden text-muted-foreground lg:table-cell">{a.university?.name ?? "—"}</Td>
              <Td className="hidden text-muted-foreground lg:table-cell">{a.course?.name ?? "—"}</Td>
              <Td className="hidden text-muted-foreground xl:table-cell">{a.intake?.name ?? "—"}</Td>
              <Td><Badge tone="info">{titleCase(a.stageKey)}</Badge></Td>
              <Td><Badge tone={a.status === "COMPLETED" ? "success" : a.status === "CANCELLED" ? "destructive" : "default"}>{titleCase(a.status)}</Badge></Td>
              <Td className="hidden md:table-cell"><Badge tone={PRIORITY_TONE[a.priority] ?? "default"}>{a.priority}</Badge></Td>
              <Td className="hidden text-muted-foreground lg:table-cell">{a.assignedEmployee?.user.name ?? "—"}</Td>
              <Td className="hidden text-muted-foreground xl:table-cell">
                {a.nextAction ? <span className="truncate">{a.nextAction}</span> : "—"}
              </Td>
              <Td className="hidden md:table-cell">
                {a.nextDeadline ? (
                  <span className={cn(overdue ? "font-medium text-destructive" : "text-muted-foreground")}>
                    {formatDate(a.nextDeadline)}
                  </span>
                ) : "—"}
              </Td>
              <Td className="hidden text-muted-foreground lg:table-cell">{formatDate(a.updatedAt)}</Td>
              <Td>
                <Link href={`/employee/applications/${a.id}`} aria-label="View application">
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Eye className="h-3.5 w-3.5" /></Button>
                </Link>
              </Td>
            </tr>
          );
        })}
      </DataTable>

      {result.totalPages > 1 && (
        <Pagination
          page={result.page}
          totalPages={result.totalPages}
          total={result.total}
          pageSize={result.pageSize}
          buildHref={(p) => {
            const params = toParams(sp);
            params.set("page", String(p));
            params.set("view", "list");
            return `/employee/applications?${params.toString()}`;
          }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Kanban board
// ─────────────────────────────────────────────

function KanbanBoard({
  columns,
  perms,
}: {
  columns: { stage: string; count: number; cards: import("@/lib/services/application-cases").ApplicationRow[] }[];
  perms: { view: boolean; edit: boolean };
}) {
  return (
    <div className="mt-4 overflow-x-auto pb-4">
      <div className="flex gap-3 min-w-max">
        {columns.map((col) => (
          <div key={col.stage} className="w-72 shrink-0">
            <div className="rounded-lg border border-border bg-muted/30">
              <div className="flex items-center justify-between border-b border-border p-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {titleCase(col.stage)}
                </h3>
                <Badge tone="default">{col.count}</Badge>
              </div>
              <div className="max-h-[calc(100dvh-280px)] space-y-2 overflow-y-auto p-2">
                {col.cards.length === 0 ? (
                  <p className="py-4 text-center text-xs text-muted-foreground">No applications</p>
                ) : (
                  col.cards.map((card) => (
                    <KanbanCard key={card.id} card={card} perms={perms} />
                  ))
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function KanbanCard({
  card,
}: {
  card: import("@/lib/services/application-cases").ApplicationRow;
  perms: { view: boolean; edit: boolean };
}) {
  const overdue = card.nextDeadline && card.nextDeadline < new Date();
  return (
    <Link
      href={`/employee/applications/${card.id}`}
      className="block rounded-md border border-border bg-card p-3 transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-ring"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-mono text-xs font-medium">{card.applicationNumber}</p>
        <Badge tone={PRIORITY_TONE[card.priority] ?? "default"}>{card.priority}</Badge>
      </div>
      <p className="mt-1 truncate text-sm font-medium">
        {card.student.firstName} {card.student.lastName}
      </p>
      <p className="mt-0.5 truncate text-xs text-muted-foreground">
        {card.country?.name ?? "—"}{card.university ? ` · ${card.university.name}` : ""}
      </p>
      {card.nextDeadline && (
        <p className={cn("mt-1.5 flex items-center gap-1 text-xs", overdue ? "font-medium text-destructive" : "text-muted-foreground")}>
          {overdue ? <AlertTriangle className="h-3 w-3" aria-hidden /> : <ArrowRight className="h-3 w-3" aria-hidden />}
          {formatDate(card.nextDeadline)}
        </p>
      )}
      {card.assignedEmployee && (
        <p className="mt-1 truncate text-xs text-muted-foreground">
          👤 {card.assignedEmployee.user.name}
        </p>
      )}
    </Link>
  );
}

function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  buildHref,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  buildHref: (p: number) => string;
}) {
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between">
      <p className="text-xs text-muted-foreground">Showing {from}–{to} of {total}</p>
      <div className="flex items-center gap-1">
        {page > 1 && <Link href={buildHref(page - 1)}><Button variant="outline" size="sm">Previous</Button></Link>}
        <span className="text-sm font-medium">Page {page} / {totalPages}</span>
        {page < totalPages && <Link href={buildHref(page + 1)}><Button variant="outline" size="sm">Next</Button></Link>}
      </div>
    </nav>
  );
}

/** Build URLSearchParams from a Record that may have undefined values. */
function toParams(sp: Record<string, string | undefined>): URLSearchParams {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (v) params.set(k, v);
  }
  return params;
}
