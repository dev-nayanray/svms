import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { EmployeePageHeader } from "@/components/employee/ui";
import { Card, CardContent, CardHeader, CardTitle, Badge, Separator } from "@/components/ui";
import { formatDate, titleCase } from "@/lib/utils";
import { getProfile } from "@/lib/services/profile-cases";
import { ProfileEditForm } from "@/components/employee/profile/profile-edit-form";

export const dynamic = "force-dynamic";

export default async function EmployeeProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/employee/profile");
  const role = (session.user as { role?: string }).role;
  if (role !== "EMPLOYEE" && role !== "ADMIN") redirect("/403");

  let profile;
  try {
    profile = await getProfile(session.user.id);
  } catch (err) {
    console.error("[employee/profile]", err);
    return (
      <div>
        <EmployeePageHeader title="My Profile" description="Could not load — server error." />
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">An unexpected error occurred.</CardContent></Card>
      </div>
    );
  }

  return (
    <div>
      <EmployeePageHeader
        title="My Profile"
        description="Your employee record and contact details."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Editable fields */}
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Personal information</CardTitle></CardHeader>
          <CardContent>
            <ProfileEditForm profile={profile} />
          </CardContent>
        </Card>

        {/* Read-only + admin-only fields */}
        <Card>
          <CardHeader><CardTitle>Account</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <dl className="space-y-3 text-sm">
              <Field label="Email" value={
                <span className="inline-flex items-center gap-2">
                  {profile.email}
                  <Badge tone="default" className="text-[10px]">Read-only</Badge>
                </span>
              } />
              <Field label="Role" value={<Badge tone="info">{titleCase(profile.role)}</Badge>} />
              <Field label="Status" value={<Badge tone={profile.status === "ACTIVE" ? "success" : "warning"}>{titleCase(profile.status)}</Badge>} />
              <Field label="Last login" value={profile.lastLoginAt ? formatDate(profile.lastLoginAt) : "—"} />
              <Field label="Member since" value={formatDate(profile.createdAt)} />
              <Field label="Employee ID" value={profile.employeeId ?? "—"} />
            </dl>
            <Separator />
            <div>
              <p className="text-xs font-medium text-muted-foreground">Email & role</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Email is your login credential and can only be changed by an administrator.
                Role and permission assignments are managed by an administrator.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Permissions summary — read-only display */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Permissions</CardTitle>
          <p className="text-xs text-muted-foreground">
            Your role grants the following permissions. These cannot be self-edited.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {profile.permissions.map((p) => (
              <div
                key={p.key}
                className={`flex items-center justify-between rounded-md border px-2 py-1.5 text-xs ${
                  p.allowed
                    ? "border-success/30 bg-success/5 text-foreground"
                    : "border-border bg-muted/30 text-muted-foreground"
                }`}
              >
                <span className="truncate font-mono">{p.key}</span>
                <span className={`ml-1.5 h-1.5 w-1.5 rounded-full ${p.allowed ? "bg-success" : "bg-muted-foreground/30"}`} aria-hidden />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-medium">{value}</dd>
    </div>
  );
}
