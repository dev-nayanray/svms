import type { Metadata } from "next";
import { UsersListView } from "@/components/admin/users-list-view";

export const metadata: Metadata = {
  title: "User Management",
  description: "Manage all users — admins, employees, and students.",
};

export const dynamic = "force-dynamic";

export default function AdminUsersPage() {
  return <UsersListView />;
}
