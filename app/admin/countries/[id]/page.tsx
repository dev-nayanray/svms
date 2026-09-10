import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/shared/page-kit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { StatusBadge, TableShell, EmptyState } from "@/components/shared";
import { Tabs, TabsContent } from "@/components/ui/overlays";
import { formatDate } from "@/lib/utils";
import { resolveCountryFlag, countrySlug } from "@/lib/constants/countries";
import { CountryVisaRequirements } from "@/components/admin/country-visa-requirements";
import { CountryDocumentRequirements } from "@/components/admin/country-document-requirements";
import { Globe, ExternalLink } from "lucide-react";
import type { Country, University, VisaRequirement, Application, AuditLog } from "@prisma/client";

export const dynamic = "force-dynamic";

type CountryDetail = Country & {
  universities: (University & {
    _count: { courses: number; applications: number };
  })[];
  visaRequirements: VisaRequirement[];
  documentRequirements: {
    id: string;
    name: string;
    code: string;
    description: string | null;
    required: boolean;
    appliesTo: string;
    status: string;
    country: { id: string; name: string } | null;
  }[];
  applications: (Application & {
    student: { id: string; firstName: string; lastName: string; studentId: string };
    university: { id: string; name: string } | null;
    course: { id: string; name: string } | null;
  })[];
  _count: {
    universities: number;
    applications: number;
    visaRequirements: number;
    documentRequirements: number;
  };
};

export default async function CountryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const country = (await prisma.country.findFirst({
    where: { id },
    include: {
      universities: {
        where: { deletedAt: null },
        orderBy: { name: "asc" },
        include: {
          _count: {
            select: {
              courses: { where: { deletedAt: null } },
              applications: { where: { deletedAt: null } },
            },
          },
        },
      },
      visaRequirements: {
        where: { status: "ACTIVE" },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      },
      documentRequirements: {
        where: { status: "ACTIVE" },
        orderBy: [{ appliesTo: "asc" }, { name: "asc" }],
        include: { country: true },
      },
      applications: {
        where: { deletedAt: null, status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        take: 25,
        include: {
          student: { select: { id: true, firstName: true, lastName: true, studentId: true } },
          university: { select: { id: true, name: true } },
          course: { select: { id: true, name: true } },
        },
      },
      _count: {
        select: {
          universities: { where: { deletedAt: null } },
          applications: { where: { deletedAt: null, status: "ACTIVE" } },
          visaRequirements: { where: { status: "ACTIVE" } },
          documentRequirements: { where: { status: "ACTIVE" } },
        },
      },
    },
  })) as CountryDetail | null;

  if (!country) notFound();

  // Pull every course under every university of this country in one query —
  // cheaper than N+1 inside the JSX. Cheap because course counts per country
  // are typically in the low hundreds at most.
  const courses = await prisma.course.findMany({
    where: {
      deletedAt: null,
      university: { countryId: id, deletedAt: null },
    },
    include: {
      university: { select: { id: true, name: true } },
    },
    orderBy: [{ university: { name: "asc" } }, { name: "asc" }],
    take: 200,
  });

  // Activity timeline = audit trail for this country
  const activities = await prisma.auditLog.findMany({
    where: { entity: "Country", entityId: id },
    orderBy: { createdAt: "desc" },
    take: 30,
  }) as AuditLog[];

  const flag = resolveCountryFlag(country.code, country.flag);

  return (
    <>
      <PageHeader
        title={
          <span className="inline-flex items-center gap-2">
            {flag ? (
              <span aria-hidden className="text-2xl leading-none">{flag}</span>
            ) : (
              <Globe className="h-5 w-5 text-muted-foreground" aria-hidden />
            )}
            {country.name}
          </span>
        }
        description={
          <span className="inline-flex flex-wrap items-center gap-3">
            <span className="font-mono text-xs uppercase">{country.code}</span>
            {country.currency && <span>Currency: {country.currency}</span>}
            <span>ID: {country.id}</span>
          </span>
        }
        breadcrumbs={["Admin", "Countries", country.name]}
        actions={
          <div className="flex items-center gap-2">
            {country.deletedAt && <StatusBadge status="ARCHIVED" />}
            <StatusBadge status={country.status} />
            <Link
              href={`/admin/countries?slug=${countrySlug(country.name)}`}
              className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Back to list
            </Link>
          </div>
        }
      />

      {/* Stat strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          ["Universities", country._count.universities],
          ["Courses", courses.length],
          ["Active Applications", country._count.applications],
          ["Visa Requirements", country._count.visaRequirements],
        ].map(([label, value]) => (
          <Card key={String(label)}>
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
              <p className="mt-1 text-2xl font-semibold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs
        tabs={[
          { value: "overview", label: "Overview" },
          { value: "universities", label: `Universities (${country.universities.length})` },
          { value: "courses", label: `Courses (${courses.length})` },
          { value: "visa", label: `Visa Requirements (${country.visaRequirements.length})` },
          { value: "documents", label: `Document Requirements (${country.documentRequirements.length})` },
          { value: "applications", label: `Active Applications (${country.applications.length})` },
        ]}
        defaultValue="overview"
      >
        {/* Overview */}
        <TabsContent value="overview" className="pt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>About</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                <Row label="Name" value={country.name} />
                <Row label="Code" value={<span className="font-mono uppercase">{country.code}</span>} />
                <Row label="Currency" value={country.currency ?? "—"} />
                <Row label="Status" value={<StatusBadge status={country.status} />} />
                <Row label="Created" value={formatDate(country.createdAt)} />
                <Row label="Updated" value={formatDate(country.updatedAt)} />
                {country.deletedAt && (
                  <Row label="Archived" value={formatDate(country.deletedAt)} />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Description</CardTitle>
              </CardHeader>
              <CardContent>
                {country.description ? (
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                    {country.description}
                  </p>
                ) : (
                  <EmptyState title="No description" description="Add one via the Edit dialog on the list page." />
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Activity Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                {activities.length === 0 ? (
                  <EmptyState title="No recorded activity" />
                ) : (
                  <ol className="relative space-y-4 border-l border-border pl-5">
                    {activities.map((a) => (
                      <li key={a.id}>
                        <span
                          className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-primary"
                          aria-hidden
                        />
                        <p className="font-mono text-xs font-medium">{a.action}</p>
                        {(a.oldValue || a.newValue) && (
                          <p className="text-xs text-muted-foreground">
                            {a.oldValue ? JSON.stringify(a.oldValue) : "{}"} →{" "}
                            {a.newValue ? JSON.stringify(a.newValue) : "{}"}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {new Date(a.createdAt).toLocaleString("en-GB")}
                        </p>
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Universities */}
        <TabsContent value="universities" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Universities in {country.name}</CardTitle>
            </CardHeader>
            <CardContent>
              {country.universities.length === 0 ? (
                <EmptyState
                  title="No universities yet"
                  description={`Add universities for ${country.name} via the Universities admin.`}
                  action={
                    <Link
                      href="/admin/universities"
                      className="text-primary hover:underline"
                    >
                      Go to Universities →
                    </Link>
                  }
                />
              ) : (
                <TableShell headers={["University", "Ranking", "Courses", "Applications"]}>
                  {country.universities.map((u) => (
                    <tr key={u.id}>
                      <td className="px-4 py-2.5">
                        <Link href={`/admin/universities/${u.id}`} className="font-medium text-primary hover:underline">
                          {u.name}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5">{u.ranking ? `#${u.ranking}` : "—"}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{u._count.courses}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{u._count.applications}</td>
                    </tr>
                  ))}
                </TableShell>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Courses */}
        <TabsContent value="courses" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Courses in {country.name}</CardTitle>
            </CardHeader>
            <CardContent>
              {courses.length === 0 ? (
                <EmptyState
                  title="No courses yet"
                  description={`Add courses via the Courses admin (select a university in ${country.name} first).`}
                  action={
                    <Link href="/admin/courses" className="text-primary hover:underline">
                      Go to Courses →
                    </Link>
                  }
                />
              ) : (
                <TableShell headers={["Course", "University", "Level", "Tuition", "English Req."]}>
                  {courses.map((c) => (
                    <tr key={c.id}>
                      <td className="px-4 py-2.5 font-medium">{c.name}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{c.university.name}</td>
                      <td className="px-4 py-2.5">{c.degreeLevel}</td>
                      <td className="px-4 py-2.5">
                        {c.tuitionFee != null ? `${c.currency} ${c.tuitionFee.toLocaleString()}` : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {c.englishRequirements ?? "—"}
                      </td>
                    </tr>
                  ))}
                </TableShell>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Visa Requirements — admin can configure country-specific visa requirements */}
        <TabsContent value="visa" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Visa Requirements</CardTitle>
            </CardHeader>
            <CardContent>
              <CountryVisaRequirements countryId={country.id} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Document Requirements — admin can configure country-specific document requirements */}
        <TabsContent value="documents" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Document Requirements</CardTitle>
            </CardHeader>
            <CardContent>
              <CountryDocumentRequirements countryId={country.id} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Active Applications */}
        <TabsContent value="applications" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Applications</CardTitle>
            </CardHeader>
            <CardContent>
              {country.applications.length === 0 ? (
                <EmptyState
                  title="No active applications"
                  description={`No in-flight applications targeting ${country.name} right now.`}
                />
              ) : (
                <TableShell headers={["Application", "Student", "University", "Course", "Stage", "Priority"]}>
                  {country.applications.map((a) => (
                    <tr key={a.id}>
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/admin/applications/${a.id}`}
                          className="font-mono text-xs text-primary hover:underline"
                        >
                          {a.applicationNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/admin/students/${a.student.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {a.student.firstName} {a.student.lastName}
                        </Link>
                        <div className="text-xs text-muted-foreground">{a.student.studentId}</div>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {a.university ? (
                          <Link href={`/admin/universities/${a.university.id}`} className="hover:underline">
                            {a.university.name}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{a.course?.name ?? "—"}</td>
                      <td className="px-4 py-2.5">
                        <StatusBadge status={a.stageKey} />
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusBadge status={a.priority} />
                      </td>
                    </tr>
                  ))}
                </TableShell>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right font-medium">{value}</span>
    </div>
  );
}
