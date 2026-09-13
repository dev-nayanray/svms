import { redirect } from "next/navigation";
import Link from "next/link";
import { ExternalLink, ArrowRight } from "lucide-react";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { EmployeePageHeader } from "@/components/employee/ui";
import { Card, CardContent, Badge, Button } from "@/components/ui";
import { titleCase } from "@/lib/utils";
import { listUniversities, type UniversityListFilters } from "@/lib/services/university-cases";
import { UniversityFilters } from "@/components/employee/university-filters";
import { DataTable, Th, Td } from "@/components/employee/data-table";

export const dynamic = "force-dynamic";

export default async function EmployeeUniversitiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/employee/universities");
  const role = (session.user as { role?: string }).role;
  if (role !== "EMPLOYEE" && role !== "ADMIN") redirect("/403");

  const sp = await searchParams;
  const filters: UniversityListFilters = {
    search: sp.search,
    countryId: sp.countryId,
    status: sp.status,
    rankingMax: sp.rankingMax ? Number(sp.rankingMax) : undefined,
    intakeAvailable: sp.intakeAvailable === "true",
  };
  const page = sp.page ? Number(sp.page) : 1;
  const pageSize = sp.pageSize ? Number(sp.pageSize) : 20;

  // Fetch countries for the filter dropdown
  const countries = await prisma.country.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  let result;
  try {
    result = await listUniversities({ filters, page, pageSize });
  } catch (err) {
    console.error("[employee/universities]", err);
    return (
      <div>
        <EmployeePageHeader title="Universities" description="Could not load — server error." />
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          An unexpected error occurred. Try refreshing the page.
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div>
      <EmployeePageHeader
        title="Universities"
        description={`${result.total} European universit${result.total === 1 ? "y" : "ies"} in the catalog`}
      />

      <UniversityFilters
        initialSearch={sp.search}
        initialFilters={{
          countryId: sp.countryId, status: sp.status,
          rankingMax: sp.rankingMax, intakeAvailable: sp.intakeAvailable,
        }}
        countries={countries}
      />

      <div className="mt-4">
        <DataTable
          empty={result.rows.length === 0 ? "No universities match these filters." : undefined}
          headers={
            <tr>
              <Th>University</Th>
              <Th className="hidden md:table-cell">Country</Th>
              <Th className="hidden lg:table-cell">Ranking</Th>
              <Th className="hidden lg:table-cell">Website</Th>
              <Th className="hidden xl:table-cell">Courses</Th>
              <Th className="hidden xl:table-cell">Active intakes</Th>
              <Th>Status</Th>
              <Th className="text-right"><span className="sr-only">Actions</span></Th>
            </tr>
          }
        >
          {result.rows.map((u) => (
            <tr key={u.id} className="hover:bg-muted/30">
              <Td>
                <Link href={`/employee/universities/${u.id}`} className="font-medium hover:underline">
                  {u.name}
                </Link>
                {u.city && <p className="text-xs text-muted-foreground">{u.city}</p>}
              </Td>
              <Td className="hidden md:table-cell text-muted-foreground">
                {u.country?.flag} {u.country?.name ?? "—"}
              </Td>
              <Td className="hidden lg:table-cell">
                {u.ranking ? <Badge tone="info">#{u.ranking}</Badge> : "—"}
              </Td>
              <Td className="hidden lg:table-cell">
                {u.website ? (
                  <a href={u.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                    <ExternalLink className="h-3 w-3" aria-hidden /> Visit
                  </a>
                ) : "—"}
              </Td>
              <Td className="hidden xl:table-cell text-muted-foreground">{u.courseCount}</Td>
              <Td className="hidden xl:table-cell">
                {u.activeIntakeCount > 0 ? <Badge tone="success">{u.activeIntakeCount}</Badge> : <span className="text-muted-foreground">—</span>}
              </Td>
              <Td><Badge tone={u.status === "ACTIVE" ? "success" : "default"}>{titleCase(u.status)}</Badge></Td>
              <Td>
                <Link href={`/employee/universities/${u.id}`} aria-label="View university">
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </Td>
            </tr>
          ))}
        </DataTable>
      </div>

      {result.totalPages > 1 && (
        <Pagination
          page={result.page}
          totalPages={result.totalPages}
          total={result.total}
          pageSize={result.pageSize}
          buildHref={(p) => {
            const params = new URLSearchParams();
            for (const [k, v] of Object.entries(sp)) if (v) params.set(k, v);
            params.set("page", String(p));
            return `/employee/universities?${params.toString()}`;
          }}
        />
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
      <p className="text-xs text-muted-foreground">Showing {from}–{to} of {total}</p>
      <div className="flex items-center gap-1">
        {page > 1 && <Link href={buildHref(page - 1)}><Button variant="outline" size="sm">Previous</Button></Link>}
        <span className="text-sm font-medium">Page {page} / {totalPages}</span>
        {page < totalPages && <Link href={buildHref(page + 1)}><Button variant="outline" size="sm">Next</Button></Link>}
      </div>
    </nav>
  );
}
