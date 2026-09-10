/** Canonical lead enums shared by API validation, UI filters, and seed data. */

export const LEAD_STATUSES = [
  "NEW",
  "CONTACTED",
  "COUNSELING",
  "QUALIFIED",
  "CONVERTED",
  "LOST",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUSES_ADMIN = ["ADMIN", "EMPLOYEE"] as const;

export const LEAD_SOURCES = [
  "WEBSITE",
  "FACEBOOK",
  "WHATSAPP",
  "REFERRAL",
  "WALK_IN",
  "CAMPAIGN",
  "AGENT",
  "OTHER",
] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  WEBSITE: "Website",
  FACEBOOK: "Facebook",
  WHATSAPP: "WhatsApp",
  REFERRAL: "Referral",
  WALK_IN: "Walk-in",
  CAMPAIGN: "Campaign",
  AGENT: "Agent",
  OTHER: "Other",
};

/**
 * Pure guard for lead→student conversion. Returns null when conversion is
 * allowed, otherwise a human-readable reason. Used by the service and tests.
 */
export function conversionBlockReason(lead: {
  status: string;
  email?: string | null;
  archivedAt?: Date | null;
  convertedStudentId?: string | null;
}): string | null {
  if (lead.convertedStudentId) return "Lead is already converted";
  if (lead.status === "CONVERTED") return "Lead is already converted";
  if (lead.archivedAt) return "Archived leads cannot be converted";
  if (!lead.email) return "Lead must have an email to convert";
  return null;
}
