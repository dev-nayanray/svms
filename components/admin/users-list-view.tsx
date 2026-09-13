"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/shared/page-kit";
import { Skeleton } from "@/components/ui/overlays";
import { Search, RefreshCw, Users as UsersIcon, Shield, GraduationCap, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils";
import Link from "next/link";

type UserRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  roleName: string;
  status: string;
  lastLoginAt: string | null;
  createdAt: string;
  student?: { id: string; studentId: string; firstName: string; lastName: string; profilePhotoUrl: string | null } | null;
  employee?: { id: string; title: string } | null;
  branch?: { id: string; name: string } | null;
};

type Response = {
  users: UserRow[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

const STATUS_TONES: Record<string, string> = {
  ACTIVE: "bg-success/10 text-success border-success/20",
  INACTIVE: "bg-muted text-muted-foreground border-border",
  SUSPENDED: "bg-destructive/10 text-destructive border-destructive/20",
};

const ROLE_ICONS: Record<string, typeof Shield> = {
  ADMIN: Shield,
  EMPLOYEE: UserCircle,
  STUDENT: GraduationCap,
};

export function UsersListView() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  const queryStr = useCallback(() => {
    const sp = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (search) sp.set("search", search);
    if (roleFilter) sp.set("role", roleFilter);
    if (statusFilter) sp.set("status", statusFilter);
    return sp.toString();
  }, [search, roleFilter, statusFilter, page]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin", "users", search, roleFilter, statusFilter, page],
    queryFn: () => apiFetch<Response>(`/api/users?${queryStr()}`),
    retry: false,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiFetch(`/api/users/${id}/status`, { method: "PATCH", json: { status } }),
    onSuccess: () => {
      toast({ title: "Status updated" });
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: () => toast({ title: "Error", description: "Failed to update status", variant: "error" }),
  });

  return (
    <div>
      <PageHeader title="User Management" description="Manage all users — admins, employees, and students." />

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name or email…"
            className="h-9 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm focus:border-primary focus:outline-none"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
          className="h-9 rounded-lg border border-border bg-card px-2 text-sm focus:border-primary focus:outline-none"
        >
          <option value="">All Roles</option>
          <option value="ADMIN">Admin</option>
          <option value="EMPLOYEE">Employee</option>
          <option value="STUDENT">Student</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="h-9 rounded-lg border border-border bg-card px-2 text-sm focus:border-primary focus:outline-none"
        >
          <option value="">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="SUSPENDED">Suspended</option>
        </select>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 rounded-lg border border-border bg-card">
              <Skeleton className="h-full w-full" />
            </div>
          ))}
        </div>
      ) : data && data.users.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">User</th>
                <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground md:table-cell">Role</th>
                <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:table-cell">Last Login</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.users.map((user) => {
                const RoleIcon = ROLE_ICONS[user.roleName] ?? UsersIcon;
                return (
                  <tr key={user.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Link href={`/admin/users/${user.id}`} className="flex items-center gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {user.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{user.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </Link>
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                        <RoleIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        {user.roleName}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-xs text-muted-foreground lg:table-cell">
                      {user.lastLoginAt ? formatDate(user.lastLoginAt) : "Never"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold", STATUS_TONES[user.status])}>
                        {user.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {user.status !== "ACTIVE" && (
                          <button
                            onClick={() => statusMutation.mutate({ id: user.id, status: "ACTIVE" })}
                            className="rounded-md px-2 py-1 text-xs font-medium text-success hover:bg-success/10"
                          >
                            Activate
                          </button>
                        )}
                        {user.status === "ACTIVE" && (
                          <button
                            onClick={() => statusMutation.mutate({ id: user.id, status: "SUSPENDED" })}
                            className="rounded-md px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/10"
                          >
                            Suspend
                          </button>
                        )}
                        <Link href={`/admin/users/${user.id}`} className="rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10">
                          View
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <UsersIcon className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">No users found. Try adjusting filters.</p>
        </div>
      )}

      {/* Pagination */}
      {data && data.pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {data.pagination.total} users · Page {data.pagination.page} of {data.pagination.totalPages}
          </p>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page >= data.pagination.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
