import { SupportAdmin as SupportEmployee } from "@/components/admin/support-admin";

export const dynamic = "force-dynamic";

/**
 * Employee Support — reuses the same admin component since the API
 * works for any authenticated admin/employee. Employees can view,
 * respond to, and resolve support requests.
 */
export default function Page() {
  return <SupportEmployee />;
}
