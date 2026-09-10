import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { EmptyState, StatusBadge } from "@/components/shared";
import { Tabs, TabsContent } from "@/components/ui/overlays";
import { CourseDetailActions } from "@/components/modules/course-detail-actions";
import {
  COURSE_DEGREE_LABELS,
  collectEnglishRequirements,
  formatTuitionFee,
  intakeStartDate,
  intakeDeadlineUrgency,
} from "@/lib/constants/courses";
import { formatMoney, titleCase } from "@/lib/utils";
import {
  ChevronLeft,
  Globe,
  Building2,
  Clock,
  CalendarClock,
  GraduationCap,
  BookOpen,
  FileCheck,
  Info,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import type { Course, Intake, University, Country } from "@prisma/client";

export const dynamic = "force-dynamic";

type DetailCourse = Course & {
  university: Pick<University, "id" | "name" | "logo" | "website" | "city"> & {
    country: Pick<Country, "id" | "name" | "code" | "flag" | "currency">;
  };
  intakes: Intake[];
};

export default async function StudentCourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();

  // Restrict to STUDENT + ADMIN roles (employees have /employee/courses).
  if (session.user.role === "EMPLOYEE") {
    notFound();
  }

  // Fetch the course applying the student-visibility chain at the DB
  // level (course + university + country all ACTIVE and non-archived).
  // A course that fails any of these 404s cleanly.
  const course = (await prisma.course.findFirst({
    where: {
      id,
      deletedAt: null,
      status: "ACTIVE",
      university: {
        deletedAt: null,
        status: "ACTIVE",
        country: { deletedAt: null, status: "ACTIVE" },
      },
    },
    include: {
      university: {
        select: {
          id: true,
          name: true,
          logo: true,
          website: true,
          city: true,
          country: {
            select: { id: true, name: true, code: true, flag: true, currency: true },
          },
        },
      },
      intakes: {
        where: { status: "ACTIVE" },
        orderBy: [{ year: "asc" }, { month: "asc" }],
      },
    },
  })) as DetailCourse | null;

  if (!course) notFound();

  // Resolve the student's counseling-request state for this course's
  // university so the UI can show "Request pending" without a second call.
  let counselingRequested = false;
  let counselingRequestStatus: string | null = null;
  if (session.user.role === "STUDENT") {
    const student = await prisma.student.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (student) {
      const existing = await prisma.counselingRequest.findFirst({
        where: {
          studentId: student.id,
          universityId: course.universityId,
        },
        orderBy: { createdAt: "desc" },
        select: { status: true },
      });
      if (existing) {
        counselingRequested = true;
        counselingRequestStatus = existing.status;
      }
    }
  }

  const englishReqs = collectEnglishRequirements(course);
  const degreeLabel =
    COURSE_DEGREE_LABELS[course.degreeLevel as keyof typeof COURSE_DEGREE_LABELS] ??
    titleCase(course.degreeLevel);
  const now = new Date();
  const location = [course.university.city, course.university.country.name]
    .filter(Boolean)
    .join(", ");

  // Sort intakes by computed start date for the Intakes tab.
  const sortedIntakes = [...course.intakes].sort((a, b) => {
    const sa = intakeStartDate(a.month, a.year)?.getTime() ?? 0;
    const sb = intakeStartDate(b.month, b.year)?.getTime() ?? 0;
    return sa - sb;
  });

  return (
    <>
      <div className="flex items-center gap-2 text-sm">
        <Link
          href="/student/courses"
          className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary"
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> Courses
        </Link>
      </div>

      {/* Header card */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1">
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                <GraduationCap className="h-3 w-3" aria-hidden />
                {degreeLabel}
              </span>
              <h1 className="text-lg font-semibold leading-tight sm:text-xl">
                {course.name}
              </h1>
              <Link
                href={`/student/universities/${course.university.id}`}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
              >
                <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {course.university.name}
              </Link>
              {location && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Globe className="h-3 w-3 shrink-0" aria-hidden />
                  {course.university.country.flag
                    ? `${course.university.country.flag} `
                    : ""}
                  {location}
                </p>
              )}
            </div>
            <StatusBadge status="ACTIVE" />
          </div>
        </CardContent>
      </Card>

      {/* Action bar */}
      <CourseDetailActions
        universityId={course.universityId}
        courseId={course.id}
        courseName={course.name}
        universityName={course.university.name}
        counselingRequested={counselingRequested}
        counselingRequestStatus={counselingRequestStatus}
      />

      <Tabs
        tabs={[
          { value: "overview", label: "Overview" },
          { value: "intakes", label: `Intakes (${course.intakes.length})` },
          { value: "requirements", label: "Requirements" },
          { value: "application", label: "Application Info" },
        ]}
        defaultValue="overview"
      >
        {/* Overview */}
        <TabsContent value="overview" className="pt-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Course details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row
                  icon={<GraduationCap className="h-3.5 w-3.5" aria-hidden />}
                  label="Degree level"
                  value={degreeLabel}
                />
                {course.duration && (
                  <Row
                    icon={<Clock className="h-3.5 w-3.5" aria-hidden />}
                    label="Duration"
                    value={course.duration}
                  />
                )}
                {course.tuitionFee != null && (
                  <Row
                    label="Tuition"
                    value={formatTuitionFee(course.tuitionFee, course.currency)}
                  />
                )}
                {course.applicationFee != null && (
                  <Row
                    label="Application fee"
                    value={formatMoney(course.applicationFee, course.currency)}
                  />
                )}
                {course.university.country.currency && (
                  <Row
                    label="Local currency"
                    value={course.university.country.currency}
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>University</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row
                  label="Name"
                  value={
                    <Link
                      href={`/student/universities/${course.university.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {course.university.name}
                    </Link>
                  }
                />
                <Row label="Country" value={
                  <span className="inline-flex items-center gap-1">
                    {course.university.country.flag && (
                      <span aria-hidden>{course.university.country.flag}</span>
                    )}
                    {course.university.country.name}
                  </span>
                } />
                {course.university.city && (
                  <Row label="City" value={course.university.city} />
                )}
                {course.university.website && (
                  <Row
                    label="Website"
                    value={
                      <a
                        href={course.university.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        Visit ↗
                      </a>
                    }
                  />
                )}
              </CardContent>
            </Card>
          </div>
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
              {sortedIntakes.length === 0 ? (
                <EmptyState
                  title="No active intakes"
                  description="There are no open intake windows for this course right now. Request counseling to ask about future intakes."
                />
              ) : (
                <div className="space-y-2">
                  {sortedIntakes.map((i) => {
                    const startDate = intakeStartDate(i.month, i.year);
                    const urgency = intakeDeadlineUrgency(i.deadline, now);
                    return (
                      <IntakeRow
                        key={i.id}
                        name={i.name}
                        startDate={startDate}
                        deadline={i.deadline}
                        urgency={urgency}
                      />
                    );
                  })}
                </div>
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
                  <BookOpen className="h-4 w-4" aria-hidden />
                  English requirements
                </CardTitle>
              </CardHeader>
              <CardContent>
                {englishReqs.length === 0 ? (
                  <EmptyState
                    title="No structured English requirements"
                    description={
                      course.englishRequirements
                        ? "See the legacy note below."
                        : "Ask your counselor about English-test expectations for this course."
                    }
                  />
                ) : (
                  <ul className="space-y-2 text-sm">
                    {englishReqs.map((er) => (
                      <li
                        key={er.test}
                        className="flex flex-col gap-0.5 rounded-md border border-border p-2.5"
                      >
                        <span className="font-medium">{er.label}</span>
                        <span className="text-muted-foreground">{er.value}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {course.englishRequirements && (
                  <div className="mt-3 rounded-md bg-muted/30 p-3 text-xs text-muted-foreground">
                    <p className="font-medium text-foreground">Legacy note</p>
                    <p className="mt-0.5">{course.englishRequirements}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileCheck className="h-4 w-4" aria-hidden />
                  Academic requirements
                </CardTitle>
              </CardHeader>
              <CardContent>
                {course.academicRequirements ? (
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                    {course.academicRequirements}
                  </p>
                ) : (
                  <EmptyState
                    title="Not specified"
                    description="Your counselor can clarify the academic entry requirements during a counseling session."
                  />
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
                {course.tuitionFee != null && (
                  <Row
                    label="Tuition"
                    value={formatTuitionFee(course.tuitionFee, course.currency)}
                  />
                )}
                {course.applicationFee != null && (
                  <Row
                    label="Application fee"
                    value={formatMoney(course.applicationFee, course.currency)}
                  />
                )}
                <Row label="Degree" value={degreeLabel} />
                <Row label="Duration" value={course.duration ?? "—"} />
                <Row label="Active intakes" value={course.intakes.length} />
              </div>

              {course.applicationDeadline && (
                <ApplicationDeadlineBanner
                  deadline={course.applicationDeadline}
                  urgency={intakeDeadlineUrgency(course.applicationDeadline, now)}
                />
              )}

              <div className="rounded-md border border-border bg-muted/30 p-3">
                <p className="font-medium">How to apply</p>
                <p className="mt-1 text-muted-foreground">
                  Students don&apos;t apply directly through this portal. To start an
                  application to <strong>{course.name}</strong> at{" "}
                  <strong>{course.university.name}</strong>, request counseling and your
                  assigned counselor will guide you through document collection, intake
                  selection, and submission.
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

function IntakeRow({
  name,
  startDate,
  deadline,
  urgency,
}: {
  name: string;
  startDate: Date | null;
  deadline: Date | null;
  urgency: "urgent" | "soon" | "normal" | "past" | "none";
}) {
  const startDateStr = startDate
    ? startDate.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      })
    : "—";
  const deadlineStr = deadline
    ? new Date(deadline).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      })
    : "Open";

  const urgencyBadge =
    urgency === "urgent" ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive">
        <AlertTriangle className="h-3 w-3" aria-hidden />
        Closes in ≤7 days
      </span>
    ) : urgency === "soon" ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning">
        <CalendarClock className="h-3 w-3" aria-hidden />
        Closes in ≤30 days
      </span>
    ) : urgency === "past" ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
        Closed
      </span>
    ) : urgency === "none" ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
        <CheckCircle2 className="h-3 w-3" aria-hidden />
        Open (no deadline)
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
        Open
      </span>
    );

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
      <div className="min-w-0">
        <p className="font-medium">{name}</p>
        <p className="text-xs text-muted-foreground">
          Starts {startDateStr} · Deadline {deadlineStr}
        </p>
      </div>
      {urgencyBadge}
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
        {urgency === "urgent" && "Less than 7 days left — request counseling now."}
        {urgency === "soon" && "Less than 30 days left — start your application soon."}
        {urgency === "normal" && "There's still time to apply."}
        {urgency === "past" && "This deadline has passed. Ask your counselor about the next intake."}
      </p>
    </div>
  );
}
