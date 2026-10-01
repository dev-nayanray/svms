"use client";

import { useEffect, useState } from "react";

/**
 * useOnlineStatus — tracks the browser's online/offline state.
 *
 * Returns `true` when `navigator.onLine` is true (and the browser
 * fires the `online` event), `false` otherwise.
 *
 * Used by every student view file to:
 *  - Swap the error card for an "offline" variant when the network drops
 *  - Show a small "Offline" indicator in the refresh row
 *
 * Server-rendered initial value is `true` to avoid hydration mismatches
 * — the effect runs only on the client and corrects the value if the
 * browser is actually offline.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}
