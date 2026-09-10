import { NotificationsCenter } from "@/components/admin/notifications-center";
import { PageHeader } from "@/components/shared/page-kit";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <>
      <PageHeader
        title="Notifications"
        description="System notifications — document events, application changes, task assignments, payment alerts, and messages."
        breadcrumbs={["Admin", "Notifications"]}
      />
      <NotificationsCenter />
    </>
  );
}
