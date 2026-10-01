import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { auth } from "@/lib/auth";
import { EmployeePageHeader } from "@/components/employee/ui";
import { Card, CardContent, CardHeader, CardTitle, Badge, Separator } from "@/components/ui";
import { Tabs, TabsContent } from "@/components/ui/overlays";
import { formatDate, formatMoney, titleCase, cn } from "@/lib/utils";
import { requireCourse, type CourseDetail } from "@/lib/services/course-cases";

export const dynamic = "force-dynamic";

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "intakes", label: "Intakes" },
  { value: "requirements", label: "Requirements" },
] as const;

export default async function EmployeeCourseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/employee/courses");
  const role = (session.user as { role?: string }).role;
  if (role !== "EMPLOYEE" && role !== "ADMIN") redirect("/403");

  const { id } = await params;
  let course: CourseDetail;
  try {
    course = await requireCourse(id);
  } catch {
    notFound();
  }

  const sp = await searchParams;
  const activeTab = TABS.some((t) => t.value === sp.tab) ? sp.tab! : "overview";

  return (
    <div>
      <Link href="/employee/courses" className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" aria-hidden /> Back to Courses
      </Link>

      <EmployeePageHeader
        title={course.name}
        description={`${course.university.name} · ${titleCase(course.degreeLevel)} · ${course.duration ?? "—"}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={course.status === "ACTIVE" ? "success" : "default"}>{titleCase(course.status)}</Badge>
            {course.university.website && (
              <a href={course.university.website} target="_blank" rel="noopener noreferrer">
                <Badge tone="info"><ExternalLink className="h-3 w-3" aria-hidden /> University</Badge>
              </a>
            )}
          </div>
        }
      />

      <Tabs tabs={TABS.map((t) => ({ value: t.value, label: t.label }))} defaultValue={activeTab}>
        <div className="mt-4">
          <TabsContent value="overview"><OverviewTab course={course} /></TabsContent>
          <TabsContent value="intakes"><IntakesTab course={course} /></TabsContent>
          <TabsContent value="requirements"><RequirementsTab course={course} /></TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

function OverviewTab({ course }: { course: CourseDetail }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Course information</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <Field label="Course" value={course.name} />
            <Field label="Degree" value={titleCase(course.degreeLevel)} />
            <Field label="Duration" value={course.duration ?? "—"} />
            <Field label="Tuition" value={course.tuitionFee != null ? formatMoney(course.tuitionFee, course.currency) : "—"} />
            <Field label="Application fee" value={course.applicationFee != null ? formatMoney(course.applicationFee, course.currency) : "—"} />
            <Field label="University" value={<Link href={`/employee/universities/${course.university.id}`} className="text-primary hover:underline">{course.university.name}</Link>} />
            <Field label="City" value={course.university.city ?? "—"} />
            <Field label="Country" value={`${course.university.country.flag} ${course.university.country.name}`} />
            <Field label="Applications" value={String(course.applicationCount)} />
            <Field label="Active intakes" value={String(course.intakes.length)} />
          </dl>
          {course.description && (<><Separator className="my-4" /><p className="text-xs font-medium text-muted-foreground">Description</p><p className="mt-1 text-sm whitespace-pre-wrap">{course.description}</p></>)}
        </CardContent>
      </Card>
    </div>
  );
}

function IntakesTab({ course }: { course: CourseDetail }) {
  if (course.intakes.length === 0) return <EmptyCard label="No active intakes" />;
  const now = new Date();
  return (
    <Card>
      <CardHeader><CardTitle>Active intakes ({course.intakes.length})</CardTitle></CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-border">
          {course.intakes.map((i) => {
            const overdue = i.deadline && i.deadline < now;
            const closingSoon = i.deadline && !overdue && (i.deadline.getTime() - now.getTime()) < 14 * 24 * 60 * 60 * 1000;
            return (
              <li key={i.id} className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium">{i.name}</p>
                  <p className="text-xs text-muted-foreground">Start: {i.month}/{i.year}</p>
                </div>
                <div className="flex items-center gap-2">
                  {i.deadline ? (
                    <span className={cn("text-xs", overdue ? "font-medium text-destructive" : closingSoon ? "font-medium text-warning" : "text-muted-foreground")}>
                      Deadline: {formatDate(i.deadline)}
                    </span>
                  ) : <span className="text-xs text-muted-foreground">No deadline</span>}
                  {overdue ? <Badge tone="destructive">Expired</Badge> : closingSoon ? <Badge tone="warning">Closing soon</Badge> : <Badge tone="success">Upcoming</Badge>}
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

function RequirementsTab({ course }: { course: CourseDetail }) {
  const hasAny = course.academicRequirements || course.ieltsRequirement || course.toeflRequirement || course.pteRequirement;
  if (!hasAny) return <EmptyCard label="No requirements published" hint="Academic and English requirements will appear here when published." />;
  return (
    <div className="space-y-4">
      {course.academicRequirements && (
        <Card>
          <CardHeader><CardTitle>Academic requirements</CardTitle></CardHeader>
          <CardContent><p className="text-sm whitespace-pre-wrap">{course.academicRequirements}</p></CardContent>
        </Card>
      )}
      <Card>
        <CardHeader><CardTitle>English proficiency requirements</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid grid-cols-3 gap-4 text-sm">
            <Field label="IELTS" value={course.ieltsRequirement ?? "—"} />
            <Field label="TOEFL" value={course.toeflRequirement ?? "—"} />
            <Field label="PTE" value={course.pteRequirement ?? "—"} />
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyCard({ label, hint }: { label: string; hint?: string }) {
  return (<Card><CardContent className="p-8 text-center"><p className="text-sm font-medium">{label}</p>{hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}</CardContent></Card>);
}
function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (<div><dt className="text-xs font-medium text-muted-foreground">{label}</dt><dd className="mt-1 text-sm font-medium">{value}</dd></div>);
}
