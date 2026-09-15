"use client";

/**
 * Client-side Analytics / Tracking Abstraction
 * =============================================
 *
 * trackEvent() — single entry point for all conversion/event tracking.
 * Routes the event to whichever analytics providers are enabled AND
 * have user consent for the appropriate category.
 *
 * Provider wiring:
 *  - GA4: window.gtag('event', name, params)
 *  - GTM: window.dataLayer.push({ event: name, ...params })
 *  - Meta Pixel: window.fbq('track', eventName, params)
 *
 * Consent: read from localStorage 'svms-consent'. If consent is required
 * (default) and the user hasn't granted analytics/marketing consent,
 * the event is dropped silently (not sent to any provider).
 *
 * Sensitive-data filtering:
 *  - Never send: passport, nationalId, email, phone, password, documentId,
 *    applicationId, paymentId, invoiceId, or any value matching PII patterns.
 *  - The function STRIPS these fields before forwarding to providers.
 *
 * Usage:
 *   trackEvent("lead_created");
 *   trackEvent("counseling_request", { source: "contact_form" });
 *   trackEvent("application_started", { country: "Germany" });  // OK
 *   trackEvent("application_submitted", { applicationId: "..." }); // BLOCKED — applicationId is sensitive
 */

export type TrackEventName =
  | "page_view"
  | "contact_submit"
  | "counseling_request"
  | "lead_created"
  | "application_started"
  | "application_submitted"
  | "search"
  | "university_view"
  | "course_view"
  | "register"
  | "login";

type ConsentLevel = "necessary" | "analytics" | "marketing";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

// ─── Consent helpers ──────────────────────────────────────────────

const CONSENT_KEY = "svms-consent";

export type ConsentMap = {
  necessary: boolean; // always true
  analytics: boolean;
  marketing: boolean;
};

const DEFAULT_CONSENT: ConsentMap = {
  necessary: true,
  analytics: false,
  marketing: false,
};

export function getConsent(): ConsentMap {
  if (typeof window === "undefined") return DEFAULT_CONSENT;
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return DEFAULT_CONSENT;
    const parsed = JSON.parse(raw) as Partial<ConsentMap>;
    return {
      necessary: true,
      analytics: !!parsed.analytics,
      marketing: !!parsed.marketing,
    };
  } catch {
    return DEFAULT_CONSENT;
  }
}

export function setConsent(level: ConsentLevel, granted: boolean): void {
  if (typeof window === "undefined") return;
  const current = getConsent();
  if (level !== "necessary") current[level] = granted;
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify(current));
  } catch {
    // ignore — private browsing
  }
  // Re-evaluate provider scripts on consent change
  window.dispatchEvent(new CustomEvent("svms:consent-change", { detail: current }));
}

// ─── Sensitive data filtering ────────────────────────────────────

const FORBIDDEN_KEYS = new Set([
  "email",
  "phone",
  "phoneNumber",
  "passport",
  "passportNumber",
  "nationalId",
  "nid",
  "password",
  "passwordHash",
  "documentId",
  "applicationId",
  "paymentId",
  "invoiceId",
  "studentId",
  "userId",
  "name",
  "address",
  "dob",
  "dateOfBirth",
  "token",
  "secret",
]);

/** Strip any sensitive keys + recurse into nested objects. */
export function sanitizeParams(params: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) {
    if (FORBIDDEN_KEYS.has(k)) continue;
    if (typeof v === "object" && v !== null && !Array.isArray(v)) {
      out[k] = sanitizeParams(v as Record<string, unknown>);
    } else if (typeof v === "string" && /passport|national.?id|^[\d.]{8,}$|@/.test(v)) {
      // Looks like an ID, passport number, or email — drop it
      continue;
    } else {
      out[k] = v;
    }
  }
  return out;
}

// ─── Public API: trackEvent ───────────────────────────────────────

const EVENT_CONSENT_LEVEL: Record<TrackEventName, ConsentLevel> = {
  page_view: "analytics",
  contact_submit: "analytics",
  counseling_request: "analytics",
  lead_created: "analytics",
  application_started: "analytics",
  application_submitted: "analytics",
  search: "analytics",
  university_view: "analytics",
  course_view: "analytics",
  register: "analytics",
  login: "analytics",
};

// Mapping from our event names to Meta Pixel standard events
const META_EVENT_MAP: Partial<Record<TrackEventName, string>> = {
  contact_submit: "Contact",
  counseling_request: "Lead",
  lead_created: "Lead",
  register: "CompleteRegistration",
  application_submitted: "CompleteRegistration",
  page_view: "PageView",
};

export function trackEvent(
  name: TrackEventName,
  params: Record<string, unknown> = {},
): void {
  if (typeof window === "undefined") return;

  const consent = getConsent();
  const requiredLevel = EVENT_CONSENT_LEVEL[name];
  if (!consent[requiredLevel]) {
    // User hasn't granted consent for this category — drop the event.
    return;
  }

  const safeParams = sanitizeParams(params);

  // GA4
  if (window.gtag) {
    try {
      window.gtag("event", name, safeParams);
    } catch {
      // ignore provider errors
    }
  }

  // GTM
  if (window.dataLayer) {
    try {
      window.dataLayer.push({ event: name, ...safeParams });
    } catch {
      // ignore
    }
  }

  // Meta Pixel (marketing category)
  const metaEvent = META_EVENT_MAP[name];
  if (metaEvent && window.fbq && consent.marketing) {
    try {
      window.fbq("track", metaEvent, safeParams);
    } catch {
      // ignore
    }
  }
}

// ─── Page view (auto-tracked from the page-kit component) ─────────

export function trackPageView(path: string, title?: string): void {
  trackEvent("page_view", { page_path: path, page_title: title });
}
