/**
 * App-wide display configuration. Values come from the environment so the
 * same build can be branded per deployment (PWA name, URLs, theme color).
 */
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME?.trim() || "SVMS Student Portal";
export const APP_SHORT_NAME = process.env.NEXT_PUBLIC_APP_SHORT_NAME?.trim() || "SVMS";
export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") || "http://localhost:3000";
export const APP_THEME_COLOR = process.env.NEXT_PUBLIC_APP_THEME_COLOR?.trim() || "#0f766e";
export const APP_BACKGROUND_COLOR = process.env.NEXT_PUBLIC_APP_BACKGROUND_COLOR?.trim() || "#f8fafc";
