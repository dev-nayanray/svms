# Analytics Configuration

This document describes the analytics + tracking architecture for the
Euroscope SVMS.

> **Live, interactive version**: `/admin/system/analytics` in the admin panel.

## Architecture

### Provider configuration

Stored in `SystemSetting` (JSON-valued). Updated via the admin UI:

| Provider | Config key | Validation |
|----------|------------|------------|
| Google Analytics 4 | `analytics.ga4.enabled`, `analytics.ga4.measurementId` | `G-XXXXXXXX` |
| Google Tag Manager | `analytics.gtm.enabled`, `analytics.gtm.containerId` | `GTM-XXXXXXX` |
| Meta Pixel | `analytics.meta.enabled`, `analytics.meta.pixelId` | 15-16 digit numeric |
| Vercel Analytics | `analytics.vercelAnalytics.enabled` | boolean |
| Vercel Speed Insights | `analytics.vercelSpeedInsights.enabled` | boolean |

### Consent system

Three-level consent:

| Level | Default | What it covers |
|-------|---------|----------------|
| `necessary` | Always on | Auth, security cookies. Required for the app to function. |
| `analytics` | Off (user opts in) | GA4, GTM. Aggregated, anonymous traffic data. |
| `marketing` | Off (user opts in) | Meta Pixel. Retargeting + conversion tracking. |

Consent is stored in `localStorage["svms-consent"]` and dispatched as
a `svms:consent-change` CustomEvent on change.

### Provider loading

`<AnalyticsProviders />` (in `app/layout.tsx`) conditionally loads
provider scripts based on:
1. Whether the provider is enabled in config.
2. Whether the user has granted the appropriate consent.

Scripts are loaded via `next/script` with `strategy="afterInteractive"`.
No marketing/analytics scripts load before consent.

### trackEvent() abstraction

The client-side `trackEvent()` function is the single entry point for
all event tracking:

```ts
import { trackEvent } from "@/lib/tracking";

// Plain event — no params
trackEvent("page_view");

// Event with params (sensitive fields are stripped automatically)
trackEvent("application_started", { country: "Germany", source: "search" });
```

**Event → Meta Pixel mapping**:

| Our event | Meta Pixel standard event |
|-----------|---------------------------|
| `page_view` | `PageView` |
| `lead_created` | `Lead` |
| `counseling_request` | `Lead` |
| `contact_submit` | `Contact` |
| `register` | `CompleteRegistration` |
| `application_submitted` | `CompleteRegistration` |

### Sensitive data filtering

`trackEvent()` automatically strips these fields before dispatching to
any provider:

- `email`, `phone`, `phoneNumber`
- `passport`, `passportNumber`, `nationalId`, `nid`
- `password`, `passwordHash`
- `documentId`, `applicationId`, `paymentId`, `invoiceId`, `studentId`, `userId`
- `name`, `address`, `dob`, `dateOfBirth`
- `token`, `secret`

Plus any string value matching patterns like:
- Email addresses (`/user@domain/`)
- Passport-like strings (`/passport/i`)
- National-ID-like strings (`/national.?id/i`)
- Long numeric strings (`/^[\d.]{8,}$/`)

### Test events

Admins can dispatch a test event via `/admin/system/analytics` →
"Test Event Dispatcher". The event is logged to `SecurityEvent` for
audit purposes. Actual provider dispatch happens client-side (the
server can't call `window.gtag`).

## Consent banner

The consent banner is rendered by `<AnalyticsProviders />` only when:
1. Consent is required (`tracking.consent.required=true`, default).
2. The user has not yet granted analytics or marketing consent.

The banner offers two buttons:
- **Accept Analytics Only** — grants `analytics=true`.
- **Accept All** — grants `analytics=true` + `marketing=true`.

Users can revoke consent at any time by clearing `localStorage["svms-consent"]`.

## Production checklist

- [ ] `NEXT_PUBLIC_GA4_MEASUREMENT_ID` set (if using GA4)
- [ ] `NEXT_PUBLIC_GTM_CONTAINER_ID` set (if using GTM)
- [ ] `NEXT_PUBLIC_META_PIXEL_ID` set (if using Meta Pixel)
- [ ] At least one provider enabled in `/admin/system/analytics`
- [ ] Consent banner appears for new visitors
- [ ] Verify event dispatch via browser dev tools (Network tab)
- [ ] Confirm no sensitive data is sent to providers (check `trackEvent` calls)

## Privacy notes

- The consent system is designed to be GDPR/CCPA-compatible.
- No tracking scripts load before consent.
- Users can revoke consent by clearing `localStorage["svms-consent"]`.
- The `trackEvent()` function is the single chokepoint for sensitive data.
  Adding new events requires updating the `TrackEventName` type and (optionally)
  the `META_EVENT_MAP`.
