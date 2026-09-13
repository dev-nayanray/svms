"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { Skeleton } from "@/components/ui/overlays";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils";
import { Shield, GraduationCap, UserCircle, ArrowLeft, KeyRound, Trash2, Camera, Loader2 } from "lucide-react";
import Link from "next/link";

type UserDetail = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  roleName: string;
  status: string;
  lastLoginAt: string | null;
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  branchId: string | null;
  student?: {
    id: string; studentId: string; firstName: string; lastName: string;
    email: string; phone: string | null; whatsapp: string | null;
    nationality: string | null; passportNumber: string | null;
    city: string | null; country: string | null;
    profilePhotoUrl: string | null; status: string;
  } | null;
  employee?: { id: string; title: string } | null;
  branch?: { id: string; name: string; code: string } | null;
};

const STATUS_TONES: Record<string, string> = {
  ACTIVE: "bg-success/10 text-success border-success/20",
  INACTIVE: "bg-muted text-muted-foreground border-border",
  SUSPENDED: "bg-destructive/10 text-destructive border-destructive/20",
};

export function UserDetailView({ userId }: { userId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const router = useRouter();
  const [showResetModal, setShowResetModal] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { data: user, isLoading } = useQuery({
    queryKey: ["admin", "users", userId],
    queryFn: () => apiFetch<UserDetail>(`/api/users/${userId}`),
    retry: false,
  });

  const statusMutation = useMutation({
    mutationFn: ({ status }: { status: string }) =>
      apiFetch(`/api/users/${userId}/status`, { method: "PATCH", json: { status } }),
    onSuccess: (_data, vars) => {
      toast({ title: `User ${vars.status.toLowerCase()}` });
      qc.invalidateQueries({ queryKey: ["admin", "users", userId] });
    },
    onError: () => toast({ title: "Error", description: "Failed to update status", variant: "error" }),
  });

  const resetMutation = useMutation({
    mutationFn: () => apiFetch<{ tempPassword: string }>(`/api/users/${userId}/reset-password`, { method: "POST" }),
    onSuccess: (data) => {
      toast({ title: "Password reset", description: `Temp password: ${data.tempPassword}` });
      setShowResetModal(false);
    },
    onError: () => toast({ title: "Error", description: "Failed to reset password", variant: "error" }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiFetch(`/api/users/${userId}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "User deleted" });
      router.push("/admin/users");
    },
    onError: () => toast({ title: "Error", description: "Failed to delete user", variant: "error" }),
  });

  // Photo upload (for students only)
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.student) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/admin/students/${user.student.id}/photo`, {
        method: "POST",
        body: formData,
      });
      const body = await res.json();
      if (!res.ok || !body.success) throw new Error(body?.error?.message ?? "Upload failed");
      toast({ title: "Photo updated" });
      qc.invalidateQueries({ queryKey: ["admin", "users", userId] });
    } catch {
      toast({ title: "Error", description: "Photo upload failed", variant: "error" });
    } finally {
      setUploading(false);
    }
  };

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center"><Skeleton className="h-64 w-full" /></div>;
  }
  if (!user) {
    return <div className="p-8 text-center text-muted-foreground">User not found.</div>;
  }

  const RoleIcon = user.roleName === "ADMIN" ? Shield : user.roleName === "EMPLOYEE" ? UserCircle : GraduationCap;
  const photoUrl = user.student?.profilePhotoUrl;

  return (
    <div>
      <Link href="/admin/users" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Users
      </Link>

      {/* Profile header card */}
      <div className="mb-6 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
          {/* Avatar + photo upload */}
          <div className="relative">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt={user.name} className="h-20 w-20 rounded-full object-cover ring-2 ring-border" />
            ) : (
              <span className="grid h-20 w-20 place-items-center rounded-full bg-primary/10 text-xl font-bold text-primary">
                {user.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
              </span>
            )}
            {/* Photo upload button (students only) */}
            {user.student && (
              <label className="absolute -bottom-1 -right-1 grid h-8 w-8 cursor-pointer place-items-center rounded-full bg-primary text-primary-foreground shadow-md ring-2 ring-card hover:bg-primary-hover">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handlePhotoUpload} disabled={uploading} />
              </label>
            )}
          </div>

          {/* Name + role + status */}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight">{user.name}</h1>
              <span className={cn("inline-flex rounded-full border px-2.5 py-0.5 text-xs font-bold", STATUS_TONES[user.status])}>
                {user.status}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">{user.email}</p>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1 font-medium">
                <RoleIcon className="h-3.5 w-3.5" /> {user.roleName}
              </span>
              {user.student && <span>Student ID: {user.student.studentId}</span>}
              {user.employee && <span>Title: {user.employee.title}</span>}
              {user.branch && <span>Branch: {user.branch.name}</span>}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            {user.status === "ACTIVE" ? (
              <Button variant="outline" size="sm" onClick={() => statusMutation.mutate({ status: "SUSPENDED" })} disabled={statusMutation.isPending}>
                <Shield className="h-4 w-4" /> Suspend
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => statusMutation.mutate({ status: "ACTIVE" })} disabled={statusMutation.isPending}>
                <Shield className="h-4 w-4" /> Activate
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setShowResetModal(true)}>
              <KeyRound className="h-4 w-4" /> Reset Password
            </Button>
            <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => { if (confirm("Delete this user? This is a soft delete.")) deleteMutation.mutate(); }} disabled={deleteMutation.isPending}>
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </div>
        </div>
      </div>

      {/* Details grid */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Account info */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">Account</h3>
          <dl className="space-y-2.5 text-sm">
            <DetailRow label="Email" value={user.email} />
            <DetailRow label="Phone" value={user.phone ?? "—"} />
            <DetailRow label="Role" value={user.roleName} />
            <DetailRow label="Status" value={user.status} />
            <DetailRow label="Email verified" value={user.emailVerifiedAt ? formatDate(user.emailVerifiedAt) : "No"} />
            <DetailRow label="Last login" value={user.lastLoginAt ? formatDate(user.lastLoginAt) : "Never"} />
            <DetailRow label="Created" value={formatDate(user.createdAt)} />
            <DetailRow label="Updated" value={formatDate(user.updatedAt)} />
          </dl>
        </div>

        {/* Student profile */}
        {user.student && (
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">Student Profile</h3>
            <dl className="space-y-2.5 text-sm">
              <DetailRow label="Student ID" value={user.student.studentId} />
              <DetailRow label="Name" value={`${user.student.firstName} ${user.student.lastName}`} />
              <DetailRow label="Email" value={user.student.email} />
              <DetailRow label="Phone" value={user.student.phone ?? "—"} />
              <DetailRow label="WhatsApp" value={user.student.whatsapp ?? "—"} />
              <DetailRow label="Nationality" value={user.student.nationality ?? "—"} />
              <DetailRow label="Passport" value={user.student.passportNumber ?? "—"} />
              <DetailRow label="City" value={user.student.city ?? "—"} />
              <DetailRow label="Country" value={user.student.country ?? "—"} />
            </dl>
          </div>
        )}

        {/* Employee profile */}
        {user.employee && (
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">Employee Profile</h3>
            <dl className="space-y-2.5 text-sm">
              <DetailRow label="Title" value={user.employee.title} />
            </dl>
          </div>
        )}
      </div>

      {/* Reset password modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
            <h3 className="text-lg font-bold">Reset Password</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              A new temporary password will be generated. Share it securely with the user — they should change it on first login.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowResetModal(false)}>Cancel</Button>
              <Button size="sm" onClick={() => resetMutation.mutate()} disabled={resetMutation.isPending}>
                {resetMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                Reset Password
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
