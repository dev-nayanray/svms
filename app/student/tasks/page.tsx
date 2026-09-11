import type { Metadata } from "next";
import { TasksView } from "@/components/student/tasks/tasks-view";

export const metadata: Metadata = {
  title: "My Tasks",
  description: "Track your assigned tasks, deadlines, and progress.",
};

export const dynamic = "force-dynamic";

/**
 * Module 10 — Tasks & Deadlines (/student/tasks)
 *
 * Server component renders the client-side TasksView. Identity and
 * ownership are enforced at the layout level (StudentLayout →
 * requireStudentProfile) and at the API level (studentApiGuard in
 * every /api/student/tasks* route).
 *
 * Students can view their assigned tasks and change status to
 * IN_PROGRESS or COMPLETED — they CANNOT change title, description,
 * priority, dueDate, or cancel a task. The PATCH endpoint rejects
 * any field other than `status`, and only allows IN_PROGRESS or
 * COMPLETED.
 */
export default function TasksPage() {
  return <TasksView />;
}
