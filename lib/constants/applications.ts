/**
 * Pure application helpers — shared by service, API validation, and tests.
 */

/** Canonical default pipeline; the live pipeline is the ApplicationStage table. */
export const DEFAULT_PIPELINE = [
  "LEAD", "COUNSELING", "PROFILE_ASSESSMENT", "COUNTRY_SELECTION",
  "UNIVERSITY_SELECTION", "DOCUMENT_COLLECTION", "APPLICATION_SUBMITTED",
  "CONDITIONAL_OFFER", "UNCONDITIONAL_OFFER", "DEPOSIT_PAYMENT", "CONFIRMATION",
  "VISA_PREPARATION", "VISA_SUBMITTED", "BIOMETRICS", "INTERVIEW",
  "VISA_DECISION", "TRAVEL_PREPARATION", "COMPLETED",
] as const;

/** Format an application number: SV-YYYY-XXXXXX (zero-padded, min width 6). */
export function formatApplicationNumber(year: number, sequence: number): string {
  if (!Number.isInteger(year) || year < 2000 || year > 2999) {
    throw new RangeError("year must be between 2000 and 2999");
  }
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 999999) {
    throw new RangeError("sequence must be between 1 and 999999");
  }
  return `SV-${year}-${String(sequence).padStart(6, "0")}`;
}

const APP_NUMBER_RE = /^SV-(\d{4})-(\d{6})$/;

/** Validate the SV-YYYY-XXXXXX format and return its parts. */
export function parseApplicationNumber(
  value: string
): { year: number; sequence: number } | null {
  const match = APP_NUMBER_RE.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const sequence = Number(match[2]);
  if (sequence < 1) return null;
  return { year, sequence };
}
