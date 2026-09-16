import type { Metadata } from "next";
import { MarketingNavbar } from "@/components/marketing/navbar";
import { MarketingFooter } from "@/components/marketing/footer";
import { MarketingSessionProvider } from "@/components/marketing/session-provider";
import { FloatingSupportWidget } from "@/components/marketing/support-widget";
import { getActiveMaintenance } from "@/lib/system/maintenance";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

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
 *    (or allowAdminAccess is false), we REDIRECT to /maintenance.
 *  - Auth pages (/login, /register) and /maintenance bypass this check
 *    so users can still log in (admins especially).
 *  - /api routes are NOT affected by this layout (they're outside the
 *    (marketing) route group).
 *
 * Redirect (not inline render) is used so:
 *  - The URL changes to /maintenance (clear to the user)
 *  - The maintenance page is a standalone route (no navbar/footer)
 *  - No redirect loop: /maintenance is outside (marketing) group
 */
export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  // Check maintenance status — best-effort, fail open for availability
  let maintenanceActive = false;
  let allowAdminAccess = true;
  try {
    const status = await getActiveMaintenance();
    maintenanceActive = status.active;
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
      // Redirect to the standalone maintenance page.
      // /maintenance is OUTSIDE the (marketing) route group, so this
      // doesn't cause a redirect loop.
      redirect("/maintenance");
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
