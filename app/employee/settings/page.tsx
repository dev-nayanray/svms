import { getSession } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { PageHeader } from "@/components/shared/page-kit";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await getSession();
  return (
    <>
      <PageHeader
        title="Settings"
        description="Workspace preferences are shared with your account. Organization-wide settings are managed by admins."
        breadcrumbs={["Employee", "Settings"]}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Use the moon/sun icon in the top bar to switch between light and dark mode. Your choice is remembered on this device.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium">{session.user.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium">{session.user.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Role</span>
              <span className="font-medium">{session.user.role}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
