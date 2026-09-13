import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { EmployeePageHeader } from "@/components/employee/ui";
import { Card, CardContent, Badge, Button } from "@/components/ui";
import { formatMoney, formatDate, titleCase, cn } from "@/lib/utils";
import {
  listCourses,
  type CourseListFilters,
  type CourseSortKey,
} from "@/lib/services/course-cases";
import { DataTable, Th, Td } from "@/components/employee/data-table";

export const dynamic = "force-dynamic";

export default async function EmployeeCoursesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/employee/courses");
  const role = (session.user as { role?: string }).role;
  if (role !== "EMPLOYEE" && role !== "ADMIN") redirect("/403");

  const sp = await searchParams;
  const filters: CourseListFilters = {
    search: sp.search,
    countryId: sp.countryId,
    universityId: sp.universityId,
    degreeLevel: sp.degreeLevel,
    tuitionMin: sp.tuitionMin ? Number(sp.tuitionMin) : undefined,
    tuitionMax: sp.tuitionMax ? Number(sp.tuitionMax) : undefined,
    intakeId: sp.intakeId,
    englishTest: (sp.englishTest as CourseListFilters["englishTest"]) ?? undefined,
    deadlineFrom: sp.deadlineFrom,
    deadlineTo: sp.deadlineTo,
  };
  const page = sp.page ? Number(sp.page) : 1;
  const pageSize = sp.pageSize ? Number(sp.pageSize) : 20;
  const sortBy = (sp.sortBy as CourseSortKey) ?? "name";
  const sortOrder = (sp.sortOrder as "asc" | "desc") ?? "asc";

  // Fetch dropdown options
  const [countries, universities] = await Promise.all([
    prisma.country.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.university.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  let result;
  try {
    result = await listCourses({ filters, page, pageSize, sortBy, sortOrder });
  } catch (err) {
    console.error("[employee/courses]", err);
    return (
      <div>
        <EmployeePageHeader title="Courses" description="Could not load — server error." />
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          An unexpected error occurred.
        </CardContent></Card>
      </div>
    );
  }

  const activeSort = { key: sortBy, dir: sortOrder };
  const sortUrl = (key: string) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (v) params.set(k, v);
    const dir = sortBy === key && sortOrder === "asc" ? "desc" : "asc";
    params.set("sortBy", key);
    params.set("sortOrder", dir);
    return `/employee/courses?${params.toString()}`;
  };

  return (
    <div>
      <EmployeePageHeader title="Courses" description={`${result.total} course${result.total === 1 ? "" : "s"} in the catalog`} />

      {/* Filters bar */}
      <FilterBar sp={sp} countries={countries} universities={universities} />

      <DataTable
        empty={result.rows.length === 0 ? "No courses match these filters." : undefined}
        headers={
          <tr>
            <Th sortKey="name" activeSort={activeSort} onSort={(k) => sortUrl(k)}>Course</Th>
            <Th className="hidden md:table-cell">University</Th>
            <Th className="hidden lg:table-cell">Country</Th>
            <Th sortKey="degreeLevel" activeSort={activeSort} onSort={(k) => sortUrl(k)} className="hidden md:table-cell">Degree</Th>
            <Th className="hidden lg:table-cell">Duration</Th>
            <Th sortKey="tuitionFee" activeSort={activeSort} onSort={(k) => sortUrl(k)} className="hidden lg:table-cell">Tuition</Th>
            <Th className="hidden xl:table-cell">App fee</Th>
            <Th className="hidden xl:table-cell">IELTS</Th>
            <Th className="hidden xl:table-cell">Intakes</Th>
            <Th className="hidden lg:table-cell">Next deadline</Th>
            <Th className="text-right"><span className="sr-only">Actions</span></Th>
          </tr>
        }
      >
        {result.rows.map((c) => {
          const overdue = c.nextDeadline && c.nextDeadline < new Date();
          return (
            <tr key={c.id} className="hover:bg-muted/30">
              <Td>
                <Link href={`/employee/courses/${c.id}`} className="font-medium hover:underline">{c.name}</Link>
              </Td>
              <Td className="hidden md:table-cell text-muted-foreground">{c.university.name}</Td>
              <Td className="hidden lg:table-cell text-muted-foreground">{c.country?.flag} {c.country?.name ?? "—"}</Td>
              <Td className="hidden md:table-cell"><Badge tone="info">{titleCase(c.degreeLevel)}</Badge></Td>
              <Td className="hidden lg:table-cell text-muted-foreground">{c.duration ?? "—"}</Td>
              <Td className="hidden lg:table-cell">{c.tuitionFee != null ? formatMoney(c.tuitionFee, c.currency) : "—"}</Td>
              <Td className="hidden xl:table-cell text-muted-foreground">{c.applicationFee != null ? formatMoney(c.applicationFee, c.currency) : "—"}</Td>
              <Td className="hidden xl:table-cell text-muted-foreground">{c.ieltsRequirement ?? "—"}</Td>
              <Td className="hidden xl:table-cell">{c.activeIntakeCount > 0 ? <Badge tone="success">{c.activeIntakeCount}</Badge> : <span className="text-muted-foreground">—</span>}</Td>
              <Td className="hidden lg:table-cell">
                {c.nextDeadline ? <span className={cn(overdue ? "font-medium text-destructive" : "text-muted-foreground")}>{formatDate(c.nextDeadline)}</span> : "—"}
              </Td>
              <Td>
                <Link href={`/employee/courses/${c.id}`} aria-label="View course">
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><ArrowRight className="h-3.5 w-3.5" /></Button>
                </Link>
              </Td>
            </tr>
          );
        })}
      </DataTable>

      {result.totalPages > 1 && <Pagination page={result.page} totalPages={result.totalPages} total={result.total} pageSize={result.pageSize} sp={sp} />}
    </div>
  );
}

function FilterBar({ sp, countries, universities }: { sp: Record<string, string | undefined>; countries: { id: string; name: string }[]; universities: { id: string; name: string }[] }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <form action={`/employee/courses`} method="GET" className="flex min-w-[200px] flex-1 items-center gap-2">
        <input type="search" name="search" defaultValue={sp.search} placeholder="Search courses…" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring" aria-label="Search courses" />
      </form>
      <select name="countryId" defaultValue={sp.countryId ?? ""} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
        <option value="">All countries</option>
        {countries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <select name="universityId" defaultValue={sp.universityId ?? ""} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
        <option value="">All universities</option>
        {universities.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
      </select>
      <select name="degreeLevel" defaultValue={sp.degreeLevel ?? ""} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
        <option value="">All degrees</option>
        <option value="DIPLOMA">Diploma</option>
        <option value="BACHELOR">Bachelor</option>
        <option value="MASTER">Master</option>
        <option value="PHD">PhD</option>
        <option value="OTHER">Other</option>
      </select>
      <select name="englishTest" defaultValue={sp.englishTest ?? ""} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
        <option value="">English: any</option>
        <option value="ielts">Has IELTS</option>
        <option value="toefl">Has TOEFL</option>
        <option value="pte">Has PTE</option>
        <option value="any">Has any requirement</option>
      </select>
      <button type="submit" formAction="" onClick={(e) => { e.preventDefault(); const f = e.currentTarget.closest("form"); if (f) f.submit(); }} className="hidden">Apply</button>
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
    return `/employee/courses?${params.toString()}`;
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
