import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { EmployeePageHeader } from "@/components/employee/ui";
import { Card, CardContent, Badge, Button } from "@/components/ui";
import { formatDate, titleCase } from "@/lib/utils";
import { listVisaApplications, type VisaListFilters } from "@/lib/services/visa-cases";
import { DataTable, Th, Td } from "@/components/employee/data-table";

export const dynamic = "force-dynamic";

const STAGE_TONE: Record<string, "default" | "success" | "warning" | "destructive" | "info"> = {
  PREPARATION: "warning", SUBMITTED: "info", BIOMETRICS: "info", INTERVIEW: "info",
  PROCESSING: "info", APPROVED: "success", REFUSED: "destructive", WITHDRAWN: "default", COMPLETED: "success",
};

export default async function EmployeeVisaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/employee/visa");
  const role = (session.user as { role?: string }).role;
  if (role !== "EMPLOYEE" && role !== "ADMIN") redirect("/403");

  let employeeId: string | null = null;
  if (role === "EMPLOYEE") {
    const employee = await prisma.employee.findFirst({ where: { userId: session.user.id }, select: { id: true } });
    if (!employee) redirect("/403");
    employeeId = employee.id;
  }
  const scope = { isAdmin: role === "ADMIN", userId: session.user.id, employeeId };

  const sp = await searchParams;
  const filters: VisaListFilters = {
    search: sp.search, countryId: sp.countryId, stage: sp.stage,
    submittedFrom: sp.submittedFrom, submittedTo: sp.submittedTo,
    decision: sp.decision, assignedEmployeeId: sp.assignedEmployeeId,
  };
  const page = sp.page ? Number(sp.page) : 1;
  const pageSize = sp.pageSize ? Number(sp.pageSize) : 20;

  const countries = await prisma.country.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true }, orderBy: { name: "asc" } });

  let result;
  try {
    result = await listVisaApplications(scope, { filters, page, pageSize });
  } catch (err) {
    console.error("[employee/visa]", err);
    return (
      <div>
        <EmployeePageHeader title="Visa Management" description="Could not load — server error." />
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">An unexpected error occurred.</CardContent></Card>
      </div>
    );
  }

  return (
    <div>
      <EmployeePageHeader title="Visa Management" description={`${result.total} visa application${result.total === 1 ? "" : "s"}`} />

      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input type="search" name="search" defaultValue={sp.search} placeholder="Search…" className="h-9 min-w-[150px] flex-1 rounded-md border border-input bg-background px-3 text-sm" />
        <select name="stage" defaultValue={sp.stage ?? ""} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option value="">All stages</option>
          <option value="PREPARATION">Preparation</option>
          <option value="SUBMITTED">Submitted</option>
          <option value="BIOMETRICS">Biometrics</option>
          <option value="INTERVIEW">Interview</option>
          <option value="PROCESSING">Processing</option>
          <option value="APPROVED">Approved</option>
          <option value="REFUSED">Refused</option>
          <option value="WITHDRAWN">Withdrawn</option>
        </select>
        <select name="countryId" defaultValue={sp.countryId ?? ""} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option value="">All countries</option>
          {countries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select name="decision" defaultValue={sp.decision ?? ""} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option value="">All decisions</option>
          <option value="APPROVED">Approved</option>
          <option value="REFUSED">Refused</option>
          <option value="pending">Pending</option>
        </select>
      </div>

      <DataTable
        empty={result.rows.length === 0 ? "No visa applications match these filters." : undefined}
        headers={
          <tr>
            <Th>Student</Th>
            <Th className="hidden md:table-cell">Application</Th>
            <Th className="hidden lg:table-cell">Country</Th>
            <Th className="hidden lg:table-cell">Visa type</Th>
            <Th>Stage</Th>
            <Th className="hidden md:table-cell">Submitted</Th>
            <Th className="hidden xl:table-cell">Biometrics</Th>
            <Th className="hidden xl:table-cell">Interview</Th>
            <Th className="hidden lg:table-cell">Decision</Th>
            <Th className="hidden xl:table-cell">Assignee</Th>
            <Th className="hidden lg:table-cell">Next action</Th>
            <Th className="text-right"><span className="sr-only">Actions</span></Th>
          </tr>
        }
      >
        {result.rows.map((v) => (
          <tr key={v.id} className="hover:bg-muted/30">
            <Td>
              <Link href={`/employee/students/${v.student.id}`} className="font-medium hover:underline">{v.student.firstName} {v.student.lastName}</Link>
              <p className="text-xs text-muted-foreground">{v.student.studentId}</p>
            </Td>
            <Td className="hidden md:table-cell">
              <Link href={`/employee/applications/${v.application.id}`} className="text-primary hover:underline font-mono text-xs">{v.application.applicationNumber}</Link>
            </Td>
            <Td className="hidden lg:table-cell text-muted-foreground">{v.country?.flag} {v.country?.name ?? "—"}</Td>
            <Td className="hidden lg:table-cell text-muted-foreground">{v.visaType ?? "—"}</Td>
            <Td><Badge tone={STAGE_TONE[v.stage] ?? "default"}>{titleCase(v.stage)}</Badge></Td>
            <Td className="hidden md:table-cell text-muted-foreground">{v.submittedAt ? formatDate(v.submittedAt) : "—"}</Td>
            <Td className="hidden xl:table-cell text-muted-foreground">{v.biometricsAt ? formatDate(v.biometricsAt) : "—"}</Td>
            <Td className="hidden xl:table-cell text-muted-foreground">{v.interviewAt ? formatDate(v.interviewAt) : "—"}</Td>
            <Td className="hidden lg:table-cell text-muted-foreground">{v.decisionAt ? formatDate(v.decisionAt) : "—"}</Td>
            <Td className="hidden xl:table-cell text-muted-foreground">{v.assignedEmployee?.name ?? "—"}</Td>
            <Td className="hidden lg:table-cell text-muted-foreground">{v.nextAction ?? "—"}</Td>
            <Td>
              <Link href={`/employee/visa/${v.id}`} aria-label="View visa application">
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
            {page > 1 && <Link href={buildHref(sp, page - 1)}><Button variant="outline" size="sm">Previous</Button></Link>}
            <span className="text-sm font-medium">Page {page} / {result.totalPages}</span>
            {page < result.totalPages && <Link href={buildHref(sp, page + 1)}><Button variant="outline" size="sm">Next</Button></Link>}
          </div>
        </nav>
      )}
    </div>
  );
}

function buildHref(sp: Record<string, string | undefined>, p: number): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (v) params.set(k, v);
  params.set("page", String(p));
  return `/employee/visa?${params.toString()}`;
}
