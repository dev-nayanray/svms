import { VisaApplicationsAdmin } from "@/components/admin/visa-applications-admin";
import { PageHeader } from "@/components/shared/page-kit";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <>
      <PageHeader
        title="Visa"
        description="Track visa applications for your students through preparation, submission, biometrics, interview, and decision."
        breadcrumbs={["Employee", "Visa"]}
      />
      <VisaApplicationsAdmin />
    </>
  );
}
