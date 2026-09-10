import { NotificationsList } from "@/components/modules/notifications-list";
import { PageHeader } from "@/components/shared/page-kit";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <>
      <PageHeader
        title="Notifications"
        description="Your system notifications."
        breadcrumbs={["Admin", "Notifications"]}
      />
      <NotificationsList />
    </>
  );
}
