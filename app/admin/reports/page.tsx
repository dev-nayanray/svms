import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { SimpleBarChart, SimplePieChart } from "@/components/charts";
import { EmptyState } from "@/components/shared";
import { titleCase } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [byCountryRaw, byStageRaw, countries] = await Promise.all([
    prisma.application.groupBy({ by: ["countryId"], where: { deletedAt: null }, _count: { _all: true } }),
    prisma.application.groupBy({ by: ["stageKey"], where: { deletedAt: null }, _count: { _all: true } }),
    prisma.country.findMany(),
  ]);
  const name = (id: string) => countries.find((c) => c.id === id)?.name ?? "Unknown";
  const byCountry = byCountryRaw.map((r) => ({ name: name(r.countryId), value: r._count._all }));
  const byStage = byStageRaw.map((r) => ({ name: titleCase(r.stageKey), value: r._count._all }));
  return (
    <>
      <h1 className="text-xl font-semibold">Reports</h1>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Applications by Country</CardTitle></CardHeader>
          <CardContent>{byCountry.length ? <SimplePieChart data={byCountry} /> : <EmptyState title="No data" />}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Applications by Stage</CardTitle></CardHeader>
          <CardContent>{byStage.length ? <SimpleBarChart data={byStage} /> : <EmptyState title="No data" />}</CardContent>
        </Card>
      </div>
    </>
  );
}
