import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { EmployeePageHeader, ComingSoonCard } from "@/components/employee/ui";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui";
import { formatDate, titleCase } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function EmployeeLeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/employee/leads");
  const role = (session.user as { role?: string }).role;
  if (role !== "EMPLOYEE" && role !== "ADMIN") redirect("/403");

  const { id } = await params;
  // Case ownership: foreign leads return 404.
  const isAdmin = role === "ADMIN";
  const lead = isAdmin
    ? await prisma.lead.findFirst({ where: { id } })
    : await prisma.lead.findFirst({ where: { id, assignedEmployee: { userId: session.user.id } } });

  if (!lead) notFound();

  return (
    <div>
      <EmployeePageHeader title={lead.name} description={`Lead · ${titleCase(lead.status)}`} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Lead information</CardTitle></CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <Field label="Name" value={lead.name} />
              <Field label="Email" value={lead.email ?? "—"} />
              <Field label="Phone" value={lead.phone ?? "—"} />
              <Field label="Interested in" value={lead.interestedCountry ?? "—"} />
              <Field label="Source" value={lead.source ? titleCase(lead.source) : "—"} />
              <Field label="Status" value={<Badge tone="info">{titleCase(lead.status)}</Badge>} />
              <Field label="Created" value={formatDate(lead.createdAt)} />
              <Field label="Updated" value={formatDate(lead.updatedAt)} />
            </dl>
            {lead.notes && (
              <div className="mt-4 border-t border-border pt-4">
                <p className="text-xs font-medium text-muted-foreground">Notes</p>
                <p className="mt-1 text-sm whitespace-pre-wrap">{lead.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Follow-up</CardTitle></CardHeader>
          <CardContent>
            <ComingSoonCard title="Convert to student" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-medium">{value}</dd>
    </div>
  );
}
