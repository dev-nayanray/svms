import type { Metadata } from "next";
import { MarketingNavbar } from "@/components/marketing/navbar";
import { MarketingFooter } from "@/components/marketing/footer";
import { MarketingSessionProvider } from "@/components/marketing/session-provider";
import { FloatingSupportWidget } from "@/components/marketing/support-widget";
import { AnnouncementBar } from "@/components/marketing/announcement-bar";
import { getActiveMaintenance } from "@/lib/system/maintenance";
import { getCmsConfig, isAnnouncementActive, type CmsConfig } from "@/lib/marketing/cms";
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
 * Fetches CMS config server-side (header, nav, footer, social, contact,
 * announcement) and passes it as props to the navbar + footer + announcement
 * bar. This makes them dynamic (admin can edit via /admin/marketing) while
 * keeping the page server-rendered (no client-side flash).
 *
 * Maintenance mode:
 *  - If active AND user is not admin (or allowAdminAccess=false), redirect
 *    to /maintenance (standalone page, no redirect loop).
 */
export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  // Fetch maintenance status + CMS config in parallel
  const [maintenanceStatus, cmsConfig] = await Promise.all([
    getActiveMaintenance().catch(() => ({ active: false, allowAdminAccess: true })),
    getCmsConfig().catch(() => null),
  ]);

  // Maintenance check
  if (maintenanceStatus.active) {
    let isAdmin = false;
    try {
      const session = await auth();
      isAdmin = session?.user?.role === "ADMIN";
    } catch {
      // ignore
    }
    const bypassForAdmin = isAdmin && maintenanceStatus.allowAdminAccess;
    if (!bypassForAdmin) {
      redirect("/maintenance");
    }
  }

  // Use fetched CMS config or fallback to null (navbar/footer will use their
  // own hardcoded defaults if config is null — this happens only if DB is down)
  const config = cmsConfig as CmsConfig | null;
  const announcementActive = config ? isAnnouncementActive(config.announcement) : false;
  const announcement = config
    ? { ...config.announcement, active: announcementActive }
    : null;

  return (
    <MarketingSessionProvider>
      {announcement && <AnnouncementBar announcement={announcement} />}
      <MarketingNavbar
        navigation={config?.navigation}
        headerConfig={config?.header}
      />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <MarketingFooter
        footerConfig={config?.footer}
        socialLinks={config?.social}
        contactConfig={config?.contact}
      />
      <FloatingSupportWidget />
    </MarketingSessionProvider>
  );
}
