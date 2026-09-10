import { getSession } from "@/lib/auth/session";
import { InvoicesList } from "@/components/modules/invoices-list";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await getSession();
  return (
    <>
      <h1 className="text-xl font-semibold">My Invoices</h1>
      <InvoicesList basePath="/student/invoices" studentUserId={session.user.id} />
    </>
  );
}
