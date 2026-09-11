"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/page-kit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { StatusBadge, EmptyState } from "@/components/shared";
import { Button } from "@/components/ui";
import { apiFetch } from "@/lib/api-client";
import { PERMISSION_DESCRIPTIONS } from "@/lib/constants/permissions-meta";
import { ShieldCheck, Lock, Check, X } from "lucide-react";

type Role = {
  id: string;
  name: string;
  label: string;
  description: string;
  userCount: number;
};

type MatrixData = {
  data: Role[];
  matrix: Record<string, Record<string, boolean>>;
  roleNames: string[];
  groups: {
    key: string;
    label: string;
    icon: string;
    permissions: string[];
  }[];
};

/**
 * Admin Roles & Permissions — read-only permission matrix grouped by
 * category, with role list and descriptions.
 *
 * Security: the matrix is intentionally read-only. Runtime modification
 * of permissions is not exposed — changing which roles have which
 * permissions requires a code change + code review + redeploy. This
 * prevents privilege escalation via the database.
 */
export function RolesPermissionsAdmin() {
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  const { data, isPending, isError, error } = useQuery({
    queryKey: ["/api/roles"],
    queryFn: () => apiFetch<MatrixData>("/api/roles"),
    staleTime: 60_000,
  });

  const roles = data?.data ?? [];
  const matrix = data?.matrix ?? {};
  const roleNames = data?.roleNames ?? [];
  const groups = data?.groups ?? [];

  const selectedRoleData = selectedRole ? roles.find((r) => r.name === selectedRole) : null;

  return (
    <>
      <PageHeader
        title="Roles & Permissions"
        description="The centralized permission matrix — enforced server-side on every API request. Read-only by design."
        breadcrumbs={["Admin", "Roles & Permissions"]}
        actions={
          <div className="inline-flex items-center gap-1.5 rounded-md bg-muted px-3 py-1.5 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5" aria-hidden />
            Code-controlled (not runtime-editable)
          </div>
        }
      />

      {/* Security notice */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-start gap-3 p-4">
          <ShieldCheck className="h-5 w-5 shrink-0 text-primary" aria-hidden />
          <div className="text-sm">
            <p className="font-medium">Server-side enforcement</p>
            <p className="mt-0.5 text-muted-foreground">
              Every API route calls <code className="rounded bg-muted px-1 py-0.5 text-xs">guard(permission)</code> to
              verify the caller&apos;s role has the required permission. Frontend visibility is a
              UX convenience only — it never grants access. Privilege escalation via the database
              is prevented because the permission map lives in code, not in a mutable DB table.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Role list */}
      <div className="grid gap-4 lg:grid-cols-3">
        {isPending && (
          <>
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="space-y-2 p-4">
                  <div className="h-5 w-32 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-48 animate-pulse rounded bg-muted" />
                  <div className="h-8 w-20 animate-pulse rounded bg-muted" />
                </CardContent>
              </Card>
            ))}
          </>
        )}
        {!isPending &&
          roles.map((role) => (
            <Card
              key={role.id}
              className={selectedRole === role.name ? "border-primary ring-1 ring-primary/30" : ""}
            >
              <CardContent className="space-y-2 p-4">
                <div className="flex items-center justify-between">
                  <StatusBadge status={role.name} />
                  <span className="text-sm font-medium">{role.userCount} user{role.userCount === 1 ? "" : "s"}</span>
                </div>
                <p className="font-semibold">{role.label}</p>
                <p className="text-sm text-muted-foreground">{role.description}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setSelectedRole(selectedRole === role.name ? null : role.name)}
                >
                  {selectedRole === role.name ? "Hide permissions" : "View permissions"}
                </Button>
              </CardContent>
            </Card>
          ))}
      </div>

      {/* Selected role detail — shows which permissions this role has */}
      {selectedRoleData && (
        <Card>
          <CardHeader>
            <CardTitle>
              {selectedRoleData.label} — Permissions ({Object.entries(matrix).filter(([, roles]) => roles[selectedRoleData.name]).length} granted)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {groups.map((group) => {
                const granted = group.permissions.filter(
                  (key) => matrix[key]?.[selectedRoleData.name],
                );
                if (granted.length === 0) return null;
                return (
                  <div key={group.key} className="rounded-md border border-border p-3">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {group.label}
                    </p>
                    <ul className="space-y-1">
                      {granted.map((key) => (
                        <li key={key} className="flex items-center gap-2 text-sm">
                          <Check className="h-3.5 w-3.5 text-success" aria-hidden />
                          <span className="font-mono text-xs">{key}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Permission matrix grouped by category */}
      <Card>
        <CardHeader>
          <CardTitle>
            Permission Matrix ({Object.keys(matrix).length} permissions · {roleNames.length} roles)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isError ? (
            <EmptyState title="Failed to load" description={(error as Error).message} />
          ) : (
            <div className="space-y-6">
              {groups.map((group) => (
                <div key={group.key}>
                  <p className="mb-2 text-sm font-semibold">{group.label}</p>
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="px-4 py-2 font-medium">Permission</th>
                          <th className="px-4 py-2 font-medium">Description</th>
                          {roleNames.map((r) => (
                            <th key={r} className="px-4 py-2 text-center font-medium">
                              {r}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {group.permissions.map((key) => (
                          <tr key={key} className="hover:bg-muted/40">
                            <td className="px-4 py-2 font-mono text-xs">{key}</td>
                            <td className="px-4 py-2 text-xs text-muted-foreground">
                              {PERMISSION_DESCRIPTIONS[key] ?? "—"}
                            </td>
                            {roleNames.map((r) => (
                              <td key={r} className="px-4 py-2 text-center">
                                {matrix[key]?.[r] ? (
                                  <Check className="mx-auto h-4 w-4 text-success" aria-label="granted" />
                                ) : (
                                  <X className="mx-auto h-4 w-4 text-muted-foreground/40" aria-label="denied" />
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="mt-4 text-xs text-muted-foreground">
            The matrix lives in <code className="rounded bg-muted px-1 py-0.5">lib/permissions/index.ts</code> and is
            the single source of truth for API guards (<code className="rounded bg-muted px-1 py-0.5">guard()</code>) and
            UI gating (<code className="rounded bg-muted px-1 py-0.5">hasPermission()</code>). Editing it requires a code
            change by design — permission changes are security-sensitive and must go through code review.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
