import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { EmployeePageHeader } from "@/components/employee/ui";
import { Card, CardContent, Button } from "@/components/ui";
import { listDocuments, type DocumentListFilters } from "@/lib/services/document-cases";
import { DocumentFilters } from "@/components/employee/documents-filters";
import { DocumentRowItem } from "@/components/employee/document-row-item";
import { DataTable, Th } from "@/components/employee/data-table";

export const dynamic = "force-dynamic";

export default async function EmployeeDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/employee/documents");
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
    view: hasPermission(role, "documents.read"),
    review: hasPermission(role, "documents.review"),
  };

  const sp = await searchParams;
  const filters: DocumentListFilters = {
    search: sp.search, status: sp.status, documentType: sp.documentType,
    studentId: sp.studentId, applicationId: sp.applicationId,
    expiryFrom: sp.expiryFrom, expiryTo: sp.expiryTo,
    uploadedFrom: sp.uploadedFrom, uploadedTo: sp.uploadedTo,
  };
  const page = sp.page ? Number(sp.page) : 1;
  const pageSize = sp.pageSize ? Number(sp.pageSize) : 20;

  let result;
  try {
    result = await listDocuments(scope, { filters, page, pageSize });
  } catch (err) {
    console.error("[employee/documents]", err);
    return (
      <div>
        <EmployeePageHeader title="Documents" description="Could not load — server error." />
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          An unexpected error occurred. Try refreshing the page.
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div>
      <EmployeePageHeader
        title="Documents"
        description={
          scope.isAdmin
            ? `${result.total} documents across the platform`
            : `${result.total} document${result.total === 1 ? "" : "s"} for your assigned students`
        }
      />

      <DocumentFilters
        initialSearch={sp.search}
        initialFilters={{
          status: sp.status, documentType: sp.documentType,
          studentId: sp.studentId, applicationId: sp.applicationId,
          expiryFrom: sp.expiryFrom, expiryTo: sp.expiryTo,
          uploadedFrom: sp.uploadedFrom, uploadedTo: sp.uploadedTo,
        }}
      />

      <div className="mt-4">
        <DataTable
          empty={result.rows.length === 0 ? "No documents match these filters." : undefined}
          headers={
            <tr>
              <Th>Document</Th>
              <Th className="hidden md:table-cell">Student</Th>
              <Th className="hidden lg:table-cell">Application</Th>
              <Th className="hidden xl:table-cell">Type</Th>
              <Th>Status</Th>
              <Th className="hidden md:table-cell">Uploaded</Th>
              <Th className="hidden lg:table-cell">Expiry</Th>
              <Th className="hidden xl:table-cell">Reviewer</Th>
              <Th className="hidden lg:table-cell">Updated</Th>
              <Th className="text-right"><span className="sr-only">Actions</span></Th>
            </tr>
          }
        >
          {result.rows.map((doc) => (
            <DocumentRowItem key={doc.id} doc={doc} canReview={perms.review} />
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
            return `/employee/documents?${params.toString()}`;
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
