"use client";

import { useEffect } from "react";
import { InstallPrompt } from "@/components/pwa/install-prompt";

/**
 * Registers the service worker (production only — never cache in dev) and
 * renders the install CTA. Mounted inside the authenticated shells so only
 * signed-in users get the PWA experience.
 */
export function PwaProvider({ withInstallPrompt = true }: { withInstallPrompt?: boolean }) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    const register = () =>
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // Registration failure must never break the app.
      });
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  if (!withInstallPrompt) return null;
  return <InstallPrompt />;
}
