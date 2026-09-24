import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, BookOpen, CalendarClock,
  FolderKanban, ExternalLink, MapPin, Star,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { EmployeePageHeader } from "@/components/employee/ui";
import { Card, CardContent, CardHeader, CardTitle, Badge, Separator } from "@/components/ui";
import { Tabs, TabsContent } from "@/components/ui/overlays";
import { formatDate, formatMoney, titleCase, cn } from "@/lib/utils";
import { requireUniversity, type UniversityDetail } from "@/lib/services/university-cases";

export const dynamic = "force-dynamic";

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "courses", label: "Courses" },
  { value: "intakes", label: "Intakes" },
  { value: "requirements", label: "Requirements" },
  { value: "applications", label: "Active Applications" },
] as const;

export default async function EmployeeUniversityDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/employee/universities");
  const role = (session.user as { role?: string }).role;
  if (role !== "EMPLOYEE" && role !== "ADMIN") redirect("/403");

  const { id } = await params;
  let uni: UniversityDetail;
  try {
    uni = await requireUniversity(id);
  } catch {
    notFound();
  }

  const sp = await searchParams;
  const activeTab = TABS.some((t) => t.value === sp.tab) ? sp.tab! : "overview";

  return (
    <div>
      <Link href="/employee/universities" className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" aria-hidden /> Back to Universities
      </Link>

      <EmployeePageHeader
        title={uni.name}
        description={`${uni.country?.flag ?? ""} ${uni.country?.name ?? "—"} · ${uni.city ?? "—"}${uni.ranking ? ` · Ranking #${uni.ranking}` : ""}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={uni.status === "ACTIVE" ? "success" : "default"}>{titleCase(uni.status)}</Badge>
            {uni.website && (
              <a href={uni.website} target="_blank" rel="noopener noreferrer">
                <Badge tone="info"><ExternalLink className="h-3 w-3" aria-hidden /> Website</Badge>
              </a>
            )}
          </div>
        }
      />

      <Tabs tabs={TABS.map((t) => ({ value: t.value, label: t.label }))} defaultValue={activeTab}>
        <div className="mt-4">
          <TabsContent value="overview"><OverviewTab uni={uni} /></TabsContent>
          <TabsContent value="courses"><CoursesTab uni={uni} /></TabsContent>
          <TabsContent value="intakes"><IntakesTab uni={uni} /></TabsContent>
          <TabsContent value="requirements"><RequirementsTab uni={uni} /></TabsContent>
          <TabsContent value="applications"><ApplicationsTab uni={uni} /></TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

function OverviewTab({ uni }: { uni: UniversityDetail }) {
  const totalCourses = uni.courses.length;
  const totalIntakes = uni.courses.reduce((s, c) => s + c.intakes.length, 0);
  const totalApps = uni.courses.reduce((s, c) => s + c._count.applications, 0);
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>University information</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <Field label="Name" value={uni.name} />
            <Field label="Country" value={`${uni.country?.flag ?? ""} ${uni.country?.name ?? "—"}`} />
            <Field label="City" value={uni.city ?? "—"} icon={<MapPin className="h-3.5 w-3.5" />} />
            <Field label="Ranking" value={uni.ranking ? `#${uni.ranking}` : "—"} icon={<Star className="h-3.5 w-3.5" />} />
            <Field label="Status" value={<Badge tone={uni.status === "ACTIVE" ? "success" : "default"}>{titleCase(uni.status)}</Badge>} />
            <Field label="Website" value={uni.website ? <a href={uni.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{uni.website}</a> : "—"} />
            <Field label="Created" value={formatDate(uni.createdAt)} />
            <Field label="Last update" value={formatDate(uni.updatedAt)} />
          </dl>
          {uni.description && (<><Separator className="my-4" /><p className="text-xs font-medium text-muted-foreground">Description</p><p className="mt-1 text-sm whitespace-pre-wrap">{uni.description}</p></>)}
        </CardContent>
      </Card>
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Courses" value={totalCourses} icon={<BookOpen className="h-4 w-4" />} />
        <StatCard label="Active intakes" value={totalIntakes} icon={<CalendarClock className="h-4 w-4" />} />
        <StatCard label="Applications" value={totalApps} icon={<FolderKanban className="h-4 w-4" />} />
      </div>
    </div>
  );
}

function CoursesTab({ uni }: { uni: UniversityDetail }) {
  if (uni.courses.length === 0) return <EmptyCard label="No courses available" />;
  return (
    <Card>
      <CardHeader><CardTitle>Courses ({uni.courses.length})</CardTitle></CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-border">
          {uni.courses.map((c) => (
            <li key={c.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{titleCase(c.degreeLevel)} · {c.duration ?? "—"} · {c.tuitionFee != null ? formatMoney(c.tuitionFee, c.currency) : "Tuition on request"}</p>
                  {c.description && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{c.description}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge tone="info">{c.intakes.length} intake{c.intakes.length === 1 ? "" : "s"}</Badge>
                  <Badge tone="default">{c._count.applications} app{c._count.applications === 1 ? "" : "s"}</Badge>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function IntakesTab({ uni }: { uni: UniversityDetail }) {
  const allIntakes = uni.courses.flatMap((c) => c.intakes.map((i) => ({ ...i, courseName: c.name }))).sort((a, b) => (a.year - b.year) || (a.month - b.month));
  if (allIntakes.length === 0) return <EmptyCard label="No active intakes" />;
  return (
    <Card>
      <CardHeader><CardTitle>Active intakes ({allIntakes.length})</CardTitle></CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-border">
          {allIntakes.map((i) => {
            const overdue = i.deadline && i.deadline < new Date();
            return (
              <li key={i.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-medium">{i.name}</p>
                  <p className="text-xs text-muted-foreground">{i.courseName} · {i.month}/{i.year}</p>
                </div>
                <div className="flex items-center gap-2">
                  {i.deadline ? <span className={cn("text-xs", overdue ? "font-medium text-destructive" : "text-muted-foreground")}>Deadline: {formatDate(i.deadline)}</span> : <span className="text-xs text-muted-foreground">No deadline</span>}
                  <Badge tone={overdue ? "destructive" : "success"}>{titleCase(i.status)}</Badge>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

function RequirementsTab({ uni }: { uni: UniversityDetail }) {
  const coursesWithDetails = uni.courses.filter((c) => c.description);
  if (coursesWithDetails.length === 0) return <EmptyCard label="No course requirements published" hint="Course-level requirements appear here when course descriptions include academic and English requirements." />;
  return (
    <Card>
      <CardHeader><CardTitle>Course requirements</CardTitle></CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-border">
          {coursesWithDetails.map((c) => (
            <li key={c.id} className="p-4">
              <p className="font-medium">{c.name} <span className="text-xs text-muted-foreground">· {titleCase(c.degreeLevel)}</span></p>
              <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap">{c.description}</p>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function ApplicationsTab({ uni }: { uni: UniversityDetail }) {
  if (uni.applications.length === 0) return <EmptyCard label="No active applications" />;
  return (
    <Card>
      <CardHeader><CardTitle>Active applications ({uni.applications.length})</CardTitle></CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-border">
          {uni.applications.map((app) => (
            <li key={app.id} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <Link href={`/employee/applications/${app.id}`} className="font-medium hover:underline">{app.applicationNumber}</Link>
                <p className="text-xs text-muted-foreground">{app.student.firstName} {app.student.lastName} · {app.student.studentId}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone="info">{titleCase(app.stageKey)}</Badge>
                <Badge tone={app.status === "COMPLETED" ? "success" : "default"}>{titleCase(app.status)}</Badge>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function EmptyCard({ label, hint }: { label: string; hint?: string }) {
  return (<Card><CardContent className="p-8 text-center"><p className="text-sm font-medium">{label}</p>{hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}</CardContent></Card>);
}
function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (<Card><CardContent className="p-4"><div className="flex items-center gap-2 text-muted-foreground">{icon}<p className="text-xs font-medium uppercase tracking-wide">{label}</p></div><p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p></CardContent></Card>);
}
function Field({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return (<div><dt className="flex items-center gap-1 text-xs font-medium text-muted-foreground">{icon}{label}</dt><dd className="mt-1 text-sm font-medium">{value}</dd></div>);
}
