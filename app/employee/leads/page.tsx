import { LeadsList } from "@/components/modules/leads-list";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string; search?: string; status?: string }> }) {
  const sp = await searchParams;
  return (
    <>
      <h1 className="text-xl font-semibold">Leads</h1>
      <LeadsList page={Number(sp.page ?? 1)} search={sp.search} status={sp.status} basePath="/employee/leads" />
    </>
  );
}
