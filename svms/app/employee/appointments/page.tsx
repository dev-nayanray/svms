import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, ArrowRight, CalendarClock, MapPin } from "lucide-react";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { EmployeePageHeader } from "@/components/employee/ui";
import { Card, CardContent, Badge, Button } from "@/components/ui";
import { formatDate, titleCase, cn } from "@/lib/utils";
import { listAppointments, type AppointmentView, APPOINTMENT_VIEWS, TYPE_LABELS } from "@/lib/services/appointment-cases";
import { DataTable, Th, Td } from "@/components/employee/data-table";

export const dynamic = "force-dynamic";

const VIEW_LABELS: Record<AppointmentView, string> = {
  upcoming: "Upcoming", today: "Today", past: "Past", cancelled: "Cancelled", all: "All",
};

const STATUS_TONE: Record<string, "default" | "success" | "warning" | "destructive" | "info"> = {
  SCHEDULED: "info", COMPLETED: "success", CANCELLED: "destructive", RESCHEDULED: "warning",
};

export default async function EmployeeAppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/employee/appointments");
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
  const view = (APPOINTMENT_VIEWS.includes(sp.view as AppointmentView) ? sp.view : "upcoming") as AppointmentView;
  const page = sp.page ? Number(sp.page) : 1;
  const pageSize = sp.pageSize ? Number(sp.pageSize) : 20;

  let result;
  try {
    result = await listAppointments(scope, {
      view, page, pageSize,
      filters: {
        search: sp.search, type: sp.type, status: sp.status,
        studentId: sp.studentId, dateFrom: sp.dateFrom, dateTo: sp.dateTo,
      },
    });
  } catch (err) {
    console.error("[employee/appointments]", err);
    return (
      <div>
        <EmployeePageHeader title="Appointments" description="Could not load — server error." />
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">An unexpected error occurred.</CardContent></Card>
      </div>
    );
  }

  const buildViewHref = (v: AppointmentView) => {
    const params = new URLSearchParams();
    for (const [k, val] of Object.entries(sp)) if (val && k !== "view" && k !== "page") params.set(k, val);
    params.set("view", v);
    return `/employee/appointments?${params.toString()}`;
  };

  return (
    <div>
      <EmployeePageHeader
        title="Appointments"
        description={`${result.total} appointment${result.total === 1 ? "" : "s"}`}
        actions={canManage && (
          <Link href="/employee/appointments?new=true"><Button size="sm"><Plus className="h-3.5 w-3.5" aria-hidden /> New Appointment</Button></Link>
        )}
      />

      {/* View tabs with counts */}
      <div className="mb-4 flex flex-wrap gap-1">
        {APPOINTMENT_VIEWS.map((v) => (
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
        <input type="search" name="search" defaultValue={sp.search} placeholder="Search appointments…" className="h-9 min-w-[150px] flex-1 rounded-md border border-input bg-background px-3 text-sm" aria-label="Search appointments" />
        <select name="type" defaultValue={sp.type ?? ""} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option value="">All types</option>
          {Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>

      <DataTable
        empty={result.rows.length === 0 ? "No appointments match these filters." : undefined}
        headers={
          <tr>
            <Th>Student</Th>
            <Th className="hidden md:table-cell">Type</Th>
            <Th>Date &amp; time</Th>
            <Th className="hidden lg:table-cell">Location</Th>
            <Th>Status</Th>
            <Th className="hidden xl:table-cell">Employee</Th>
            <Th className="hidden lg:table-cell">Notes</Th>
            <Th className="text-right"><span className="sr-only">Actions</span></Th>
          </tr>
        }
      >
        {result.rows.map((a) => {
          const isToday = a.scheduledAt.toDateString() === new Date().toDateString();
          const isPast = a.scheduledAt < new Date() && a.status === "SCHEDULED";
          return (
            <tr key={a.id} className="hover:bg-muted/30">
              <Td>
                <Link href={`/employee/students/${a.student.id}`} className="font-medium hover:underline">{a.student.firstName} {a.student.lastName}</Link>
                <p className="text-xs text-muted-foreground">{a.student.studentId}</p>
              </Td>
              <Td className="hidden md:table-cell">
                <Badge tone="default">{TYPE_LABELS[a.type] ?? titleCase(a.type)}</Badge>
              </Td>
              <Td>
                <div className="flex items-center gap-1.5">
                  <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                  <span className={cn("text-xs", isPast && "font-medium text-destructive")}>
                    {formatDate(a.scheduledAt)} · {a.scheduledAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  {isToday && <Badge tone="info">Today</Badge>}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{a.durationMinutes} min</p>
              </Td>
              <Td className="hidden lg:table-cell">
                {a.location ? <span className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{a.location}</span> : "—"}
              </Td>
              <Td><Badge tone={STATUS_TONE[a.status] ?? "default"}>{titleCase(a.status)}</Badge></Td>
              <Td className="hidden xl:table-cell text-muted-foreground">{a.employee?.name ?? "—"}</Td>
              <Td className="hidden lg:table-cell text-muted-foreground">{a.notes ? <span className="line-clamp-1 text-xs">{a.notes}</span> : "—"}</Td>
              <Td>
                <Link href={`/employee/appointments?view=${view}&appt=${a.id}`} aria-label="View appointment">
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><ArrowRight className="h-3.5 w-3.5" /></Button>
                </Link>
              </Td>
            </tr>
          );
        })}
      </DataTable>

      {result.totalPages > 1 && (
        <nav aria-label="Pagination" className="mt-4 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Showing {(page - 1) * pageSize + 1}–{Math.min(result.total, page * pageSize)} of {result.total}</p>
          <div className="flex items-center gap-1">
            {page > 1 && (() => {
              const params = new URLSearchParams();
              for (const [k, v] of Object.entries(sp)) if (v) params.set(k, v);
              params.set("page", String(page - 1));
              return <Link href={`/employee/appointments?${params.toString()}`}><Button variant="outline" size="sm">Previous</Button></Link>;
            })()}
            <span className="text-sm font-medium">Page {page} / {result.totalPages}</span>
            {page < result.totalPages && (() => {
              const params = new URLSearchParams();
              for (const [k, v] of Object.entries(sp)) if (v) params.set(k, v);
              params.set("page", String(page + 1));
              return <Link href={`/employee/appointments?${params.toString()}`}><Button variant="outline" size="sm">Next</Button></Link>;
            })()}
          </div>
        </nav>
      )}
    </div>
  );
}
