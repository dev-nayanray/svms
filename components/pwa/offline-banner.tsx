"use client";

import { useEffect, useState } from "react";
import { WifiOff, RotateCw } from "lucide-react";

/**
 * Global connectivity banner. Shown only when the browser reports offline;
 * the retry button reloads the current page. No data is cached or retried
 * automatically — sensitive operations always require a live connection.
 */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-50 flex items-center justify-center gap-3 bg-warning/15 px-4 py-2 text-sm text-warning-foreground"
    >
      <WifiOff className="h-4 w-4" aria-hidden />
      <span className="font-medium">You are offline</span>
      <span className="hidden sm:inline text-muted-foreground">Check your connection — some actions may be unavailable.</span>
      <button
        onClick={() => window.location.reload()}
        className="flex min-h-[36px] items-center gap-1.5 rounded-md border border-warning-foreground/30 px-2.5 py-1 text-xs font-medium hover:bg-warning/20"
      >
        <RotateCw className="h-3.5 w-3.5" aria-hidden /> Retry
      </button>
    </div>
  );
}
