import { AppointmentDetail } from "@/components/admin/appointment-detail";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AppointmentDetail id={id} />;
}
