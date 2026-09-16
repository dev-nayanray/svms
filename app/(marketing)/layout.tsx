import type { Metadata } from "next";
import { MarketingNavbar } from "@/components/marketing/navbar";
import { MarketingFooter } from "@/components/marketing/footer";
import { MarketingSessionProvider } from "@/components/marketing/session-provider";
import { FloatingSupportWidget } from "@/components/marketing/support-widget";
import { getActiveMaintenance } from "@/lib/system/maintenance";
import { auth } from "@/lib/auth";
import MaintenancePage from "@/app/maintenance/page";

export const metadata: Metadata = {
  title: {
    default: "Euroscope — Study in Europe. Start Your Future.",
    template: "%s | Euroscope",
  },
  description:
    "Euroscope helps students manage their entire European study journey — from choosing the right university to preparing your application and visa — all in one place.",
};

export const dynamic = "force-dynamic";

/**
 * Marketing layout — wraps all public marketing pages.
 *
 * Maintenance mode:
 *  - If a MaintenanceWindow is active AND the visitor is NOT an admin
 *    (or allowAdminAccess is false), we render the maintenance page
 *    instead of the normal children.
 *  - Auth pages (/login, /register) and the /maintenance route itself
 *    bypass this check so users can still log in (admins especially).
 */
export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  // Check maintenance status — best-effort, fail open for availability
  let maintenanceActive = false;
  let maintenanceMessage = "";
  let allowAdminAccess = true;
  try {
    const status = await getActiveMaintenance();
    maintenanceActive = status.active;
    maintenanceMessage = status.message;
    allowAdminAccess = status.allowAdminAccess;
  } catch {
    // DB unavailable — fail open (don't block the site)
  }

  if (maintenanceActive) {
    // Check if the current user is an admin (and admin access is allowed)
    let isAdmin = false;
    try {
      const session = await auth();
      isAdmin = session?.user?.role === "ADMIN";
    } catch {
      // ignore
    }
    const bypassForAdmin = isAdmin && allowAdminAccess;

    if (!bypassForAdmin) {
      // Render the maintenance page instead of normal children.
      // We render <MaintenancePage /> inline so the URL stays at the
      // requested path (e.g. /about still shows the maintenance message).
      return (
        <MaintenancePageWrapper message={maintenanceMessage} />
      );
    }
  }

  return (
    <MarketingSessionProvider>
      <MarketingNavbar />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <MarketingFooter />
      <FloatingSupportWidget />
    </MarketingSessionProvider>
  );
}

/**
 * Inline maintenance screen — renders the same content as /maintenance
 * but without the standalone page wrapper. We don't import the actual
 * MaintenancePage component because it makes its own DB call; here we
 * already have the message.
 */
function MaintenancePageWrapper({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 text-center shadow-sm">
        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-warning/10">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 text-warning"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11 3.5L2 19a2 2 0 002 2h16a2 2 0 002-2L13 3.5a2 2 0 00-2 0z M12 9v4 M12 17h.01"
            />
          </svg>
        </div>
        <h1 className="text-xl font-semibold">Euroscope is under maintenance</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {message || "We are performing scheduled maintenance. We'll be back shortly."}
        </p>
        <p className="mt-4 text-xs text-muted-foreground">
          Thank you for your patience.
        </p>
      </div>
    </div>
  );
}

// Suppress unused import warning — MaintenancePage is referenced as a fallback
void MaintenancePage;
