import { getSession } from "@/lib/auth/session";
import { ApplicationsList } from "@/components/modules/applications-list";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const sp = await searchParams;
  const session = await getSession();
  return (
    <>
      <h1 className="text-xl font-semibold">My Applications</h1>
      <ApplicationsList
        page={Number(sp.page ?? 1)}
        basePath="/student/applications"
        studentUserId={session.user.id}
      />
    </>
  );
}
