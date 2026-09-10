import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { EmptyState, StatusBadge, TableShell } from "@/components/shared";
import { Tabs, TabsContent } from "@/components/ui/overlays";
import { formatApplicationFee, resolveUniversityLogo, universityInitials, rankingTier } from "@/lib/constants/universities";
import { formatDate, formatMoney, titleCase } from "@/lib/utils";
import { UniversityDetailActions } from "@/components/modules/university-detail-actions";
import { ChevronLeft, Globe, Star, GraduationCap, CalendarClock, FileCheck, Info, ExternalLink } from "lucide-react";
import type { University, Course, Intake, Country } from "@prisma/client";

export const dynamic = "force-dynamic";

type DetailUniversity = University & {
  country: Pick<Country, "id" | "name" | "code" | "flag" | "currency">;
  courses: (Course & {
    intakes: Intake[];
  })[];
};

type IntakeFlattened = {
  id: string;
  name: string;
  month: number;
  year: number;
  deadline: Date | null;
  courseName: string;
  degreeLevel: string;
};

export default async function StudentUniversityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();

  // Restrict to STUDENT role (admin already has /admin/universities/[id]).
  if (session.user.role === "EMPLOYEE") {
    // Employees shouldn't be browsing the student portal's discovery view;
    // they have their own list at /employee/universities.
    notFound();
  }

  // Fetch the university, applying the student-visibility rule at the DB
  // level so deleted/archived/inactive-country universities 404 cleanly.
  const university = (await prisma.university.findFirst({
    where: {
      id,
      deletedAt: null,
      status: "ACTIVE",
      country: { deletedAt: null, status: "ACTIVE" },
    },
    include: {
      country: { select: { id: true, name: true, code: true, flag: true, currency: true } },
      courses: {
        where: { deletedAt: null, status: "ACTIVE" },
        orderBy: [{ degreeLevel: "asc" }, { name: "asc" }],
        include: {
          intakes: {
            where: { status: "ACTIVE" },
            orderBy: [{ year: "asc" }, { month: "asc" }],
          },
        },
      },
    },
  })) as DetailUniversity | null;

  if (!university) notFound();

  // Resolve student-specific state (favorites + counseling history).
  let isFavorite = false;
  let counselingRequested = false;
  let counselingRequestStatus: string | null = null;
  if (session.user.role === "STUDENT") {
    const student = await prisma.student.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (student) {
      const [fav, req] = await Promise.all([
        prisma.universityFavorite.findUnique({
          where: {
            studentId_universityId: {
              studentId: student.id,
              universityId: university.id,
            },
          },
          select: { id: true },
        }),
        prisma.counselingRequest.findFirst({
          where: { studentId: student.id, universityId: university.id },
          orderBy: { createdAt: "desc" },
          select: { status: true },
        }),
      ]);
      isFavorite = !!fav;
      counselingRequested = !!req;
      counselingRequestStatus = req?.status ?? null;
    }
  }

  // Requirements are visible to students so they can self-assess readiness
  // before requesting counseling — they should not be a surprise at the
  // counseling session.
  const [documentRequirements, visaRequirements] = await Promise.all([
    prisma.documentRequirement.findMany({
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
    }),
    prisma.visaRequirement.findMany({
      where: { status: "ACTIVE", countryId: university.countryId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        description: true,
        required: true,
      },
    }),
  ]);

  const intakes: IntakeFlattened[] = university.courses.flatMap((c) =>
    c.intakes.map((i) => ({
      id: i.id,
      name: i.name,
      month: i.month,
      year: i.year,
      deadline: i.deadline,
      courseName: c.name,
      degreeLevel: c.degreeLevel,
    })),
  );

  const logo = resolveUniversityLogo(university.logo);
  const tier = rankingTier(university.ranking);
  const location = [university.city, university.country.name].filter(Boolean).join(", ");

  return (
    <>
      <div className="flex items-center gap-2 text-sm">
        <Link
          href="/student/universities"
          className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary"
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> Universities
        </Link>
      </div>

      {/* Header */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start">
          <div className="flex items-start gap-3 sm:flex-1">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logo}
                alt={`${university.name} logo`}
                className="h-16 w-16 shrink-0 rounded-lg object-contain"
              />
            ) : (
              <div
                className="grid h-16 w-16 shrink-0 place-items-center rounded-lg bg-primary/10 text-base font-semibold text-primary"
                aria-hidden
              >
                {universityInitials(university.name)}
              </div>
            )}
            <div className="min-w-0 flex-1 space-y-1">
              <h1 className="text-lg font-semibold leading-tight sm:text-xl">
                {university.name}
              </h1>
              {location && (
                <p className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Globe className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {location}
                  {university.country.flag && (
                    <span aria-hidden className="ml-1">
                      {university.country.flag}
                    </span>
                  )}
                </p>
              )}
              {university.description && (
                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {university.description}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {university.ranking != null && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                    <Star className="h-3 w-3" aria-hidden />
                    #{university.ranking}
                    {tier === "top" && " · Top 50"}
                    {tier === "leading" && " · Top 200"}
                  </span>
                )}
                <StatusBadge status="ACTIVE" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <UniversityDetailActions
        universityId={university.id}
        universityName={university.name}
        website={university.website}
        isFavorite={isFavorite}
        counselingRequested={counselingRequested}
        counselingRequestStatus={counselingRequestStatus}
      />

      <Tabs
        tabs={[
          { value: "overview", label: "Overview" },
          { value: "courses", label: `Courses (${university.courses.length})` },
          { value: "intakes", label: `Intakes (${intakes.length})` },
          { value: "requirements", label: `Requirements (${documentRequirements.length + visaRequirements.length})` },
          { value: "application", label: "Application Info" },
        ]}
        defaultValue="overview"
      >
        {/* Overview */}
        <TabsContent value="overview" className="pt-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>About</CardTitle>
              </CardHeader>
              <CardContent>
                {university.description ? (
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                    {university.description}
                  </p>
                ) : (
                  <EmptyState
                    title="No description yet"
                    description="Your counselor hasn't added a description for this university."
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick facts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row
                  icon={<Globe className="h-3.5 w-3.5" aria-hidden />}
                  label="Country"
                  value={
                    <span className="inline-flex items-center gap-1">
                      {university.country.flag && (
                        <span aria-hidden>{university.country.flag}</span>
                      )}
                      {university.country.name}
                    </span>
                  }
                />
                {university.city && <Row label="City" value={university.city} />}
                {university.ranking != null && (
                  <Row label="World ranking" value={`#${university.ranking}`} />
                )}
                {university.applicationFee != null && (
                  <Row
                    label="Application fee"
                    value={formatApplicationFee(
                      university.applicationFee,
                      university.country.currency,
                    )}
                  />
                )}
                {university.country.currency && (
                  <Row label="Local currency" value={university.country.currency} />
                )}
                {university.website && (
                  <Row
                    label="Website"
                    value={
                      <a
                        href={university.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" aria-hidden />
                        {university.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                      </a>
                    }
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Courses */}
        <TabsContent value="courses" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4" aria-hidden />
                Courses at {university.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {university.courses.length === 0 ? (
                <EmptyState
                  title="No courses published"
                  description="Your counselor hasn't added courses for this university yet."
                />
              ) : (
                <TableShell headers={["Course", "Level", "Duration", "Tuition", "English Req."]}>
                  {university.courses.map((c) => (
                    <tr key={c.id}>
                      <td className="px-4 py-2.5 font-medium">{c.name}</td>
                      <td className="px-4 py-2.5">{titleCase(c.degreeLevel)}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{c.duration ?? "—"}</td>
                      <td className="px-4 py-2.5">
                        {c.tuitionFee != null
                          ? formatMoney(c.tuitionFee, c.currency)
                          : "—"}
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

        {/* Intakes */}
        <TabsContent value="intakes" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4" aria-hidden />
                Upcoming intakes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {intakes.length === 0 ? (
                <EmptyState
                  title="No open intakes"
                  description="There are no active intake windows for this university's courses right now."
                />
              ) : (
                <TableShell headers={["Intake", "Course", "Level", "Deadline"]}>
                  {intakes.map((i) => (
                    <tr key={i.id}>
                      <td className="px-4 py-2.5 font-medium">{i.name}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{i.courseName}</td>
                      <td className="px-4 py-2.5">{titleCase(i.degreeLevel)}</td>
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

        {/* Requirements */}
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

        {/* Application Info */}
        <TabsContent value="application" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-4 w-4" aria-hidden />
                Application information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid gap-3 sm:grid-cols-2">
                <Row label="Application fee" value={
                  university.applicationFee != null
                    ? formatApplicationFee(university.applicationFee, university.country.currency)
                    : "—"
                } />
                <Row label="Country currency" value={university.country.currency ?? "—"} />
                <Row label="Courses available" value={university.courses.length} />
                <Row label="Open intakes" value={intakes.length} />
              </div>

              <div className="rounded-md border border-border bg-muted/30 p-3">
                <p className="font-medium">How to apply</p>
                <p className="mt-1 text-muted-foreground">
                  Students don&apos;t apply directly through this portal. To start an application
                  to <strong>{university.name}</strong>, request counseling and your assigned
                  counselor will guide you through course selection, document collection, and
                  submission.
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Use the &quot;Request counseling&quot; button at the top of this page to get started.
                </p>
              </div>
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
