import { InvoicesAdmin } from "@/components/admin/invoices-admin";
import { PageHeader } from "@/components/shared/page-kit";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <>
      <PageHeader
        title="Invoices"
        description="Student invoices and payment progress (read-only — issuing invoices is an admin action)."
        breadcrumbs={["Employee", "Invoices"]}
      />
      <InvoicesAdmin basePath="/employee/invoices" />
    </>
  );
}
