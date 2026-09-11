import { getSession } from "@/lib/auth/session";
import { TasksList } from "@/components/modules/tasks-list";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await getSession();
  // Students should only see tasks assigned to them
  return (
    <>
      <h1 className="text-xl font-semibold">My Tasks</h1>
      <TasksList basePath="/student/tasks" assignedToUserId={session.user.id} />
    </>
  );
}
