"use client";

import { VisaApplicationsAdmin } from "@/components/admin/visa-applications-admin";
import { PageHeader } from "@/components/shared/page-kit";
import { Tabs, TabsContent } from "@/components/ui/overlays";
import { RequirementsAdmin } from "./requirements-admin";

export const dynamic = "force-dynamic";

export default function VisaPage() {
  return (
    <>
      <PageHeader
        title="Visa Management"
        description="Track visa applications through preparation, submission, biometrics, interview, and decision. Configure per-country requirements."
        breadcrumbs={["Admin", "Visa Management"]}
      />
      <Tabs
        tabs={[
          { value: "apps", label: "Visa Applications" },
          { value: "reqs", label: "Requirements" },
        ]}
      >
        <TabsContent value="apps" className="pt-4">
          <VisaApplicationsAdmin />
        </TabsContent>
        <TabsContent value="reqs" className="pt-4">
          <RequirementsAdmin />
        </TabsContent>
      </Tabs>
    </>
  );
}
