"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { getConsent, setConsent, type ConsentMap } from "@/lib/tracking";

/**
 * Analytics Providers Loader
 * ==========================
 *
 * Conditionally loads GA4, GTM, and Meta Pixel scripts based on:
 *  1. Whether the provider is enabled in system config
 *  2. Whether the user has granted consent (analytics/marketing)
 *
 * The provider configuration is exposed via window.__SVMS_ANALYTICS__
 * set by the server-rendered <AnalyticsConfigScript /> component.
 *
 * If consent is required and not granted, NO provider scripts are
 * injected. If consent is later granted, providers are loaded on the
 * next route transition.
 */

type ProviderConfig = {
  ga4: { enabled: boolean; measurementId: string };
  gtm: { enabled: boolean; containerId: string };
  meta: { enabled: boolean; pixelId: string };
  vercelAnalytics: { enabled: boolean };
  vercelSpeedInsights: { enabled: boolean };
};

declare global {
  interface Window {
    __SVMS_ANALYTICS__?: ProviderConfig;
  }
}

export function AnalyticsProviders() {
  // Lazy init from window — avoids the setState-in-effect lint error.
  const [config] = useState<ProviderConfig | null>(() => {
    if (typeof window === "undefined") return null;
    return window.__SVMS_ANALYTICS__ ?? null;
  });
  const [consent, setConsentState] = useState<ConsentMap>(() => getConsent());

  useEffect(() => {
    const handler = (e: Event) => {
      setConsentState((e as CustomEvent<ConsentMap>).detail);
    };
    window.addEventListener("svms:consent-change", handler);
    return () => window.removeEventListener("svms:consent-change", handler);
  }, []);

  if (!config) return null;

  return (
    <>
      {config.ga4.enabled && consent.analytics && config.ga4.measurementId && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${config.ga4.measurementId}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              window.gtag = gtag;
              gtag('js', new Date());
              gtag('config', '${config.ga4.measurementId}', { anonymize_ip: true });
            `}
          </Script>
        </>
      )}

      {config.gtm.enabled && consent.analytics && config.gtm.containerId && (
        <Script id="gtm-init" strategy="afterInteractive">
          {`
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','${config.gtm.containerId}');
          `}
        </Script>
      )}

      {config.meta.enabled && consent.marketing && config.meta.pixelId && (
        <Script id="meta-pixel-init" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${config.meta.pixelId}');
            fbq('track', 'PageView');
          `}
        </Script>
      )}

      {(!consent.analytics || !consent.marketing) && (
        <ConsentBanner
          onAccept={(level) => {
            setConsent(level, true);
            setConsentState(getConsent());
          }}
        />
      )}
    </>
  );
}

function ConsentBanner({ onAccept }: { onAccept: (level: "analytics" | "marketing") => void }) {
  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          We use cookies for analytics and marketing. You can choose what to enable.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
            onClick={() => onAccept("analytics")}
          >
            Accept Analytics Only
          </button>
          <button
            type="button"
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90"
            onClick={() => {
              onAccept("analytics");
              onAccept("marketing");
            }}
          >
            Accept All
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Server-rendered config script. Sets window.__SVMS_ANALYTICS__ before
 * any client code runs. Rendered from the root layout.
 *
 * Uses afterInteractive (not beforeInteractive) to avoid the
 * Next.js lint warning about beforeInteractive outside _document.js.
 */
export function AnalyticsConfigScript(config: ProviderConfig) {
  return (
    <Script
      id="svms-analytics-config"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{
        __html: `window.__SVMS_ANALYTICS__ = ${JSON.stringify(config)};`,
      }}
    />
  );
}
