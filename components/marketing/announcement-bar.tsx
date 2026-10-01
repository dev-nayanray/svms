"use client";

import { useState } from "react";
import Link from "next/link";
import type { AnnouncementConfig } from "@/lib/marketing/cms";
import { X } from "lucide-react";

/**
 * AnnouncementBar — dismissible top banner for the marketing site.
 *
 * Receives the announcement config from the server layout (which calls
 * getCmsConfig()). Renders only if `active` is true (which the server
 * computes via isAnnouncementActive, checking start/end scheduling).
 *
 * Dismiss state is stored in localStorage so a dismissed announcement
 * doesn't reappear on every page navigation. If the announcement message
 * changes, the dismiss is reset (keyed by message hash).
 *
 * Accessibility:
 *  - role="status" so screen readers announce it
 *  - aria-label on the dismiss button
 *  - keyboard accessible (the dismiss button is a <button>)
 *  - respects prefers-reduced-motion (no animation)
 */
export function AnnouncementBar({ announcement }: { announcement: AnnouncementConfig & { active?: boolean } }) {
  // Key by the message so a new announcement re-shows the bar
  const storageKey = `svms-announcement-${announcement.message.slice(0, 40)}`;
  // Lazy-init from localStorage — avoids setState-in-effect lint warning
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    if (!announcement.dismissible) return false;
    try {
      return localStorage.getItem(storageKey) === "dismissed";
    } catch {
      return false;
    }
  });

  if (!announcement.active || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(storageKey, "dismissed");
    } catch {
      // ignore
    }
  };

  return (
    <div
      role="status"
      className="relative z-[60] flex items-center justify-center gap-3 px-4 py-2.5 text-sm"
      style={{
        background: "linear-gradient(90deg, #1e293b 0%, #0f172a 100%)",
        color: "#fff",
      }}
    >
      <p className="flex-1 text-center text-xs sm:text-sm">
        {announcement.message}
        {announcement.linkUrl && announcement.linkText && (
          <Link
            href={announcement.linkUrl}
            className="ml-2 inline-flex items-center gap-1 rounded-md border border-white/20 px-2 py-0.5 text-xs font-semibold transition-colors hover:bg-white/10"
          >
            {announcement.linkText}
            <span aria-hidden>→</span>
          </Link>
        )}
      </p>
      {announcement.dismissible && (
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss announcement"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
