import { ApplicationDetail } from "@/components/modules/application-detail";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ApplicationDetail id={id} basePath="/employee/applications" canManage />;
}
