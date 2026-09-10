import { TasksList } from "@/components/modules/tasks-list";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <>
      <h1 className="text-xl font-semibold">My Tasks</h1>
      <TasksList basePath="/student/tasks" />
    </>
  );
}
