import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { EmployeePageHeader } from "@/components/employee/ui";
import { Card, CardContent, Badge, Button } from "@/components/ui";
import { formatDate, titleCase } from "@/lib/utils";
import { Eye } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function EmployeeApplicationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/employee/applications");
  const role = (session.user as { role?: string }).role;
  if (role !== "EMPLOYEE" && role !== "ADMIN") redirect("/403");

  // Case ownership: EMPLOYEE sees applications on students assigned to them.
  const isAdmin = role === "ADMIN";
  const where = isAdmin ? {} : { student: { assignedEmployee: { userId: session.user.id } } };

  const applications = await prisma.application.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      student: { select: { firstName: true, lastName: true, studentId: true } },
      country: { select: { name: true } },
    },
  });

  return (
    <div>
      <EmployeePageHeader
        title="My Applications"
        description={role === "ADMIN" ? "All applications across the platform." : "Applications for students assigned to you."}
      />
      <Card>
        <CardContent className="p-0">
          {applications.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">No applications found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/30">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Application #</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Student</th>
                    <th className="hidden px-4 py-2.5 text-left font-medium text-muted-foreground md:table-cell">Country</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Stage</th>
                    <th className="hidden px-4 py-2.5 text-left font-medium text-muted-foreground md:table-cell">Created</th>
                    <th className="px-4 py-2.5 text-right font-medium text-muted-foreground"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {applications.map((a) => (
                    <tr key={a.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{a.applicationNumber}</td>
                      <td className="px-4 py-3">
                        {a.student.firstName} {a.student.lastName}
                        <p className="text-xs text-muted-foreground">{a.student.studentId}</p>
                      </td>
                      <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{a.country?.name ?? "—"}</td>
                      <td className="px-4 py-3"><Badge tone="info">{titleCase(a.stageKey)}</Badge></td>
                      <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{formatDate(a.createdAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/employee/applications/${a.id}`}>
                          <Button variant="ghost" size="sm">
                            <Eye className="h-3.5 w-3.5" aria-hidden /> View
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
