/** App-wide constants — display name, support links, brand metadata. */
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "Euroscope";
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
export const APP_DESCRIPTION =
  "Study in Europe. Start Your Future. Euroscope helps students manage their entire journey — from choosing the right European university to preparing your application and visa.";
export const SUPPORT_EMAIL = "hello@euroscope.example";

/** European destinations Euroscope is configured to support. */
export const SUPPORTED_DESTINATIONS = [
  { code: "DE", name: "Germany", flag: "🇩🇪", popular: ["Engineering", "Business", "Computer Science"] },
  { code: "FR", name: "France", flag: "🇫🇷", popular: ["Business", "Luxury Management", "Engineering"] },
  { code: "IT", name: "Italy", flag: "🇮🇹", popular: ["Design", "Architecture", "Fashion"] },
  { code: "ES", name: "Spain", flag: "🇪🇸", popular: ["Business", "Tourism", "Hospitality"] },
  { code: "NL", name: "Netherlands", flag: "🇳🇱", popular: ["Engineering", "Business", "Data Science"] },
  { code: "IE", name: "Ireland", flag: "🇮🇪", popular: ["Computer Science", "Pharma", "Finance"] },
  { code: "SE", name: "Sweden", flag: "🇸🇪", popular: ["Sustainability", "Engineering", "Design"] },
  { code: "FI", name: "Finland", flag: "🇫🇮", popular: ["Technology", "Education", "Design"] },
] as const;
