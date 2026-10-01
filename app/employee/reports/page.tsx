import { ReportsAdmin } from "@/components/admin/reports-admin";
import { PageHeader } from "@/components/shared/page-kit";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <>
      <PageHeader
        title="Reports"
        description="Operational reports across students, leads, applications, and visa pipelines."
        breadcrumbs={["Employee", "Reports"]}
      />
      <ReportsAdmin />
    </>
  );
}
