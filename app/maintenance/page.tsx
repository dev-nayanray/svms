import { getActiveMaintenance } from "@/lib/system/maintenance";
import { getBrandSettings } from "@/lib/services/site-settings";
import Link from "next/link";
import { EuroscopeLogo } from "@/components/marketing/logo";

export const dynamic = "force-dynamic";

/**
 * Public Maintenance Page — /maintenance
 *
 * Professional Euroscope-branded page shown when maintenance is active.
 * Does NOT use the Admin Panel layout — it's a standalone full-screen page.
 *
 * All content is database-driven (MaintenanceWindow fields + brand settings).
 */
export default async function MaintenancePage() {
  const [status, brand] = await Promise.all([
    getActiveMaintenance(),
    getBrandSettings().catch(() => ({
      logoUrl: "/euroscope-mark.png",
      logoLightUrl: "/euroscope-mark.png",
      brandName: "Euroscope",
      tagline: "Study in Europe. Start Your Future.",
      contactEmail: "hello@euroscope.app",
      contactPhone: "",
      primaryColor: "#D4AF37",
    })),
  ]);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Background decorations */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {/* Gold glow */}
        <div
          className="absolute -top-40 left-1/2 h-[500px] w-[800px] -translate-x-1/2 rounded-full opacity-10 blur-[120px]"
          style={{ background: `radial-gradient(circle, ${brand.primaryColor} 0%, transparent 70%)` }}
        />
        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `linear-gradient(${brand.primaryColor} 1px, transparent 1px), linear-gradient(90deg, ${brand.primaryColor} 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 flex w-full max-w-lg flex-col items-center px-6 text-center">
        {/* Logo */}
        <div className="mb-8 animate-[fadeIn_0.6s_ease-out]">
          <EuroscopeLogo size="default" variant="mark" showWordmark={true} />
        </div>

        {/* Maintenance icon */}
        <div className="mb-6 animate-[fadeIn_0.8s_ease-out]">
          <div
            className="relative grid h-24 w-24 place-items-center rounded-3xl shadow-lg"
            style={{
              background: `linear-gradient(135deg, ${brand.primaryColor}15 0%, ${brand.primaryColor}05 100%)`,
              border: `1px solid ${brand.primaryColor}30`,
            }}
          >
            {/* Animated pulse rings */}
            <div
              className="absolute inset-0 animate-ping rounded-3xl opacity-20"
              style={{ backgroundColor: brand.primaryColor }}
              aria-hidden
            />
            {/* Gear icon */}
            <svg
              className="h-10 w-10 animate-[spin_8s_linear_infinite]"
              style={{ color: brand.primaryColor }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-23.528L15.34 4.058M19.467 7.95l1.591-1.591M12.024 21.531l-1.591-1.591M4.058 15.341L2.467 13.75M19.467 16.058l1.591-1.591M21.531 11.953l-1.591-1.591M4.058 8.659L2.467 10.25M11.953 2.467l1.591 1.591M8.659 4.058L7.068 2.467M15.341 19.942l1.591 1.591M12.024 2.467l1.591 1.591M4.058 15.341L2.467 13.75"
              />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h1 className="mb-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl animate-[fadeIn_1s_ease-out]">
          {status.title || "We'll be back soon"}
        </h1>

        {/* Message */}
        <p className="mb-6 max-w-md text-base leading-relaxed text-slate-600 animate-[fadeIn_1.2s_ease-out]">
          {status.message || "We're currently performing scheduled maintenance to improve your Euroscope experience. We'll be back shortly."}
        </p>

        {/* Expected return time */}
        {status.expectedEndAt && (
          <div className="mb-6 rounded-lg border border-slate-200 bg-white/80 px-4 py-3 backdrop-blur animate-[fadeIn_1.4s_ease-out]">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Expected back by
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-700">
              {new Date(status.expectedEndAt).toLocaleString("en-GB", {
                weekday: "long",
                day: "numeric",
                month: "long",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        )}

        {/* Contact button */}
        {status.showContactButton && (
          <div className="mb-8 animate-[fadeIn_1.6s_ease-out]">
            <Link
              href={status.contactButtonUrl || "/contact"}
              className="inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg hover:scale-[1.02] focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{
                background: `linear-gradient(135deg, ${brand.primaryColor} 0%, ${brand.primaryColor}dd 100%)`,
              }}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
              {status.contactButtonText || "Contact Support"}
            </Link>
          </div>
        )}

        {/* Social links */}
        {status.showSocialLinks && (
          <div className="flex items-center gap-3 animate-[fadeIn_1.8s_ease-out]">
            <span className="text-xs text-slate-400">Follow us:</span>
            <div className="flex items-center gap-2">
              <a
                href="#"
                aria-label="Facebook"
                className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-white/80 text-slate-400 transition-all hover:border-slate-300 hover:text-slate-600"
              >
                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              </a>
              <a
                href="#"
                aria-label="Instagram"
                className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-white/80 text-slate-400 transition-all hover:border-slate-300 hover:text-slate-600"
              >
                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
              </a>
              <a
                href="#"
                aria-label="LinkedIn"
                className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-white/80 text-slate-400 transition-all hover:border-slate-300 hover:text-slate-600"
              >
                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
              </a>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 border-t border-slate-200 pt-6 animate-[fadeIn_2s_ease-out]">
          <p className="text-xs text-slate-400">
            &copy; {new Date().getFullYear()} {brand.brandName}. All rights reserved.
          </p>
          <p className="mt-1 text-xs text-slate-300">
            {brand.tagline}
          </p>
        </div>
      </div>

      {/* Keyframes */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}} />
    </div>
  );
}
