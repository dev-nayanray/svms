import { UniversitiesList } from "@/components/modules/universities-list";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string; search?: string }> }) {
  const sp = await searchParams;
  return (
    <>
      <h1 className="text-xl font-semibold">Universities</h1>
      <UniversitiesList page={Number(sp.page ?? 1)} search={sp.search} basePath="/employee/universities" />
    </>
  );
}
