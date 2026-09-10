import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/shared/page-kit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { StatusBadge, TableShell, EmptyState } from "@/components/shared";
import { Tabs, TabsContent } from "@/components/ui/overlays";
import { formatDate, titleCase } from "@/lib/utils";
import { COURSE_DEGREE_LABELS } from "@/lib/constants/courses";
import { formatTuition, intakeStartLabel } from "@/lib/constants/courses-admin";
import { intakeDeadlineUrgency } from "@/lib/constants/courses";
import { ChevronLeft, GraduationCap, CalendarClock, Info, AlertTriangle } from "lucide-react";
import type { Course, Intake, Application, University, Country, AuditLog } from "@prisma/client";

export const dynamic = "force-dynamic";

type DetailCourse = Course & {
  university: Pick<University, "id" | "name" | "logo"> & {
    country: Pick<Country, "id" | "name" | "flag" | "currency">;
  };
  intakes: (Intake & {
    _count: { applications: number };
  })[];
  _count: {
    intakes: number;
    applications: number;
  };
  applications: (Application & {
    student: { id: string; firstName: string; lastName: string; studentId: string };
  })[];
  activities: AuditLog[];
};

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const course = (await prisma.course.findFirst({
    where: { id },
    include: {
      university: {
        select: {
          id: true,
          name: true,
          logo: true,
          country: { select: { id: true, name: true, flag: true, currency: true } },
        },
      },
      intakes: {
        where: { deletedAt: null },
        orderBy: [{ year: "asc" }, { month: "asc" }],
        include: {
          _count: { select: { applications: { where: { deletedAt: null } } } },
        },
      },
      _count: {
        select: {
          intakes: { where: { deletedAt: null, status: "ACTIVE" } },
          applications: { where: { deletedAt: null, status: "ACTIVE" } },
        },
      },
    },
  })) as DetailCourse | null;

  if (!course) notFound();

  // Active applications targeting this course (latest 25).
  const applications = await prisma.application.findMany({
    where: { courseId: id, deletedAt: null, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    take: 25,
    include: {
      student: {
        select: { id: true, firstName: true, lastName: true, studentId: true },
      },
    },
  });

  // Activity timeline = audit trail for this course.
  const activities = (await prisma.auditLog.findMany({
    where: { entity: "Course", entityId: id },
    orderBy: { createdAt: "desc" },
    take: 30,
  })) as AuditLog[];

  const degreeLabel =
    COURSE_DEGREE_LABELS[course.degreeLevel as keyof typeof COURSE_DEGREE_LABELS] ??
    titleCase(course.degreeLevel);
  const now = new Date();

  return (
    <>
      <div className="flex items-center gap-2 text-sm">
        <Link
          href="/admin/courses"
          className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary"
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> Courses
        </Link>
      </div>

      <PageHeader
        title={
          <span className="inline-flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-muted-foreground" aria-hidden />
            {course.name}
          </span>
        }
        description={
          <span className="inline-flex flex-wrap items-center gap-3">
            <Link
              href={`/admin/universities/${course.university.id}`}
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              {course.university.country.flag && <span aria-hidden>{course.university.country.flag}</span>}
              {course.university.name}
            </Link>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">{degreeLabel}</span>
            <span className="font-mono text-xs text-muted-foreground">slug: {course.slug}</span>
          </span>
        }
        breadcrumbs={["Admin", "Courses", course.name]}
        actions={
          <div className="flex items-center gap-2">
            {course.deletedAt && <StatusBadge status="ARCHIVED" />}
            <StatusBadge status={course.status} />
          </div>
        }
      />

      {/* Stat strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          ["Tuition", formatTuition(course.tuitionFee, course.currency)],
          ["Application Fee", formatTuition(course.applicationFee, course.currency)],
          ["Active Intakes", course._count.intakes],
          ["Active Applications", course._count.applications],
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
          { value: "intakes", label: `Intakes (${course.intakes.length})` },
          { value: "applications", label: `Active Applications (${applications.length})` },
          { value: "activity", label: "Activity" },
        ]}
        defaultValue="overview"
      >
        {/* Overview */}
        <TabsContent value="overview" className="pt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Course details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Name" value={course.name} />
                <Row label="Degree level" value={degreeLabel} />
                <Row label="University" value={
                  <Link href={`/admin/universities/${course.university.id}`} className="text-primary hover:underline">
                    {course.university.name}
                  </Link>
                } />
                <Row label="Duration" value={course.duration ?? "—"} />
                <Row label="Tuition" value={formatTuition(course.tuitionFee, course.currency)} />
                <Row label="Application fee" value={formatTuition(course.applicationFee, course.currency)} />
                <Row label="Status" value={<StatusBadge status={course.status} />} />
                <Row label="Created" value={formatDate(course.createdAt)} />
                <Row label="Updated" value={formatDate(course.updatedAt)} />
                {course.deletedAt && <Row label="Archived" value={formatDate(course.deletedAt)} />}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Requirements</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {course.ieltsRequirement && <Row label="IELTS" value={course.ieltsRequirement} />}
                {course.toeflRequirement && <Row label="TOEFL" value={course.toeflRequirement} />}
                {course.pteRequirement && <Row label="PTE" value={course.pteRequirement} />}
                {course.englishRequirements && (
                  <Row label="Legacy note" value={course.englishRequirements} />
                )}
                {course.academicRequirements && (
                  <div className="pt-2">
                    <p className="font-medium">Academic requirements</p>
                    <p className="mt-1 text-muted-foreground">{course.academicRequirements}</p>
                  </div>
                )}
                {!course.ieltsRequirement && !course.toeflRequirement && !course.pteRequirement && !course.englishRequirements && !course.academicRequirements && (
                  <EmptyState title="No requirements specified" />
                )}
              </CardContent>
            </Card>

            {course.applicationDeadline && (
              <Card className="lg:col-span-2">
                <CardContent className="p-4">
                  <ApplicationDeadlineBanner
                    deadline={course.applicationDeadline}
                    urgency={intakeDeadlineUrgency(course.applicationDeadline, now)}
                  />
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Intakes */}
        <TabsContent value="intakes" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4" aria-hidden />
                Active intakes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {course.intakes.length === 0 ? (
                <EmptyState
                  title="No active intakes"
                  description="Add intakes from the Intakes admin."
                />
              ) : (
                <TableShell headers={["Intake", "Start", "Deadline", "Urgency", "Applications"]}>
                  {course.intakes.map((i) => {
                    const urgency = intakeDeadlineUrgency(i.deadline, now);
                    return (
                      <tr key={i.id}>
                        <td className="px-4 py-2.5 font-medium">{i.name}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{intakeStartLabel(i.month, i.year)}</td>
                        <td className="px-4 py-2.5">{i.deadline ? formatDate(i.deadline) : "—"}</td>
                        <td className="px-4 py-2.5">
                          {urgency === "urgent" && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
                              <AlertTriangle className="h-3 w-3" aria-hidden /> ≤7 days
                            </span>
                          )}
                          {urgency === "soon" && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-warning">
                              <CalendarClock className="h-3 w-3" aria-hidden /> ≤30 days
                            </span>
                          )}
                          {urgency === "normal" && <span className="text-xs text-muted-foreground">Open</span>}
                          {urgency === "past" && <span className="text-xs text-muted-foreground">Closed</span>}
                          {urgency === "none" && <span className="text-xs text-success">No deadline</span>}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">{i._count.applications}</td>
                      </tr>
                    );
                  })}
                </TableShell>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Active Applications */}
        <TabsContent value="applications" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-4 w-4" aria-hidden />
                Active applications targeting this course
              </CardTitle>
            </CardHeader>
            <CardContent>
              {applications.length === 0 ? (
                <EmptyState
                  title="No active applications"
                  description="No in-flight applications targeting this course right now."
                />
              ) : (
                <TableShell headers={["Application", "Student", "Stage", "Priority"]}>
                  {applications.map((a) => (
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
                      <td className="px-4 py-2.5"><StatusBadge status={a.stageKey} /></td>
                      <td className="px-4 py-2.5"><StatusBadge status={a.priority} /></td>
                    </tr>
                  ))}
                </TableShell>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Timeline */}
        <TabsContent value="activity" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Activity timeline</CardTitle>
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
        </TabsContent>
      </Tabs>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right font-medium">{value}</span>
    </div>
  );
}

function ApplicationDeadlineBanner({
  deadline,
  urgency,
}: {
  deadline: Date;
  urgency: "urgent" | "soon" | "normal" | "past" | "none";
}) {
  const deadlineStr = deadline.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  const tone =
    urgency === "urgent"
      ? "border-destructive/40 bg-destructive/10 text-destructive"
      : urgency === "soon"
        ? "border-warning/40 bg-warning/10 text-warning"
        : urgency === "past"
          ? "border-border bg-muted/30 text-muted-foreground"
          : "border-border bg-muted/30 text-foreground";

  return (
    <div className={`rounded-md border p-3 ${tone}`}>
      <p className="flex items-center gap-2 text-sm font-medium">
        <CalendarClock className="h-4 w-4" aria-hidden />
        Course application deadline: {deadlineStr}
      </p>
      <p className="mt-0.5 text-xs opacity-80">
        {urgency === "urgent" && "Less than 7 days left — students should apply now."}
        {urgency === "soon" && "Less than 30 days left — start applications soon."}
        {urgency === "normal" && "There's still time to apply."}
        {urgency === "past" && "This deadline has passed."}
      </p>
    </div>
  );
}
