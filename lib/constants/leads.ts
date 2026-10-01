/**
 * Canonical lead enums shared by API validation, UI filters, and seed data.
 *
 * Lead lifecycle (Phase 2 of the Lead Management spec):
 *
 *   NEW              — just captured (from website, Telegram, Meta, manual)
 *   PENDING_REVIEW   — waiting for admin to review
 *   APPROVED         — admin approved the lead
 *   ASSIGNED         — counselor assigned (auto or manual)
 *   CONTACTED        — counselor has reached out
 *   FOLLOW_UP        — follow-up scheduled
 *   QUALIFIED        — lead is qualified (interested + able)
 *   CONVERTED        — converted to a Student
 *   REJECTED         — admin rejected the lead
 *   LOST             — lead went cold / not interested
 *
 * Backward compatibility: the old statuses (NEW, CONTACTED, COUNSELING,
 * QUALIFIED, CONVERTED, LOST) are all still valid. COUNSELING maps to
 * CONTACTED in the new lifecycle.
 */

export const LEAD_STATUSES = [
  "NEW",
  "PENDING_REVIEW",
  "APPROVED",
  "ASSIGNED",
  "CONTACTED",
  "FOLLOW_UP",
  "QUALIFIED",
  "CONVERTED",
  "REJECTED",
  "LOST",
  // Legacy statuses (kept for backward compatibility with existing data)
  "COUNSELING",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUSES_ADMIN = ["ADMIN", "EMPLOYEE"] as const;

/** Human-readable labels for the UI — never show raw status codes to users. */
export const LEAD_STATUS_LABELS: Record<string, string> = {
  NEW: "New",
  PENDING_REVIEW: "Pending Review",
  APPROVED: "Approved",
  ASSIGNED: "Assigned",
  CONTACTED: "Contacted",
  FOLLOW_UP: "Follow-up",
  QUALIFIED: "Qualified",
  CONVERTED: "Converted",
  REJECTED: "Rejected",
  LOST: "Lost",
  COUNSELING: "In Counseling",
};

/** Status tone for badges — controls the color. */
export const LEAD_STATUS_TONES: Record<string, "default" | "success" | "warning" | "destructive" | "info"> = {
  NEW: "info",
  PENDING_REVIEW: "warning",
  APPROVED: "success",
  ASSIGNED: "info",
  CONTACTED: "info",
  FOLLOW_UP: "warning",
  QUALIFIED: "success",
  CONVERTED: "success",
  REJECTED: "destructive",
  LOST: "default",
  COUNSELING: "info",
};

export const LEAD_SOURCES = [
  "WEBSITE",
  "TELEGRAM",
  "META",
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
  TELEGRAM: "Telegram",
  META: "Meta",
  FACEBOOK: "Facebook",
  WHATSAPP: "WhatsApp",
  REFERRAL: "Referral",
  WALK_IN: "Walk-in",
  CAMPAIGN: "Campaign",
  AGENT: "Agent",
  OTHER: "Other",
};

export const LEAD_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type LeadPriority = (typeof LEAD_PRIORITIES)[number];

export const LEAD_PRIORITY_LABELS: Record<LeadPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

export const LEAD_PRIORITY_TONES: Record<LeadPriority, "default" | "info" | "warning" | "destructive"> = {
  LOW: "default",
  MEDIUM: "info",
  HIGH: "warning",
  URGENT: "destructive",
};

/**
 * Valid status transitions — enforced by the lead service.
 * Prevents invalid transitions (e.g. REJECTED → APPROVED without re-review).
 */
export const LEAD_STATUS_TRANSITIONS: Record<string, string[]> = {
  NEW: ["PENDING_REVIEW", "APPROVED", "REJECTED", "LOST"],
  PENDING_REVIEW: ["APPROVED", "REJECTED", "LOST"],
  APPROVED: ["ASSIGNED", "REJECTED", "LOST"],
  ASSIGNED: ["CONTACTED", "LOST"],
  CONTACTED: ["FOLLOW_UP", "QUALIFIED", "LOST"],
  FOLLOW_UP: ["CONTACTED", "QUALIFIED", "LOST"],
  QUALIFIED: ["CONVERTED", "LOST"],
  CONVERTED: [],
  REJECTED: ["PENDING_REVIEW"], // allow re-review
  LOST: ["PENDING_REVIEW", "NEW"], // allow re-activation
  COUNSELING: ["FOLLOW_UP", "QUALIFIED", "CONVERTED", "LOST"],
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

/**
 * Check if a status transition is valid.
 */
export function isValidTransition(from: string, to: string): boolean {
  const allowed = LEAD_STATUS_TRANSITIONS[from] ?? [];
  return allowed.includes(to);
}
