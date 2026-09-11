import { NotificationsList } from "@/components/modules/notifications-list";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <>
      <h1 className="text-xl font-semibold">Notifications</h1>
      <NotificationsList />
    </>
  );
}
