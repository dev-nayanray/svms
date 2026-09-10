import { redirect } from "next/navigation";

/** /student/application is an alias of the applications overview. */
export default function StudentApplicationRedirect() {
  redirect("/student/applications");
}
