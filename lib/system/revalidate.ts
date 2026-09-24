import { revalidatePath, revalidateTag } from "next/cache";

/**
 * Cache Revalidation Service
 * ==========================
 *
 * Centralized helper for invalidating Next.js caches after CMS/settings
 * changes. Without this, saved settings don't appear on the public site
 * until the cache TTL expires or the server restarts.
 *
 * In Next.js 16, revalidateTag requires a "profile" argument — we use
 * { expire: 0 } for immediate invalidation.
 */

/**
 * Revalidate ALL marketing pages + public APIs.
 * Call this after ANY marketing/branding setting changes.
 */
export function revalidateMarketingPages(): void {
  try {
    // Revalidate the layout itself (navbar + footer are in the layout)
    revalidatePath("/(marketing)", "layout");

    // Revalidate every public marketing page
    const publicPages = [
      "/",
      "/about",
      "/contact",
      "/features",
      "/how-it-works",
      "/resources",
      "/universities",
      "/courses",
      "/study-in-europe",
      "/login",
      "/register",
      "/maintenance",
    ];
    for (const p of publicPages) {
      try {
        revalidatePath(p, "page");
      } catch {
        // some paths may not exist yet — skip
      }
    }

    // Revalidate by tag — { expire: 0 } = immediate invalidation
    revalidateTag("marketing-content", { expire: 0 });
    revalidateTag("brand-settings", { expire: 0 });
    revalidateTag("maintenance", { expire: 0 });
  } catch {
    // revalidatePath can throw in some contexts. Swallow — the change
    // is still persisted; the cache will expire naturally.
  }
}

/**
 * Revalidate only maintenance-related caches.
 */
export function revalidateMaintenance(): void {
  try {
    revalidatePath("/(marketing)", "layout");
    revalidatePath("/maintenance", "page");
    revalidateTag("maintenance", { expire: 0 });
  } catch {
    // swallow
  }
}

/**
 * Revalidate only SEO-related caches.
 */
export function revalidateSeo(): void {
  try {
    revalidatePath("/", "layout");
    revalidatePath("/robots", "page");
    revalidatePath("/sitemap", "page");
    revalidateTag("seo", { expire: 0 });
  } catch {
    // swallow
  }
}
