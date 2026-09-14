import { IntakesAdmin } from "@/components/admin/intakes-admin";
import { PageHeader } from "@/components/shared/page-kit";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <>
      <PageHeader
        title="Intakes"
        description="Browse university intakes to find the right intake window for your students."
        breadcrumbs={["Employee", "Intakes"]}
      />
      <IntakesAdmin />
    </>
  );
}
