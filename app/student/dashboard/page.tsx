import { redirect } from "next/navigation";

/** /student/dashboard is an alias of the student home screen. */
export default function StudentDashboardRedirect() {
  redirect("/student");
}
