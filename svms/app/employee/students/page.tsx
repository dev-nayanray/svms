import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { EmployeePageHeader } from "@/components/employee/ui";
import { Card, CardContent, Badge, Button } from "@/components/ui";
import { formatDate, titleCase } from "@/lib/utils";
import { Eye } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function EmployeeStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/employee/students");
  const role = (session.user as { role?: string }).role;
  if (role !== "EMPLOYEE" && role !== "ADMIN") redirect("/403");

  const sp = await searchParams;
  const search = sp.search?.trim() || undefined;
  const status = sp.status || undefined;

  // Case ownership: EMPLOYEE sees only their assigned students. ADMIN sees all.
  const isAdmin = role === "ADMIN";
  const ownerFilter = { assignedEmployee: { userId: session.user.id } };
  const searchFilter = search
    ? {
        OR: [
          { firstName: { contains: search, mode: "insensitive" as const } },
          { lastName: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
          { studentId: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};
  const statusFilter = status ? { status } : {};
  const where = isAdmin
    ? { ...statusFilter, ...searchFilter }
    : { ...ownerFilter, ...statusFilter, ...searchFilter };

  const students = await prisma.student.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      studentId: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      country: true,
      status: true,
      createdAt: true,
    },
  });

  return (
    <div>
      <EmployeePageHeader
        title="My Students"
        description={isAdmin ? "All students across the platform." : "Students assigned to you for case management."}
      />

      <Card>
        <CardContent className="p-0">
          {students.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              No students found. {search && "Try a different search."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/30">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Student</th>
                    <th className="hidden px-4 py-2.5 text-left font-medium text-muted-foreground md:table-cell">Student ID</th>
                    <th className="hidden px-4 py-2.5 text-left font-medium text-muted-foreground md:table-cell">Country</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Status</th>
                    <th className="hidden px-4 py-2.5 text-left font-medium text-muted-foreground md:table-cell">Created</th>
                    <th className="px-4 py-2.5 text-right font-medium text-muted-foreground"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {students.map((s) => (
                    <tr key={s.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <p className="font-medium">{s.firstName} {s.lastName}</p>
                        <p className="text-xs text-muted-foreground">{s.email}</p>
                      </td>
                      <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{s.studentId}</td>
                      <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{s.country ?? "—"}</td>
                      <td className="px-4 py-3"><Badge tone="info">{titleCase(s.status)}</Badge></td>
                      <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{formatDate(s.createdAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/employee/students/${s.id}`}>
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
