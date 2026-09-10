import { prisma } from "@/lib/db";
import { PERMISSIONS } from "@/lib/permissions";
import { PageHeader } from "@/components/shared/page-kit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { StatusBadge, TableShell } from "@/components/shared";

export const dynamic = "force-dynamic";

export default async function RolesPage() {
  const roles = await prisma.role.findMany({
    include: { _count: { select: { users: true } } },
    orderBy: { name: "asc" },
  });

  const permissionKeys = Object.keys(PERMISSIONS);
  const roleNames = roles.map((r) => r.name);

  return (
    <>
      <PageHeader
        title="Roles & Permissions"
        description="Roles and the centralized permission matrix enforced server-side."
        breadcrumbs={["Admin", "Roles & Permissions"]}
      />

      <Card>
        <CardHeader>
          <CardTitle>Roles</CardTitle>
        </CardHeader>
        <CardContent>
          <TableShell headers={["Role", "Description", "Users"]}>
            {roles.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2.5">
                  <StatusBadge status={r.name} />
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">{r.description ?? "—"}</td>
                <td className="px-4 py-2.5">{r._count.users}</td>
              </tr>
            ))}
          </TableShell>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Permission Matrix ({permissionKeys.length} permissions)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Permission</th>
                  {roleNames.map((r) => (
                    <th key={r} className="px-4 py-2 text-center font-medium">{r}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {permissionKeys.map((key) => (
                  <tr key={key} className="hover:bg-muted/40">
                    <td className="px-4 py-2 font-mono text-xs">{key}</td>
                    {roleNames.map((r) => (
                      <td key={r} className="px-4 py-2 text-center">
                        {(PERMISSIONS[key as keyof typeof PERMISSIONS] as readonly string[]).includes(r) ? (
                          <span className="text-success" aria-label="granted">✓</span>
                        ) : (
                          <span className="text-muted-foreground" aria-label="denied">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            The matrix lives in <code>lib/permissions/index.ts</code> and is the single source of truth
            for API guards and UI gating. Editing it requires a code change by design (permission
            changes are security-sensitive).
          </p>
        </CardContent>
      </Card>
    </>
  );
}
