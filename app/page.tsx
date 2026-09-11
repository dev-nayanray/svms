import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";

export default async function Home() {
  const session = await getSession();
  const role = session.user.role;
  redirect(role === "ADMIN" ? "/admin" : role === "EMPLOYEE" ? "/employee" : "/student");
}
