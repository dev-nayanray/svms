/**
 * Pure install-detection logic for the PWA install experience. Kept free of
 * browser globals so it is unit-testable; components feed it real values.
 */

export const DISMISS_STORAGE_KEY = "svms-install-dismissed-at";
/** Re-show the install CTA two weeks after the student dismissed it. */
export const DISMISS_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;

export type InstallPlatform = "android-chrome" | "ios-safari" | "other";

export function isStandaloneMode(
  displayModeStandalone: boolean,
  navigatorStandalone: boolean | undefined
): boolean {
  return displayModeStandalone || navigatorStandalone === true;
}

export function detectPlatform(userAgent: string): InstallPlatform {
  const ua = userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua) && /safari/.test(ua) && !/crios|fxios|edgios/.test(ua)) return "ios-safari";
  if (/android/.test(ua) && /chrome|chromium|webview/.test(ua)) return "android-chrome";
  return "other";
}

/**
 * Decides whether the non-intrusive install CTA should be rendered.
 * `dismissedAtMs` is the timestamp the user last dismissed the prompt
 * (null when never dismissed).
 */
export function shouldShowInstallCta(
  opts: {
    standalone: boolean;
    dismissedAtMs: number | null;
    nowMs: number;
    canInstallOrIsIos: boolean;
  }
): boolean {
  if (opts.standalone) return false;
  if (!opts.canInstallOrIsIos) return false;
  if (opts.dismissedAtMs != null) {
    if (Number.isNaN(opts.dismissedAtMs)) return false;
    if (opts.nowMs - opts.dismissedAtMs < DISMISS_COOLDOWN_MS) return false;
  }
  return true;
}
