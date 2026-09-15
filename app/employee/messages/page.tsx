import { MessagingAdmin } from "@/components/admin/messaging-admin";
import { PageHeader } from "@/components/shared/page-kit";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <>
      <PageHeader
        title="Messages"
        description="Your conversations with students."
        breadcrumbs={["Employee", "Messages"]}
      />
      <MessagingAdmin />
    </>
  );
}
