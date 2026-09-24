import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Eye, FileText, CreditCard, MessageSquare, Plus, CheckSquare, FolderKanban,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { EmployeePageHeader } from "@/components/employee/ui";
import { Badge, Button, Card, CardContent } from "@/components/ui";
import { formatDate, titleCase, cn } from "@/lib/utils";
import { listStudents, type StudentSortKey, type StudentListFilters } from "@/lib/services/student-cases";
import { StudentsFilters } from "@/components/employee/students-filters";
import { DataTable, Th, Td } from "@/components/employee/data-table";

export const dynamic = "force-dynamic";

const ALL_COLUMNS = [
  "name", "applicationNumber", "phone", "email", "country", "university",
  "stage", "applicationStatus", "visaStatus", "nextDeadline", "assignedDate", "priority",
];

export default async function EmployeeStudentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/employee/students");
  const role = (session.user as { role?: string }).role;
  if (role !== "EMPLOYEE" && role !== "ADMIN") redirect("/403");

  const sp = await searchParams;

  // Resolve Employee row for case ownership.
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
    view: hasPermission(role, "students.read"),
    edit: hasPermission(role, "students.update"),
    createTask: hasPermission(role, "tasks.manage"),
    message: hasPermission(role, "messages.create"),
    viewApps: hasPermission(role, "applications.read"),
    viewDocs: hasPermission(role, "documents.read"),
    viewPayments: hasPermission(role, "payments.read"),
  };

  // Build filter params from the query string
  const filters: StudentListFilters = {
    search: sp.search,
    status: sp.status,
    stage: sp.stage,
    country: sp.country,
    universityId: sp.universityId,
    visaStage: sp.visaStage,
    priority: sp.priority,
    createdFrom: sp.createdFrom,
    createdTo: sp.createdTo,
    archived: sp.archived === "true",
  };

  const page = sp.page ? Number(sp.page) : 1;
  const pageSize = sp.pageSize ? Number(sp.pageSize) : 20;
  const sortBy = (sp.sortBy as StudentSortKey) ?? "createdAt";
  const sortOrder = (sp.sortOrder as "asc" | "desc") ?? "desc";

  const visibleColumns = sp.columns ? sp.columns.split(",").filter((c) => ALL_COLUMNS.includes(c)) : ALL_COLUMNS;
  const density = sp.density === "compact" ? "compact" : "comfortable";

  let result;
  try {
    result = await listStudents(scope, { filters, page, pageSize, sortBy, sortOrder });
  } catch (err) {
    console.error("[employee/students]", err);
    return (
      <div>
        <EmployeePageHeader title="My Students" description="Could not load student list — server error." />
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          An unexpected error occurred. Try refreshing the page.
        </CardContent></Card>
      </div>
    );
  }

  const activeSort = { key: sortBy, dir: sortOrder };
  const sortUrl = (key: string) => {
    const params = new URLSearchParams(sp as Record<string, string>);
    const dir = sortBy === key && sortOrder === "asc" ? "desc" : "asc";
    params.set("sortBy", key);
    params.set("sortOrder", dir);
    return `/employee/students?${params.toString()}`;
  };

  return (
    <div>
      <EmployeePageHeader
        title="My Students"
        description={
          scope.isAdmin
            ? `${result.total} students across the platform`
            : `${result.total} student${result.total === 1 ? "" : "s"} assigned to you`
        }
        actions={
          perms.edit && (
            <Link href="/employee/students?new=true">
              <Button size="sm"><Plus className="h-3.5 w-3.5" aria-hidden /> Add Student</Button>
            </Link>
          )
        }
      />

      <StudentsFilters
        initialSearch={sp.search}
        initialFilters={{
          stage: sp.stage,
          country: sp.country,
          visaStage: sp.visaStage,
          priority: sp.priority,
          status: sp.status,
          archived: sp.archived,
          createdFrom: sp.createdFrom,
          createdTo: sp.createdTo,
        }}
        initialColumns={visibleColumns}
        initialDensity={density}
      />

      <DataTable
        density={density}
        empty={result.rows.length === 0 ? "No students match these filters." : undefined}
        headers={
          <tr>
            {visibleColumns.includes("name") && (
              <Th sortKey="name" activeSort={activeSort} onSort={(k) => window.location.assign(sortUrl(k))}>Student</Th>
            )}
            {visibleColumns.includes("applicationNumber") && <Th>Application #</Th>}
            {visibleColumns.includes("phone") && <Th sortKey="phone" activeSort={activeSort} onSort={(k) => window.location.assign(sortUrl(k))}>Phone</Th>}
            {visibleColumns.includes("email") && <Th sortKey="email" activeSort={activeSort} onSort={(k) => window.location.assign(sortUrl(k))}>Email</Th>}
            {visibleColumns.includes("country") && <Th sortKey="country" activeSort={activeSort} onSort={(k) => window.location.assign(sortUrl(k))}>Country</Th>}
            {visibleColumns.includes("university") && <Th>University</Th>}
            {visibleColumns.includes("stage") && <Th>Stage</Th>}
            {visibleColumns.includes("applicationStatus") && <Th>App status</Th>}
            {visibleColumns.includes("visaStatus") && <Th>Visa</Th>}
            {visibleColumns.includes("nextDeadline") && <Th>Next deadline</Th>}
            {visibleColumns.includes("assignedDate") && <Th sortKey="createdAt" activeSort={activeSort} onSort={(k) => window.location.assign(sortUrl(k))}>Assigned</Th>}
            {visibleColumns.includes("priority") && <Th>Priority</Th>}
            <Th className="text-right"><span className="sr-only">Actions</span></Th>
          </tr>
        }
      >
        {result.rows.map((s) => {
          const app = s.primaryApplication;
          const overdue = s.nextDeadline && s.nextDeadline < new Date();
          return (
            <tr key={s.id} className={cn("hover:bg-muted/30", density === "compact" && "py-1")}>
              {visibleColumns.includes("name") && (
                <Td>
                  <Link href={`/employee/students/${s.id}`} className="font-medium hover:underline">
                    {s.firstName} {s.lastName}
                  </Link>
                  <p className="text-xs text-muted-foreground">{s.studentId}</p>
                </Td>
              )}
              {visibleColumns.includes("applicationNumber") && (
                <Td>{app ? <span className="font-mono text-xs">{app.applicationNumber}</span> : "—"}</Td>
              )}
              {visibleColumns.includes("phone") && <Td className="text-muted-foreground">{s.phone ?? "—"}</Td>}
              {visibleColumns.includes("email") && <Td className="text-muted-foreground">{s.email}</Td>}
              {visibleColumns.includes("country") && <Td className="text-muted-foreground">{s.country ?? "—"}</Td>}
              {visibleColumns.includes("university") && <Td className="text-muted-foreground">{app?.universityName ?? "—"}</Td>}
              {visibleColumns.includes("stage") && (
                <Td>{app ? <Badge tone="info">{titleCase(app.stageKey)}</Badge> : "—"}</Td>
              )}
              {visibleColumns.includes("applicationStatus") && (
                <Td>{app ? <Badge tone={app.status === "COMPLETED" ? "success" : "default"}>{titleCase(app.status)}</Badge> : "—"}</Td>
              )}
              {visibleColumns.includes("visaStatus") && (
                <Td>
                  {s.visaStage ? (
                    <Badge tone={
                      s.visaStage === "APPROVED" ? "success"
                        : s.visaStage === "REFUSED" ? "destructive"
                        : "info"
                    }>{titleCase(s.visaStage)}</Badge>
                  ) : "—"}
                </Td>
              )}
              {visibleColumns.includes("nextDeadline") && (
                <Td>
                  {s.nextDeadline ? (
                    <span className={cn(overdue ? "font-medium text-destructive" : "text-muted-foreground")}>
                      {formatDate(s.nextDeadline)}
                    </span>
                  ) : "—"}
                </Td>
              )}
              {visibleColumns.includes("assignedDate") && <Td className="text-muted-foreground">{formatDate(s.createdAt)}</Td>}
              {visibleColumns.includes("priority") && (
                <Td>
                  {s.priority ? (
                    <Badge tone={s.priority === "URGENT" || s.priority === "HIGH" ? "destructive" : s.priority === "MEDIUM" ? "warning" : "default"}>
                      {titleCase(s.priority)}
                    </Badge>
                  ) : "—"}
                </Td>
              )}
              <Td>
                <RowActions studentId={s.id} perms={perms} />
              </Td>
            </tr>
          );
        })}
      </DataTable>

      {/* Pagination */}
      {result.totalPages > 1 && (
        <Pagination
          page={result.page}
          totalPages={result.totalPages}
          total={result.total}
          pageSize={result.pageSize}
          buildHref={(p) => {
            const params = new URLSearchParams(sp as Record<string, string>);
            params.set("page", String(p));
            return `/employee/students?${params.toString()}`;
          }}
        />
      )}
    </div>
  );
}

function RowActions({
  studentId,
  perms,
}: {
  studentId: string;
  perms: {
    view: boolean;
    edit: boolean;
    createTask: boolean;
    message: boolean;
    viewApps: boolean;
    viewDocs: boolean;
    viewPayments: boolean;
  };
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      {perms.view && (
        <Link href={`/employee/students/${studentId}`} aria-label="View student">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Eye className="h-3.5 w-3.5" /></Button>
        </Link>
      )}
      {perms.viewApps && (
        <Link href={`/employee/applications?studentId=${studentId}`} aria-label="View applications">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><FolderKanban className="h-3.5 w-3.5" /></Button>
        </Link>
      )}
      {perms.viewDocs && (
        <Link href={`/employee/documents?studentId=${studentId}`} aria-label="View documents">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><FileText className="h-3.5 w-3.5" /></Button>
        </Link>
      )}
      {perms.viewPayments && (
        <Link href={`/employee/payments?studentId=${studentId}`} aria-label="View payments">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><CreditCard className="h-3.5 w-3.5" /></Button>
        </Link>
      )}
      {perms.message && (
        <Link href={`/employee/messages?studentId=${studentId}`} aria-label="Send message">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><MessageSquare className="h-3.5 w-3.5" /></Button>
        </Link>
      )}
      {perms.createTask && (
        <Link href={`/employee/tasks?studentId=${studentId}&new=true`} aria-label="Create task">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><CheckSquare className="h-3.5 w-3.5" /></Button>
        </Link>
      )}
    </div>
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
      <p className="text-xs text-muted-foreground">
        Showing {from}–{to} of {total}
      </p>
      <div className="flex items-center gap-1">
        {page > 1 && (
          <Link href={buildHref(page - 1)}>
            <Button variant="outline" size="sm">Previous</Button>
          </Link>
        )}
        <span className="text-sm font-medium">
          Page {page} / {totalPages}
        </span>
        {page < totalPages && (
          <Link href={buildHref(page + 1)}>
            <Button variant="outline" size="sm">Next</Button>
          </Link>
        )}
      </div>
    </nav>
  );
}
