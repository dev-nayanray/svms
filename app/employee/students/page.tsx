import { getSession } from "@/lib/auth/session";
import { StudentsList } from "@/components/modules/students-list";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string; search?: string; status?: string }> }) {
  const sp = await searchParams;
  const session = await getSession();
  return (
    <>
      <h1 className="text-xl font-semibold">My Students</h1>
      <StudentsList
        page={Number(sp.page ?? 1)}
        search={sp.search}
        status={sp.status}
        basePath="/employee/students"
        employeeUserId={session.user.id}
      />
    </>
  );
}
