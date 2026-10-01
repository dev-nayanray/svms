import { redirect } from "next/navigation";
import Link from "next/link";
import { CalendarClock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { auth } from "@/lib/auth";
import { EmployeePageHeader } from "@/components/employee/ui";
import { Card, CardContent, Badge, Button } from "@/components/ui";
import { formatDate, cn } from "@/lib/utils";
import { listIntakes } from "@/lib/services/course-cases";
import { DataTable, Th, Td } from "@/components/employee/data-table";

export const dynamic = "force-dynamic";

export default async function EmployeeIntakesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/employee/intakes");
  const role = (session.user as { role?: string }).role;
  if (role !== "EMPLOYEE" && role !== "ADMIN") redirect("/403");

  const sp = await searchParams;
  const page = sp.page ? Number(sp.page) : 1;
  const pageSize = sp.pageSize ? Number(sp.pageSize) : 20;
  const upcomingOnly = sp.upcomingOnly === "true";

  let result;
  try {
    result = await listIntakes({ page, pageSize, upcomingOnly });
  } catch (err) {
    console.error("[employee/intakes]", err);
    return (
      <div>
        <EmployeePageHeader title="Intakes" description="Could not load — server error." />
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          An unexpected error occurred.
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div>
      <EmployeePageHeader
        title="Intakes"
        description={`${result.total} active intake${result.total === 1 ? "" : "s"}`}
        actions={
          <Link href={upcomingOnly ? "/employee/intakes" : "/employee/intakes?upcomingOnly=true"}>
            <Button variant="outline" size="sm">{upcomingOnly ? "Show all" : "Upcoming only"}</Button>
          </Link>
        }
      />

      <DataTable
        empty={result.rows.length === 0 ? "No active intakes." : undefined}
        headers={
          <tr>
            <Th>Intake</Th>
            <Th className="hidden md:table-cell">Course</Th>
            <Th className="hidden lg:table-cell">University</Th>
            <Th className="hidden xl:table-cell">Country</Th>
            <Th className="hidden md:table-cell">Start</Th>
            <Th>Deadline</Th>
            <Th>Status</Th>
          </tr>
        }
      >
        {result.rows.map((i) => (
          <tr key={i.id} className="hover:bg-muted/30">
            <Td>
              <p className="font-medium">{i.name}</p>
              {i.course && <Link href={`/employee/courses/${i.course.id}`} className="text-xs text-primary hover:underline">{i.course.name}</Link>}
            </Td>
            <Td className="hidden md:table-cell text-muted-foreground">{i.course.name}</Td>
            <Td className="hidden lg:table-cell text-muted-foreground">{i.university.name}</Td>
            <Td className="hidden xl:table-cell text-muted-foreground">{i.country?.flag} {i.country?.name ?? "—"}</Td>
            <Td className="hidden md:table-cell text-muted-foreground">{i.month}/{i.year}</Td>
            <Td>
              {i.deadline ? (
                <span className={cn(
                  "text-xs",
                  i.deadlineStatus === "expired" && "font-medium text-destructive",
                  i.deadlineStatus === "closing_soon" && "font-medium text-warning",
                )}>
                  {formatDate(i.deadline)}
                </span>
              ) : <span className="text-xs text-muted-foreground">No deadline</span>}
            </Td>
            <Td>
              {i.deadlineStatus === "expired" && <Badge tone="destructive"><AlertTriangle className="h-3 w-3" aria-hidden /> Expired</Badge>}
              {i.deadlineStatus === "closing_soon" && <Badge tone="warning"><CalendarClock className="h-3 w-3" aria-hidden /> Closing soon</Badge>}
              {i.deadlineStatus === "upcoming" && <Badge tone="success"><CheckCircle2 className="h-3 w-3" aria-hidden /> Upcoming</Badge>}
              {i.deadlineStatus === "no_deadline" && <Badge tone="default">Open</Badge>}
            </Td>
          </tr>
        ))}
      </DataTable>

      {result.totalPages > 1 && <Pagination page={result.page} totalPages={result.totalPages} total={result.total} pageSize={result.pageSize} sp={sp} />}
    </div>
  );
}

function Pagination({ page, totalPages, total, pageSize, sp }: { page: number; totalPages: number; total: number; pageSize: number; sp: Record<string, string | undefined> }) {
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const buildHref = (p: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (v) params.set(k, v);
    params.set("page", String(p));
    return `/employee/intakes?${params.toString()}`;
  };
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
