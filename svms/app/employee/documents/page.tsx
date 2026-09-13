import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { EmployeePageHeader } from "@/components/employee/ui";
import { Card, CardContent, Badge } from "@/components/ui";
import { formatDate, titleCase } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, "default" | "success" | "warning" | "destructive" | "info"> = {
  REQUESTED: "warning",
  UPLOADED: "info",
  UNDER_REVIEW: "info",
  APPROVED: "success",
  REJECTED: "destructive",
};

export default async function EmployeeDocumentsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/employee/documents");
  const role = (session.user as { role?: string }).role;
  if (role !== "EMPLOYEE" && role !== "ADMIN") redirect("/403");

  // Case ownership: EMPLOYEE sees documents on students assigned to them.
  const isAdmin = role === "ADMIN";
  const where = isAdmin ? {} : { student: { assignedEmployee: { userId: session.user.id } } };

  const documents = await prisma.document.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { student: { select: { firstName: true, lastName: true, studentId: true } } },
  });

  return (
    <div>
      <EmployeePageHeader
        title="Documents"
        description="Review and track documents across your assigned students."
      />
      <Card>
        <CardContent className="p-0">
          {documents.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">No documents yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/30">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Document</th>
                    <th className="hidden px-4 py-2.5 text-left font-medium text-muted-foreground md:table-cell">Student</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Status</th>
                    <th className="hidden px-4 py-2.5 text-left font-medium text-muted-foreground md:table-cell">Uploaded</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {documents.map((d) => (
                    <tr key={d.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{d.name}</td>
                      <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                        {d.student.firstName} {d.student.lastName}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={STATUS_TONE[d.status] ?? "default"}>{titleCase(d.status)}</Badge>
                      </td>
                      <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                        {d.uploadedAt ? formatDate(d.uploadedAt) : "—"}
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
