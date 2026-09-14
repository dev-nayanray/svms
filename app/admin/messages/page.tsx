import { MessagingAdmin } from "@/components/admin/messaging-admin";
import { PageHeader } from "@/components/shared/page-kit";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <>
      <PageHeader
        title="Messages"
        description="Student ↔ counselor conversations with supervisory visibility for admins."
        breadcrumbs={["Admin", "Messages"]}
      />
      <MessagingAdmin />
    </>
  );
}
