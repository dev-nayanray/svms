import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/shared/page-kit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { StatusBadge, TableShell, EmptyState } from "@/components/shared";
import { formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function UniversityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const university = await prisma.university.findFirst({
    where: { id, deletedAt: null },
    include: { country: true, courses: { where: { deletedAt: null }, orderBy: { name: "asc" } } },
  });
  if (!university) notFound();

  const applicationCount = await prisma.application.count({
    where: { universityId: university.id, deletedAt: null },
  });

  return (
    <>
      <PageHeader
        title={university.name}
        description={`${university.country.name}${university.website ? ` · ${university.website}` : ""}`}
        breadcrumbs={["Admin", "Universities", university.name]}
        actions={<StatusBadge status={university.status} />}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          ["Ranking", university.ranking ? `#${university.ranking}` : "—"],
          ["Application Fee", university.applicationFee ? `$${university.applicationFee}` : "—"],
          ["Courses", university.courses.length],
          ["Applications", applicationCount],
        ].map(([label, value]) => (
          <Card key={String(label)}>
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
              <p className="mt-1 text-2xl font-semibold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {university.description && (
        <Card>
          <CardHeader><CardTitle>About</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">{university.description}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Courses</CardTitle></CardHeader>
        <CardContent>
          {university.courses.length === 0 ? <EmptyState title="No courses for this university" /> : (
            <TableShell headers={["Course", "Level", "Tuition", "English Req."]}>
              {university.courses.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-2.5 font-medium">{c.name}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{c.degreeLevel}</td>
                  <td className="px-4 py-2.5">{formatMoney(c.tuitionFee ?? undefined, c.currency)}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{c.englishRequirements ?? "—"}</td>
                </tr>
              ))}
            </TableShell>
          )}
        </CardContent>
      </Card>
    </>
  );
}
