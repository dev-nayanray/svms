/**
 * Profile completion calculator — pure, unit-testable, used by both the
 * service (server-side, returns the percentage in the API payload) and
 * the UI (client-side, recomputes instantly while editing so the bar
 * animates before the save round-trips).
 *
 * Required fields are grouped by section so the UI can show "Missing:
 * Passport Expiry Date" rather than just a percentage.
 */

export type ProfileSection = {
  key: string;
  label: string;
  /** Field paths within this section that count toward completion. */
  fields: { path: string; label: string }[];
};

export const PROFILE_SECTIONS: ProfileSection[] = [
  {
    key: "personal",
    label: "Personal Information",
    fields: [
      { path: "firstName", label: "First Name" },
      { path: "lastName", label: "Last Name" },
      { path: "dateOfBirth", label: "Date of Birth" },
      { path: "gender", label: "Gender" },
      { path: "nationality", label: "Nationality" },
      { path: "profilePhotoUrl", label: "Profile Photo" },
    ],
  },
  {
    key: "contact",
    label: "Contact Information",
    fields: [
      { path: "email", label: "Email" },
      { path: "phone", label: "Phone" },
      { path: "whatsapp", label: "WhatsApp" },
    ],
  },
  {
    key: "address",
    label: "Address",
    fields: [
      { path: "country", label: "Country" },
      { path: "division", label: "Division" },
      { path: "district", label: "District" },
      { path: "city", label: "City" },
      { path: "address", label: "Address" },
      { path: "postalCode", label: "Postal Code" },
    ],
  },
  {
    key: "passport",
    label: "Passport Information",
    fields: [
      { path: "passportNumber", label: "Passport Number" },
      { path: "passportIssueDate", label: "Issue Date" },
      { path: "passportExpiryDate", label: "Expiry Date" },
      { path: "passportIssuingCountry", label: "Issuing Country" },
    ],
  },
  {
    key: "academic",
    label: "Academic Information",
    fields: [], // computed from academicRecords.length > 0
  },
  {
    key: "english",
    label: "English Proficiency",
    fields: [], // computed from englishProficiencies.length > 0
  },
  {
    key: "emergency",
    label: "Emergency Contact",
    fields: [
      { path: "emergencyContactName", label: "Contact Name" },
      { path: "emergencyContactPhone", label: "Contact Phone" },
      { path: "emergencyContactRelation", label: "Relationship" },
    ],
  },
];

export type ProfileLike = {
  // personal
  firstName?: string | null;
  lastName?: string | null;
  dateOfBirth?: Date | string | null;
  gender?: string | null;
  nationality?: string | null;
  profilePhotoUrl?: string | null;
  // contact
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  alternativePhone?: string | null;
  // address
  country?: string | null;
  division?: string | null;
  district?: string | null;
  city?: string | null;
  address?: string | null;
  postalCode?: string | null;
  // passport
  passportNumber?: string | null;
  passportIssueDate?: Date | string | null;
  passportExpiryDate?: Date | string | null;
  passportIssuingCountry?: string | null;
  // emergency
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelation?: string | null;
};

export type ProfileCompletionInput = ProfileLike & {
  academicRecords?: { id: string }[];
  englishProficiencies?: { id: string }[];
};

export type MissingField = { section: string; sectionKey: string; path: string; label: string };

export type ProfileCompletionResult = {
  /** 0..100, rounded down. */
  percent: number;
  total: number;
  filled: number;
  missing: MissingField[];
  bySection: { key: string; label: string; percent: number; total: number; filled: number }[];
};

function isFilled(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (v instanceof Date) return !isNaN(v.getTime());
  if (typeof v === "number" || typeof v === "boolean") return true;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

/**
 * Compute the completion percentage and the list of missing fields. The
 * `academic` and `english` sections are "filled" when the student has
 * at least one record of each — they're meta-fields not on the profile
 * object itself.
 */
export function computeProfileCompletion(profile: ProfileCompletionInput): ProfileCompletionResult {
  const missing: MissingField[] = [];
  const bySection: ProfileCompletionResult["bySection"] = [];
  let total = 0;
  let filled = 0;

  for (const section of PROFILE_SECTIONS) {
    let sTotal = 0;
    let sFilled = 0;

    if (section.key === "academic") {
      sTotal = 1;
      sFilled = (profile.academicRecords?.length ?? 0) > 0 ? 1 : 0;
      if (sFilled === 0) {
        missing.push({
          section: section.label,
          sectionKey: section.key,
          path: "academicRecords",
          label: "At least one academic record",
        });
      }
    } else if (section.key === "english") {
      sTotal = 1;
      sFilled = (profile.englishProficiencies?.length ?? 0) > 0 ? 1 : 0;
      if (sFilled === 0) {
        missing.push({
          section: section.label,
          sectionKey: section.key,
          path: "englishProficiencies",
          label: "At least one English test",
        });
      }
    } else {
      for (const f of section.fields) {
        sTotal += 1;
        const v = (profile as Record<string, unknown>)[f.path];
        if (isFilled(v)) {
          sFilled += 1;
        } else {
          missing.push({
            section: section.label,
            sectionKey: section.key,
            path: f.path,
            label: f.label,
          });
        }
      }
    }

    total += sTotal;
    filled += sFilled;
    bySection.push({
      key: section.key,
      label: section.label,
      total: sTotal,
      filled: sFilled,
      percent: sTotal === 0 ? 0 : Math.round((sFilled / sTotal) * 100),
    });
  }

  return {
    total,
    filled,
    percent: total === 0 ? 0 : Math.round((filled / total) * 100),
    missing,
    bySection,
  };
}
