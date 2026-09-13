import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { EmployeePageHeader } from "@/components/employee/ui";
import { Card, CardContent, Badge } from "@/components/ui";
import { formatMoney, titleCase } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function EmployeeCoursesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/employee/courses");
  const role = (session.user as { role?: string }).role;
  if (role !== "EMPLOYEE" && role !== "ADMIN") redirect("/403");

  const courses = await prisma.course.findMany({
    where: { status: "ACTIVE" },
    orderBy: { name: "asc" },
    take: 50,
    include: { university: { select: { name: true } } },
  });

  return (
    <div>
      <EmployeePageHeader title="Courses" description="European study programs in the catalog." />
      {courses.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No courses in the catalog yet.</CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {courses.map((c) => (
            <Card key={c.id}>
              <CardContent className="p-5">
                <p className="font-semibold">{c.name}</p>
                <p className="text-xs text-muted-foreground">{c.university?.name ?? "—"}</p>
                <div className="mt-2 flex items-center gap-2">
                  <Badge tone="info">{titleCase(c.degreeLevel)}</Badge>
                  {c.duration && <span className="text-xs text-muted-foreground">{c.duration}</span>}
                </div>
                <p className="mt-2 text-sm font-medium">
                  {c.tuitionFee != null ? formatMoney(c.tuitionFee, c.currency) : "Tuition on request"}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
