"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { PageHeader, LoadingState } from "@/components/shared/page-kit";
import { SectionCard, StatusBadge } from "@/components/admin/system/shared";
import { Button } from "@/components/ui";
import { Users, RefreshCw, Loader2 } from "lucide-react";

type Session = {
  userId: string;
  userName: string;
  userEmail: string;
  role: string;
  lastLoginAt: string | null;
  note: string;
};

type SessionsResponse = {
  window: string;
  sessions: Session[];
  count: number;
};

export function SessionsView() {
  const { data, isPending, refetch, isFetching } = useQuery({
    queryKey: ["/api/admin/system/sessions"],
    queryFn: () => apiFetch<SessionsResponse>("/api/admin/system/sessions?window=1h"),
    staleTime: 30 * 1000,
  });

  if (isPending) return <LoadingState label="Loading sessions…" />;
  if (!data) return <p className="text-destructive">Failed to load sessions.</p>;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Active Sessions"
        description="Users who signed in within the selected time window. JWT strategy — individual session revocation requires suspending the user."
        breadcrumbs={["Admin", "System Administration", "Sessions"]}
        actions={
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
        }
      />

      <SectionCard
        title={`Sessions (last ${data.window})`}
        description={`${data.count} active user(s). Approximated from User.lastLoginAt.`}
        actions={<Users className="h-4 w-4 text-muted-foreground" />}
      >
        {data.sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active sessions in this window.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="p-2 font-medium">User</th>
                  <th className="p-2 font-medium">Role</th>
                  <th className="p-2 font-medium">Last login</th>
                  <th className="p-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.sessions.map((s) => (
                  <tr key={s.userId} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="p-2">
                      <p className="font-medium">{s.userName}</p>
                      <p className="text-xs text-muted-foreground">{s.userEmail}</p>
                    </td>
                    <td className="p-2">
                      <StatusBadge
                        status={s.role === "ADMIN" ? "critical" : s.role === "EMPLOYEE" ? "warning" : "info"}
                        label={s.role}
                      />
                    </td>
                    <td className="p-2 text-xs">
                      {s.lastLoginAt ? new Date(s.lastLoginAt).toLocaleString("en-GB") : "—"}
                    </td>
                    <td className="p-2 text-xs text-muted-foreground">
                      Suspend via User Management → user is invalidated within 5 min (JWT revalidation)
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-3 rounded-md border border-info/30 bg-info/5 p-3 text-xs text-muted-foreground">
          <p className="font-medium">Why can&apos;t I revoke individual sessions?</p>
          <p className="mt-1">
            NextAuth v5 with JWT strategy doesn&apos;t store sessions server-side — the JWT is signed and
            stored in the user&apos;s browser cookie. To invalidate a session, suspend the user from
            User Management. The token revalidation check (every 5 minutes) will detect the
            suspension and force a re-login.
          </p>
        </div>
      </SectionCard>
    </div>
  );
}
