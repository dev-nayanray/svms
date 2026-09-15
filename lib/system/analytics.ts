import { auditLog } from "@/lib/services/audit";
import { isEnvConfigured } from "./env";
import { getAnalyticsConfig, setConfig } from "./config";
import { logSystemEvent } from "./logs";

/**
 * Analytics Configuration Service
 * ================================
 *
 * Manages GA4, GTM, Meta Pixel configuration. Secrets (NONE — these
 * are all public IDs) are stored in SystemSetting so the client can
 * read them via window.__SVMS_ANALYTICS__.
 *
 * Validation rules:
 *  - GA4 Measurement ID: /^G-[A-Z0-9]{8,}$/
 *  - GTM Container ID:   /^GTM-[A-Z0-9]{6,}$/
 *  - Meta Pixel ID:      /^\d{15,16}$/
 *
 * The actual provider scripts are loaded by the
 * <AnalyticsProviders /> client component, gated on consent.
 */

const GA4_PATTERN = /^G-[A-Z0-9]{6,}$/;
const GTM_PATTERN = /^GTM-[A-Z0-9]{6,}$/;
const META_PIXEL_PATTERN = /^\d{15,16}$/;

export type AnalyticsValidationResult = {
  field: string;
  valid: boolean;
  message?: string;
};

export function validateAnalyticsConfig(input: {
  ga4MeasurementId?: string;
  gtmContainerId?: string;
  metaPixelId?: string;
}): AnalyticsValidationResult[] {
  const out: AnalyticsValidationResult[] = [];

  if (input.ga4MeasurementId && input.ga4MeasurementId.length > 0) {
    out.push({
      field: "ga4.measurementId",
      valid: GA4_PATTERN.test(input.ga4MeasurementId),
      message: GA4_PATTERN.test(input.ga4MeasurementId) ? undefined : "Format: G-XXXXXXXX",
    });
  }

  if (input.gtmContainerId && input.gtmContainerId.length > 0) {
    out.push({
      field: "gtm.containerId",
      valid: GTM_PATTERN.test(input.gtmContainerId),
      message: GTM_PATTERN.test(input.gtmContainerId) ? undefined : "Format: GTM-XXXXXXX",
    });
  }

  if (input.metaPixelId && input.metaPixelId.length > 0) {
    out.push({
      field: "meta.pixelId",
      valid: META_PIXEL_PATTERN.test(input.metaPixelId),
      message: META_PIXEL_PATTERN.test(input.metaPixelId) ? undefined : "Format: 15-16 digit number",
    });
  }

  return out;
}

export async function updateAnalyticsConfig(
  updates: {
    ga4?: { enabled?: boolean; measurementId?: string };
    gtm?: { enabled?: boolean; containerId?: string };
    meta?: { enabled?: boolean; pixelId?: string };
    vercelAnalytics?: { enabled?: boolean };
    vercelSpeedInsights?: { enabled?: boolean };
  },
  actorId: string,
  ctx?: { ipAddress?: string; userAgent?: string },
): Promise<void> {
  // Validate first
  const validation = validateAnalyticsConfig({
    ga4MeasurementId: updates.ga4?.measurementId,
    gtmContainerId: updates.gtm?.containerId,
    metaPixelId: updates.meta?.pixelId,
  });
  const invalid = validation.filter((v) => !v.valid);
  if (invalid.length > 0) {
    throw new Error(
      `Invalid analytics config: ${invalid.map((v) => `${v.field} (${v.message})`).join(", ")}`,
    );
  }

  // Persist
  if (updates.ga4) {
    if (updates.ga4.enabled !== undefined) await setConfig("analytics.ga4.enabled", updates.ga4.enabled, actorId);
    if (updates.ga4.measurementId !== undefined)
      await setConfig("analytics.ga4.measurementId", updates.ga4.measurementId, actorId);
  }
  if (updates.gtm) {
    if (updates.gtm.enabled !== undefined) await setConfig("analytics.gtm.enabled", updates.gtm.enabled, actorId);
    if (updates.gtm.containerId !== undefined)
      await setConfig("analytics.gtm.containerId", updates.gtm.containerId, actorId);
  }
  if (updates.meta) {
    if (updates.meta.enabled !== undefined) await setConfig("analytics.meta.enabled", updates.meta.enabled, actorId);
    if (updates.meta.pixelId !== undefined) await setConfig("analytics.meta.pixelId", updates.meta.pixelId, actorId);
  }
  if (updates.vercelAnalytics) {
    await setConfig("analytics.vercelAnalytics.enabled", updates.vercelAnalytics.enabled, actorId);
  }
  if (updates.vercelSpeedInsights) {
    await setConfig("analytics.vercelSpeedInsights.enabled", updates.vercelSpeedInsights.enabled, actorId);
  }

  await auditLog.record({
    userId: actorId,
    action: "analytics_setting.updated",
    entity: "SystemSetting",
    entityId: "analytics",
    newValue: updates,
    ipAddress: ctx?.ipAddress,
    userAgent: ctx?.userAgent,
  });
}

/** Returns the analytics config + env var status for the admin UI. */
export async function getAnalyticsStatus(): Promise<{
  config: Awaited<ReturnType<typeof getAnalyticsConfig>>;
  env: {
    ga4MeasurementId: boolean;
    gtmContainerId: boolean;
    metaPixelId: boolean;
  };
  validation: AnalyticsValidationResult[];
}> {
  const config = await getAnalyticsConfig();
  const validation = validateAnalyticsConfig({
    ga4MeasurementId: config.ga4.measurementId,
    gtmContainerId: config.gtm.containerId,
    metaPixelId: config.meta.pixelId,
  });
  return {
    config,
    env: {
      ga4MeasurementId: isEnvConfigured("NEXT_PUBLIC_GA4_MEASUREMENT_ID"),
      gtmContainerId: isEnvConfigured("NEXT_PUBLIC_GTM_CONTAINER_ID"),
      metaPixelId: isEnvConfigured("NEXT_PUBLIC_META_PIXEL_ID"),
    },
    validation,
  };
}

/** Test-event helper — admin clicks "send test event" in the UI. */
export async function recordTestEvent(
  provider: "ga4" | "gtm" | "meta" | "all",
  eventName: string,
  actorId: string,
): Promise<{ dispatched: string[]; blocked: string[] }> {
  const cfg = await getAnalyticsConfig();
  const dispatched: string[] = [];
  const blocked: string[] = [];

  if ((provider === "ga4" || provider === "all") && cfg.ga4.enabled && cfg.ga4.measurementId) {
    dispatched.push("ga4");
  } else if (provider === "ga4" || provider === "all") {
    blocked.push("ga4 (disabled or missing measurement ID)");
  }
  if ((provider === "gtm" || provider === "all") && cfg.gtm.enabled && cfg.gtm.containerId) {
    dispatched.push("gtm");
  } else if (provider === "gtm" || provider === "all") {
    blocked.push("gtm (disabled or missing container ID)");
  }
  if ((provider === "meta" || provider === "all") && cfg.meta.enabled && cfg.meta.pixelId) {
    dispatched.push("meta");
  } else if (provider === "meta" || provider === "all") {
    blocked.push("meta (disabled or missing pixel ID)");
  }

  await logSystemEvent("INFO", "config", `Test event "${eventName}" dispatched to: ${dispatched.join(", ") || "none"}`, {
    provider,
    eventName,
    actorId,
  });

  // We can't actually trigger the event server-side — return instructions
  // for the client to dispatch via window.gtag / window.fbq.
  return { dispatched, blocked };
}
