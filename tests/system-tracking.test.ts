import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

// Build a fuller window mock that includes EventTarget methods.
const listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();

const gtagMock = vi.fn() as unknown as Mock;
const fbqMock = vi.fn() as unknown as Mock;

const mockWindow = {
  dataLayer: [] as unknown[],
  gtag: gtagMock,
  fbq: fbqMock,
  localStorage: {
    store: {} as Record<string, string>,
    getItem(key: string) {
      return this.store[key] ?? null;
    },
    setItem(key: string, value: string) {
      this.store[key] = value;
    },
  },
  addEventListener(type: string, handler: EventListenerOrEventListenerObject) {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type)!.add(handler);
  },
  removeEventListener(type: string, handler: EventListenerOrEventListenerObject) {
    listeners.get(type)?.delete(handler);
  },
  dispatchEvent(event: Event) {
    listeners.get(event.type)?.forEach((h) => {
      const fn = typeof h === "function" ? h : h.handleEvent;
      fn.call(null, event);
    });
    return true;
  },
};

// CustomEvent polyfill for tests
class MockCustomEvent {
  type: string;
  detail: unknown;
  constructor(type: string, init: { detail?: unknown } = {}) {
    this.type = type;
    this.detail = init.detail ?? null;
  }
}

vi.stubGlobal("window", mockWindow);
vi.stubGlobal("localStorage", mockWindow.localStorage);
vi.stubGlobal("CustomEvent", MockCustomEvent);

import {
  trackEvent,
  getConsent,
  setConsent,
  sanitizeParams,
  type ConsentMap,
} from "@/lib/tracking";

describe("Analytics Tracking Abstraction", () => {
  beforeEach(() => {
    mockWindow.localStorage.store = {};
    mockWindow.dataLayer = [];
    gtagMock.mockClear();
    fbqMock.mockClear();
  });

  describe("Consent", () => {
    it("defaults to necessary-only consent when nothing is set", () => {
      const c = getConsent();
      expect(c.necessary).toBe(true);
      expect(c.analytics).toBe(false);
      expect(c.marketing).toBe(false);
    });

    it("grants analytics consent", () => {
      setConsent("analytics", true);
      const c = getConsent();
      expect(c.analytics).toBe(true);
    });

    it("grants marketing consent", () => {
      setConsent("marketing", true);
      const c = getConsent();
      expect(c.marketing).toBe(true);
    });

    it("necessary consent is always true regardless of attempts to change it", () => {
      setConsent("necessary", false as never);
      const c = getConsent();
      expect(c.necessary).toBe(true);
    });
  });

  describe("sanitizeParams", () => {
    it("strips email", () => {
      const result = sanitizeParams({ email: "test@example.com", foo: "bar" });
      expect(result).not.toHaveProperty("email");
      expect(result).toHaveProperty("foo", "bar");
    });

    it("strips phone", () => {
      const result = sanitizeParams({ phone: "+1234567890" });
      expect(result).not.toHaveProperty("phone");
    });

    it("strips passport", () => {
      const result = sanitizeParams({ passport: "AB1234567" });
      expect(result).not.toHaveProperty("passport");
    });

    it("strips applicationId", () => {
      const result = sanitizeParams({ applicationId: "abc-123" });
      expect(result).not.toHaveProperty("applicationId");
    });

    it("strips paymentId", () => {
      const result = sanitizeParams({ paymentId: "pay_123" });
      expect(result).not.toHaveProperty("paymentId");
    });

    it("strips password", () => {
      const result = sanitizeParams({ password: "secret123" });
      expect(result).not.toHaveProperty("password");
    });

    it("strips token", () => {
      const result = sanitizeParams({ token: "tok_xxx" });
      expect(result).not.toHaveProperty("token");
    });

    it("keeps safe params like country", () => {
      const result = sanitizeParams({ country: "Germany", source: "contact_form" });
      expect(result).toHaveProperty("country", "Germany");
      expect(result).toHaveProperty("source", "contact_form");
    });

    it("recurses into nested objects", () => {
      const result = sanitizeParams({
        meta: { email: "test@example.com", foo: "bar" },
      });
      expect(result.meta).not.toHaveProperty("email");
      expect(result.meta).toHaveProperty("foo", "bar");
    });

    it("strips string values that look like emails", () => {
      const result = sanitizeParams({ user: "test@example.com" });
      expect(result).not.toHaveProperty("user");
    });

    it("strips string values that look like passport numbers", () => {
      // Pure-digit numeric IDs of 8+ chars match the passport/ID regex
      const result = sanitizeParams({ doc: "1234567890" });
      expect(result).not.toHaveProperty("doc");
    });
  });

  describe("trackEvent", () => {
    it("drops the event when no consent is granted", () => {
      // Default: analytics=false
      trackEvent("page_view", { page_path: "/home" });
      expect(gtagMock).not.toHaveBeenCalled();
      expect(mockWindow.dataLayer.length).toBe(0);
    });

    it("dispatches to gtag when analytics consent is granted", () => {
      setConsent("analytics", true);
      trackEvent("page_view", { page_path: "/home" });
      expect(gtagMock).toHaveBeenCalledWith("event", "page_view", expect.objectContaining({ page_path: "/home" }));
    });

    it("dispatches to dataLayer when analytics consent is granted", () => {
      setConsent("analytics", true);
      trackEvent("lead_created", { source: "contact_form" });
      expect(mockWindow.dataLayer.length).toBeGreaterThan(0);
    });

    it("does not dispatch to fbq when only analytics consent is granted (no marketing)", () => {
      setConsent("analytics", true);
      trackEvent("lead_created");
      expect(fbqMock).not.toHaveBeenCalled();
    });

    it("dispatches to fbq when marketing consent is granted for mapped events", () => {
      setConsent("analytics", true);
      setConsent("marketing", true);
      trackEvent("lead_created");
      expect(fbqMock).toHaveBeenCalledWith("track", "Lead", expect.any(Object));
    });

    it("strips sensitive fields before dispatching", () => {
      setConsent("analytics", true);
      trackEvent("application_started", {
        applicationId: "app-123",
        country: "Germany",
      });
      expect(gtagMock).toHaveBeenCalledWith(
        "event",
        "application_started",
        expect.objectContaining({ country: "Germany" }),
      );
      // applicationId should NOT be in the call args
      const call = (gtagMock ).mock.calls[0];
      const params = call[2] as Record<string, unknown>;
      expect(params).not.toHaveProperty("applicationId");
    });
  });

  describe("trackEvent event name → Meta Pixel mapping", () => {
    beforeEach(() => {
      setConsent("analytics", true);
      setConsent("marketing", true);
    });

    it("maps lead_created → Lead", () => {
      trackEvent("lead_created");
      expect(fbqMock).toHaveBeenCalledWith("track", "Lead", expect.any(Object));
    });

    it("maps contact_submit → Contact", () => {
      trackEvent("contact_submit");
      expect(fbqMock).toHaveBeenCalledWith("track", "Contact", expect.any(Object));
    });

    it("maps register → CompleteRegistration", () => {
      trackEvent("register");
      expect(fbqMock).toHaveBeenCalledWith("track", "CompleteRegistration", expect.any(Object));
    });

    it("maps page_view → PageView", () => {
      trackEvent("page_view");
      expect(fbqMock).toHaveBeenCalledWith("track", "PageView", expect.any(Object));
    });

    it("does not map unknown events to Meta (no fbq call)", () => {
      trackEvent("university_view");
      // fbq should not be called for university_view (no Meta mapping)
      const calls = (fbqMock ).mock.calls;
      const hasPageView = calls.some((c) => c[1] === "PageView");
      const hasOther = calls.some((c) => ["Lead", "Contact", "CompleteRegistration"].includes(c[1] as string));
      // We expect NO Meta mapping for university_view
      expect(hasPageView || hasOther).toBe(false);
    });
  });

  describe("Consent change event", () => {
    it("dispatches svms:consent-change event on setConsent", () => {
      const handler = vi.fn();
      window.addEventListener("svms:consent-change", handler);
      setConsent("analytics", true);
      expect(handler).toHaveBeenCalled();
      const detail = handler.mock.calls[0][0].detail as ConsentMap;
      expect(detail.analytics).toBe(true);
      window.removeEventListener("svms:consent-change", handler);
    });
  });
});
