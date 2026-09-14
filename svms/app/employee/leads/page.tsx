import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, ArrowRight } from "lucide-react";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { EmployeePageHeader } from "@/components/employee/ui";
import { Card, CardContent, Badge, Button } from "@/components/ui";
import { formatDate, titleCase, cn } from "@/lib/utils";
import { listLeads, type LeadListFilters, LEAD_STATUSES, LEAD_SOURCES } from "@/lib/services/lead-cases";
import { DataTable, Th, Td } from "@/components/employee/data-table";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, "default" | "success" | "warning" | "destructive" | "info"> = {
  NEW: "info", CONTACTED: "info", COUNSELING: "warning", QUALIFIED: "warning", CONVERTED: "success", LOST: "destructive",
};

export default async function EmployeeLeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/employee/leads");
  const role = (session.user as { role?: string }).role;
  if (role !== "EMPLOYEE" && role !== "ADMIN") redirect("/403");

  let employeeId: string | null = null;
  if (role === "EMPLOYEE") {
    const employee = await prisma.employee.findFirst({ where: { userId: session.user.id }, select: { id: true } });
    if (!employee) redirect("/403");
    employeeId = employee.id;
  }
  const scope = { isAdmin: role === "ADMIN", userId: session.user.id, employeeId };
  const canManage = hasPermission(role, "leads.manage");

  const sp = await searchParams;
  const filters: LeadListFilters = {
    search: sp.search, status: sp.status, source: sp.source, employeeId: sp.employeeId,
  };
  const page = sp.page ? Number(sp.page) : 1;
  const pageSize = sp.pageSize ? Number(sp.pageSize) : 20;

  let result;
  try {
    result = await listLeads(scope, { filters, page, pageSize });
  } catch (err) {
    console.error("[employee/leads]", err);
    return (
      <div>
        <EmployeePageHeader title="My Leads" description="Could not load — server error." />
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">An unexpected error occurred.</CardContent></Card>
      </div>
    );
  }

  return (
    <div>
      <EmployeePageHeader
        title="My Leads"
        description={`${result.total} lead${result.total === 1 ? "" : "s"}`}
        actions={canManage && (
          <Link href="/employee/leads?new=true"><Button size="sm"><Plus className="h-3.5 w-3.5" aria-hidden /> New Lead</Button></Link>
        )}
      />

      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input type="search" name="search" defaultValue={sp.search} placeholder="Search by name, email, phone…" className="h-9 min-w-[150px] flex-1 rounded-md border border-input bg-background px-3 text-sm" aria-label="Search leads" />
        <select name="status" defaultValue={sp.status ?? ""} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option value="">All statuses</option>
          {LEAD_STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
        </select>
        <select name="source" defaultValue={sp.source ?? ""} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option value="">All sources</option>
          {LEAD_SOURCES.map((s) => <option key={s} value={s}>{titleCase(s.replace(/_/g, " "))}</option>)}
        </select>
      </div>

      <DataTable
        empty={result.rows.length === 0 ? "No leads match these filters." : undefined}
        headers={
          <tr>
            <Th>Name</Th>
            <Th className="hidden md:table-cell">Phone</Th>
            <Th className="hidden lg:table-cell">Email</Th>
            <Th className="hidden md:table-cell">Source</Th>
            <Th className="hidden lg:table-cell">Interested in</Th>
            <Th className="hidden xl:table-cell">Preferred course</Th>
            <Th>Status</Th>
            <Th className="hidden lg:table-cell">Assignee</Th>
            <Th className="hidden md:table-cell">Follow-up</Th>
            <Th className="hidden lg:table-cell">Created</Th>
            <Th className="text-right"><span className="sr-only">Actions</span></Th>
          </tr>
        }
      >
        {result.rows.map((l) => {
          const followUpOverdue = l.nextFollowUp && l.nextFollowUp < new Date();
          return (
            <tr key={l.id} className="hover:bg-muted/30">
              <Td>
                <Link href={`/employee/leads/${l.id}`} className="font-medium hover:underline">{l.name}</Link>
              </Td>
              <Td className="hidden md:table-cell text-muted-foreground">{l.phone ?? "—"}</Td>
              <Td className="hidden lg:table-cell text-muted-foreground">{l.email ?? "—"}</Td>
              <Td className="hidden md:table-cell text-muted-foreground">{l.source ? titleCase(l.source.replace(/_/g, " ")) : "—"}</Td>
              <Td className="hidden lg:table-cell text-muted-foreground">{l.interestedCountry ?? "—"}</Td>
              <Td className="hidden xl:table-cell text-muted-foreground">{l.preferredCourse ?? "—"}</Td>
              <Td><Badge tone={STATUS_TONE[l.status] ?? "default"}>{titleCase(l.status)}</Badge></Td>
              <Td className="hidden lg:table-cell text-muted-foreground">{l.assignedEmployee?.name ?? "—"}</Td>
              <Td className="hidden md:table-cell">
                {l.nextFollowUp ? (
                  <span className={cn("text-xs", followUpOverdue ? "font-medium text-destructive" : "text-muted-foreground")}>
                    {formatDate(l.nextFollowUp)}
                  </span>
                ) : "—"}
              </Td>
              <Td className="hidden lg:table-cell text-muted-foreground">{formatDate(l.createdAt)}</Td>
              <Td>
                <Link href={`/employee/leads/${l.id}`} aria-label="View lead">
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
              return <Link href={`/employee/leads?${params.toString()}`}><Button variant="outline" size="sm">Previous</Button></Link>;
            })()}
            <span className="text-sm font-medium">Page {page} / {result.totalPages}</span>
            {page < result.totalPages && (() => {
              const params = new URLSearchParams();
              for (const [k, v] of Object.entries(sp)) if (v) params.set(k, v);
              params.set("page", String(page + 1));
              return <Link href={`/employee/leads?${params.toString()}`}><Button variant="outline" size="sm">Next</Button></Link>;
            })()}
          </div>
        </nav>
      )}
    </div>
  );
}
