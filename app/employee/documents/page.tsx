import { DocumentsList } from "@/components/modules/documents-list";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string; status?: string }> }) {
  const sp = await searchParams;
  return (
    <>
      <h1 className="text-xl font-semibold">Documents</h1>
      <DocumentsList
        page={Number(sp.page ?? 1)}
        status={sp.status}
        basePath="/employee/documents"
        canReview
      />
    </>
  );
}
