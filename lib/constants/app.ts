/**
 * App-wide display configuration for Euroscope.
 *
 * Euroscope is a European education and student visa management
 * platform. Values come from the environment so the same build can
 * be branded per deployment, but the defaults reflect the Euroscope
 * European premium identity.
 */
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME?.trim() || "Euroscope";
export const APP_SHORT_NAME = process.env.NEXT_PUBLIC_APP_SHORT_NAME?.trim() || "Euroscope";
export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") || "http://localhost:3000";
export const APP_THEME_COLOR = process.env.NEXT_PUBLIC_APP_THEME_COLOR?.trim() || "#1e40af";
export const APP_BACKGROUND_COLOR = process.env.NEXT_PUBLIC_APP_BACKGROUND_COLOR?.trim() || "#fafaf9";

/**
 * The canonical marketing tagline used in metadata, the hero, and
 * the footer. Kept here so the same string is reused everywhere.
 */
export const APP_TAGLINE = "Study in Europe. Start Your Future.";
export const APP_DESCRIPTION =
  "Euroscope helps students manage their entire European study journey — from choosing the right university to preparing your application and visa — all in one place.";
