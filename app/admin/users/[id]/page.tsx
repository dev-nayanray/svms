import type { Metadata } from "next";
import { UserDetailView } from "@/components/admin/user-detail-view";

export const metadata: Metadata = { title: "User Details" };
export const dynamic = "force-dynamic";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <UserDetailView userId={id} />;
}
