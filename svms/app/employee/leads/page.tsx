import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { EmployeePageHeader } from "@/components/employee/ui";
import { Card, CardContent, Badge, Button } from "@/components/ui";
import { formatDate, titleCase } from "@/lib/utils";
import { Eye } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function EmployeeLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/employee/leads");
  const role = (session.user as { role?: string }).role;
  if (role !== "EMPLOYEE" && role !== "ADMIN") redirect("/403");

  const sp = await searchParams;
  const search = sp.search?.trim() || undefined;
  const status = sp.status || undefined;

  // Case ownership: EMPLOYEE sees only leads assigned to them. ADMIN sees all.
  const isAdmin = role === "ADMIN";
  const ownerFilter = { assignedEmployee: { userId: session.user.id } };
  const searchFilter = search
    ? { OR: [{ name: { contains: search, mode: "insensitive" as const } }, { email: { contains: search, mode: "insensitive" as const } }] }
    : {};
  const statusFilter = status ? { status } : {};
  const where = isAdmin
    ? { ...statusFilter, ...searchFilter }
    : { ...ownerFilter, ...statusFilter, ...searchFilter };

  const leads = await prisma.lead.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div>
      <EmployeePageHeader
        title="My Leads"
        description={role === "ADMIN" ? "All leads across the platform." : "Leads assigned to you for follow-up."}
      />
      <Card>
        <CardContent className="p-0">
          {leads.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">No leads found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/30">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Name</th>
                    <th className="hidden px-4 py-2.5 text-left font-medium text-muted-foreground md:table-cell">Contact</th>
                    <th className="hidden px-4 py-2.5 text-left font-medium text-muted-foreground md:table-cell">Interested in</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Status</th>
                    <th className="hidden px-4 py-2.5 text-left font-medium text-muted-foreground md:table-cell">Created</th>
                    <th className="px-4 py-2.5 text-right font-medium text-muted-foreground"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {leads.map((l) => (
                    <tr key={l.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{l.name}</td>
                      <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                        {l.email ?? l.phone ?? "—"}
                      </td>
                      <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{l.interestedCountry ?? "—"}</td>
                      <td className="px-4 py-3"><Badge tone={l.status === "CONVERTED" ? "success" : l.status === "LOST" ? "destructive" : "info"}>{titleCase(l.status)}</Badge></td>
                      <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{formatDate(l.createdAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/employee/leads/${l.id}`}>
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
