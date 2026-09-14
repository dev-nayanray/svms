import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/shared/page-kit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { StatusBadge, TableShell, EmptyState } from "@/components/shared";
import { Tabs, TabsContent } from "@/components/ui/overlays";
import { formatDate, titleCase } from "@/lib/utils";
import { UniversityCourses } from "@/components/admin/university-courses";
import { formatFee } from "@/lib/constants/universities-admin";
import { ExternalLink, Building2, GraduationCap, CalendarClock, FileCheck, Info, Receipt } from "lucide-react";
import type { University, Course, Application, Country, AuditLog } from "@prisma/client";

export const dynamic = "force-dynamic";

type DetailUniversity = University & {
  country: Pick<Country, "id" | "name" | "code" | "flag" | "currency">;
  courses: (Course & {
    _count: { intakes: number; applications: number };
  })[];
  applications: (Application & {
    student: { id: string; firstName: string; lastName: string; studentId: string };
    course: { id: string; name: string } | null;
  })[];
  _count: {
    courses: number;
    applications: number;
  };
};

export default async function UniversityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const university = (await prisma.university.findFirst({
    where: { id },
    include: {
      country: {
        select: { id: true, name: true, code: true, flag: true, currency: true },
      },
      courses: {
        where: { deletedAt: null },
        orderBy: [{ degreeLevel: "asc" }, { name: "asc" }],
        include: {
          _count: {
            select: {
              intakes: { where: { status: "ACTIVE" } },
              applications: { where: { deletedAt: null } },
            },
          },
        },
      },
      applications: {
        where: { deletedAt: null, status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        take: 25,
        include: {
          student: {
            select: { id: true, firstName: true, lastName: true, studentId: true },
          },
          course: { select: { id: true, name: true } },
        },
      },
      _count: {
        select: {
          courses: { where: { deletedAt: null } },
          applications: { where: { deletedAt: null, status: "ACTIVE" } },
        },
      },
    },
  })) as DetailUniversity | null;

  if (!university) notFound();

  // Pull all intakes across this university's courses in one query —
  // cheaper than N+1 inside the JSX.
  const intakes = await prisma.intake.findMany({
    where: {
      status: "ACTIVE",
      course: { universityId: id, deletedAt: null },
    },
    include: {
      course: { select: { id: true, name: true, degreeLevel: true } },
    },
    orderBy: [{ year: "asc" }, { month: "asc" }],
    take: 200,
  });

  // Document requirements relevant to this university's country (country-
  // scoped + global). Used by the Requirements tab.
  const documentRequirements = await prisma.documentRequirement.findMany({
    where: {
      status: "ACTIVE",
      OR: [{ countryId: university.countryId }, { countryId: null }],
    },
    orderBy: [{ appliesTo: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      required: true,
      appliesTo: true,
      countryId: true,
    },
  });

  // Visa requirements for this university's country.
  const visaRequirements = await prisma.visaRequirement.findMany({
    where: { status: "ACTIVE", countryId: university.countryId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      required: true,
    },
  });

  // Activity timeline = audit trail for this university.
  const activities = (await prisma.auditLog.findMany({
    where: { entity: "University", entityId: id },
    orderBy: { createdAt: "desc" },
    take: 30,
  })) as AuditLog[];

  return (
    <>
      <PageHeader
        title={
          <span className="inline-flex items-center gap-2">
            {university.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={university.logo}
                alt=""
                className="h-7 w-7 rounded object-contain"
              />
            ) : (
              <Building2 className="h-5 w-5 text-muted-foreground" aria-hidden />
            )}
            {university.name}
          </span>
        }
        description={
          <span className="inline-flex flex-wrap items-center gap-3">
            {university.country.flag && <span aria-hidden>{university.country.flag}</span>}
            <span>{university.country.name}</span>
            {university.city && <span>· {university.city}</span>}
            {university.website && <span>· {university.website}</span>}
            <span className="font-mono text-xs text-muted-foreground">slug: {university.slug}</span>
          </span>
        }
        breadcrumbs={["Admin", "Universities", university.name]}
        actions={
          <div className="flex items-center gap-2">
            {university.deletedAt && <StatusBadge status="ARCHIVED" />}
            <StatusBadge status={university.status} />
            <Link
              href="/admin/universities"
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
          ["Ranking", university.ranking ? `#${university.ranking}` : "—"],
          ["Application Fee", formatFee(university.applicationFee, university.country.currency ?? "USD")],
          ["Courses", university._count.courses],
          ["Active Applications", university._count.applications],
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
          { value: "courses", label: `Courses (${university.courses.length})` },
          { value: "intakes", label: `Intakes (${intakes.length})` },
          { value: "requirements", label: `Requirements (${documentRequirements.length + visaRequirements.length})` },
          { value: "fee", label: "Application Fee" },
          { value: "applications", label: `Active Applications (${university.applications.length})` },
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
                <Row label="Name" value={university.name} />
                <Row label="Slug" value={<span className="font-mono text-xs">{university.slug}</span>} />
                <Row
                  label="Country"
                  value={
                    <Link
                      href={`/admin/countries/${university.country.id}`}
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      {university.country.flag && <span aria-hidden>{university.country.flag}</span>}
                      {university.country.name}
                    </Link>
                  }
                />
                {university.city && <Row label="City" value={university.city} />}
                {university.ranking != null && (
                  <Row label="Ranking" value={`#${university.ranking}`} />
                )}
                <Row label="Status" value={<StatusBadge status={university.status} />} />
                <Row label="Created" value={formatDate(university.createdAt)} />
                <Row label="Updated" value={formatDate(university.updatedAt)} />
                {university.deletedAt && (
                  <Row label="Archived" value={formatDate(university.deletedAt)} />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Description</CardTitle>
              </CardHeader>
              <CardContent>
                {university.description ? (
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                    {university.description}
                  </p>
                ) : (
                  <EmptyState
                    title="No description"
                    description="Add one via the Edit dialog on the list page."
                  />
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

        {/* Courses — admin can manage courses belonging to this university */}
        <TabsContent value="courses" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4" aria-hidden />
                Courses at {university.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <UniversityCourses universityId={university.id} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Intakes */}
        <TabsContent value="intakes" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4" aria-hidden />
                Active intakes across all courses
              </CardTitle>
            </CardHeader>
            <CardContent>
              {intakes.length === 0 ? (
                <EmptyState
                  title="No active intakes"
                  description="Add intakes to this university's courses from the Courses tab."
                />
              ) : (
                <TableShell headers={["Intake", "Course", "Level", "Month/Year", "Deadline"]}>
                  {intakes.map((i) => (
                    <tr key={i.id}>
                      <td className="px-4 py-2.5 font-medium">{i.name}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{i.course.name}</td>
                      <td className="px-4 py-2.5">{titleCase(i.course.degreeLevel)}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {i.month}/{i.year}
                      </td>
                      <td className="px-4 py-2.5">
                        {i.deadline ? formatDate(i.deadline) : "—"}
                      </td>
                    </tr>
                  ))}
                </TableShell>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Requirements — document + visa requirements for this country */}
        <TabsContent value="requirements" className="pt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileCheck className="h-4 w-4" aria-hidden />
                  Document requirements
                </CardTitle>
              </CardHeader>
              <CardContent>
                {documentRequirements.length === 0 ? (
                  <EmptyState title="No document requirements configured" />
                ) : (
                  <ul className="space-y-2 text-sm">
                    {documentRequirements.map((r) => (
                      <li
                        key={r.id}
                        className="flex items-start justify-between gap-3 rounded-md border border-border p-2.5"
                      >
                        <div>
                          <p className="font-medium">{r.name}</p>
                          {r.description && (
                            <p className="text-xs text-muted-foreground">{r.description}</p>
                          )}
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Scope: {titleCase(r.appliesTo)}
                            {!r.countryId && " · Global"}
                          </p>
                        </div>
                        <span
                          className={
                            r.required
                              ? "text-xs font-medium text-warning"
                              : "text-xs text-muted-foreground"
                          }
                        >
                          {r.required ? "Required" : "Optional"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileCheck className="h-4 w-4" aria-hidden />
                  Visa requirements for {university.country.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {visaRequirements.length === 0 ? (
                  <EmptyState title="No visa requirements configured" />
                ) : (
                  <ul className="space-y-2 text-sm">
                    {visaRequirements.map((r) => (
                      <li
                        key={r.id}
                        className="flex items-start justify-between gap-3 rounded-md border border-border p-2.5"
                      >
                        <div>
                          <p className="font-medium">{r.name}</p>
                          {r.description && (
                            <p className="text-xs text-muted-foreground">{r.description}</p>
                          )}
                        </div>
                        <span
                          className={
                            r.required
                              ? "text-xs font-medium text-warning"
                              : "text-xs text-muted-foreground"
                          }
                        >
                          {r.required ? "Required" : "Optional"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Application Fee */}
        <TabsContent value="fee" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-4 w-4" aria-hidden />
                Application fee information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid gap-3 sm:grid-cols-2">
                <Row
                  label="Application fee"
                  value={formatFee(university.applicationFee, university.country.currency ?? "USD")}
                />
                <Row label="Country currency" value={university.country.currency ?? "—"} />
                <Row label="Country" value={
                  <span className="inline-flex items-center gap-1">
                    {university.country.flag && <span aria-hidden>{university.country.flag}</span>}
                    {university.country.name}
                  </span>
                } />
                <Row label="Courses" value={university._count.courses} />
              </div>

              <div className="rounded-md border border-border bg-muted/30 p-3">
                <p className="font-medium">How application fees work</p>
                <p className="mt-1 text-muted-foreground">
                  The application fee is what students pay to the university when submitting
                  an application. It&apos;s separate from tuition and is typically non-refundable.
                  Students pay this through the agency; the actual payment is recorded against
                  the application in the Finance module.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Active Applications */}
        <TabsContent value="applications" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-4 w-4" aria-hidden />
                Active applications targeting this university
              </CardTitle>
            </CardHeader>
            <CardContent>
              {university.applications.length === 0 ? (
                <EmptyState
                  title="No active applications"
                  description="No in-flight applications targeting this university right now."
                />
              ) : (
                <TableShell headers={["Application", "Student", "Course", "Stage", "Priority"]}>
                  {university.applications.map((a) => (
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

function Row({
  label,
  value,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="min-w-0 truncate text-right font-medium">{value}</span>
    </div>
  );
}
