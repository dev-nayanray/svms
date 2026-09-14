import { getSession } from "@/lib/auth/session";
import { TasksList } from "@/components/modules/tasks-list";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const sp = await searchParams;
  const session = await getSession();
  return (
    <>
      <h1 className="text-xl font-semibold">My Tasks</h1>
      <TasksList page={Number(sp.page ?? 1)} basePath="/employee/tasks" assignedToUserId={session.user.id} />
    </>
  );
}
