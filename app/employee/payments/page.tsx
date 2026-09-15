import { PaymentsAdmin } from "@/components/admin/payments-admin";
import { PageHeader } from "@/components/shared/page-kit";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <>
      <PageHeader
        title="Payments"
        description="Payments recorded against student invoices (read-only — recording payments is an admin action)."
        breadcrumbs={["Employee", "Payments"]}
      />
      <PaymentsAdmin />
    </>
  );
}
