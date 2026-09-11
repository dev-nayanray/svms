"use client";

import { useCallback, useEffect, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Download, Share, PlusSquare, X } from "lucide-react";
import { APP_NAME } from "@/lib/constants/app";
import { detectPlatform, isStandaloneMode } from "@/lib/pwa/install";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function recentlyDismissed(): boolean {
  try {
    const raw = localStorage.getItem("svms-install-dismissed-at");
    if (!raw) return false;
    return Date.now() - Number(raw) < 14 * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

/**
 * Non-intrusive install CTA. Captures beforeinstallprompt when available,
 * falls back to platform-specific instructions on iOS Safari, and honors a
 * 14-day dismissal cooldown stored locally. Visibility is derived at render
 * time from event-driven state — no effects write state directly.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosReady, setIosReady] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [instructionsOpen, setInstructionsOpen] = useState(false);

  useEffect(() => {
    // All state transitions happen inside event callbacks.
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      if (!recentlyDismissed()) setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setStandalone(true);
    const onReady = () => {
      setStandalone(
        isStandaloneMode(
          window.matchMedia("(display-mode: standalone)").matches,
          (window.navigator as { standalone?: boolean }).standalone
        )
      );
      if (!recentlyDismissed()) setIosReady(true);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("load", onReady, { once: true });
    if (document.readyState === "complete") onReady();
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const isIos =
    typeof window !== "undefined" && detectPlatform(window.navigator.userAgent) === "ios-safari";
  const visible = !standalone && !dismissed && (deferred !== null || (isIos && iosReady));

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem("svms-install-dismissed-at", String(Date.now()));
    } catch {
      // Storage unavailable (private mode) — session-only dismissal.
    }
    setDismissed(true);
  }, []);

  const install = useCallback(async () => {
    if (deferred) {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") setDismissed(true);
      setDeferred(null);
    } else {
      setInstructionsOpen(true);
    }
  }, [deferred]);

  if (!visible) return null;

  return (
    <>
      <div
        role="dialog"
        aria-label="Install application"
        className="fixed inset-x-3 bottom-[calc(68px+env(safe-area-inset-bottom))] z-40 flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-lg md:bottom-4 md:left-auto md:right-4 md:max-w-sm"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <Download className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Install {APP_NAME}</p>
          <p className="truncate text-xs text-muted-foreground">Quick access from your home screen.</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={install}
            className="min-h-[44px] rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground focus-visible:outline-2 focus-visible:outline-primary"
          >
            Install
          </button>
          <button
            onClick={dismiss}
            aria-label="Dismiss install prompt"
            className="grid h-11 w-11 place-items-center rounded-md text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      {/* Platform instructions (iOS and unsupported browsers) */}
      <DialogPrimitive.Root open={instructionsOpen} onOpenChange={setInstructionsOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
          <DialogPrimitive.Content className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-sm rounded-xl border border-border bg-card p-4 shadow-xl focus:outline-none md:bottom-auto md:top-1/2 md:-translate-y-1/2">
            <DialogPrimitive.Title className="text-base font-semibold">
              Add {APP_NAME} to your Home Screen
            </DialogPrimitive.Title>
            <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
              {isIos ? (
                <>
                  <li className="flex items-center gap-2">
                    <span className="grid h-8 w-8 place-items-center rounded-md bg-muted text-foreground">
                      <Share className="h-4 w-4" aria-hidden />
                    </span>
                    Tap the <strong className="text-foreground">Share</strong> button in Safari&rsquo;s toolbar.
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="grid h-8 w-8 place-items-center rounded-md bg-muted text-foreground">
                      <PlusSquare className="h-4 w-4" aria-hidden />
                    </span>
                    Choose <strong className="text-foreground">Add to Home Screen</strong>.
                  </li>
                </>
              ) : (
                <li>
                  Open the browser menu (⋮) and choose{" "}
                  <strong className="text-foreground">Install app</strong> or{" "}
                  <strong className="text-foreground">Add to Home screen</strong>. If neither appears, your
                  browser does not support installation — {APP_NAME} also works from the browser.
                </li>
              )}
            </ol>
            <DialogPrimitive.Close className="mt-4 min-h-[44px] w-full rounded-md border border-border px-3 text-sm font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary">
              Got it
            </DialogPrimitive.Close>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
