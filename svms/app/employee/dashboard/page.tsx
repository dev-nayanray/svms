import { redirect } from "next/navigation";

/** /employee/dashboard is an alias for /employee — both render the dashboard. */
export default function EmployeeDashboardRedirect() {
  redirect("/employee");
}
