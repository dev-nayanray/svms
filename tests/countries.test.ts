import { describe, it, expect } from "vitest";
import {
  COUNTRY_STATUSES,
  COUNTRY_STATUS_LABELS,
  DOC_REQUIREMENT_SCOPES,
  DOC_REQUIREMENT_SCOPE_LABELS,
  normalizeCountryCode,
  resolveCountryFlag,
  archiveBlockReason,
  countrySlug,
} from "@/lib/constants/countries";
import { countryFlag } from "@/lib/utils/country";
import {
  countrySchema,
  countryUpdateSchema,
  visaRequirementCreateSchema,
  visaRequirementUpdateSchema,
  documentRequirementSchema,
  documentRequirementUpdateSchema,
} from "@/lib/validations";

describe("country enums", () => {
  it("exposes exactly ACTIVE and INACTIVE", () => {
    expect(COUNTRY_STATUSES).toEqual(["ACTIVE", "INACTIVE"]);
  });

  it("provides labels for every status", () => {
    for (const s of COUNTRY_STATUSES) {
      expect(COUNTRY_STATUS_LABELS[s]).toBe(s[0] + s.slice(1).toLowerCase());
    }
  });

  it("document-requirement scopes are stable and labelled", () => {
    expect(DOC_REQUIREMENT_SCOPES).toEqual(["APPLICATION", "VISA", "PROFILE"]);
    expect(DOC_REQUIREMENT_SCOPE_LABELS.VISA).toBe("Visa");
  });
});

describe("normalizeCountryCode", () => {
  it("uppercases and trims", () => {
    expect(normalizeCountryCode("  gb ")).toBe("GB");
    expect(normalizeCountryCode("usa")).toBe("USA");
    expect(normalizeCountryCode("Ca")).toBe("CA");
  });

  it("strips interior whitespace", () => {
    expect(normalizeCountryCode("g b")).toBe("GB");
  });

  it("returns empty string for nullish/blank input", () => {
    expect(normalizeCountryCode(null)).toBe("");
    expect(normalizeCountryCode(undefined)).toBe("");
    expect(normalizeCountryCode("   ")).toBe("");
  });
});

describe("countryFlag (emoji from alpha-2)", () => {
  it("returns the regional-indicator emoji pair for valid codes", () => {
    expect(countryFlag("GB")).toBe("🇬🇧");
    expect(countryFlag("US")).toBe("🇺🇸");
    expect(countryFlag("ca")).toBe("🇨🇦");
  });

  it("returns null for non-2-letter input (alpha-3 codes have no emoji)", () => {
    expect(countryFlag("USA")).toBeNull();
    expect(countryFlag(null)).toBeNull();
    expect(countryFlag("")).toBeNull();
    expect(countryFlag("X")).toBeNull();
    expect(countryFlag("ABCD")).toBeNull();
  });
});

describe("resolveCountryFlag", () => {
  it("prefers an explicit override", () => {
    expect(resolveCountryFlag("GB", "🇪🇺")).toBe("🇪🇺");
    expect(resolveCountryFlag("USA", "⭐")).toBe("⭐");
  });

  it("falls back to the alpha-2 emoji when no override is set", () => {
    expect(resolveCountryFlag("GB", null)).toBe("🇬🇧");
    expect(resolveCountryFlag("GB", "")).toBe("🇬🇧");
    expect(resolveCountryFlag("GB", undefined)).toBe("🇬🇧");
  });

  it("returns null for alpha-3 codes without an override", () => {
    expect(resolveCountryFlag("USA", null)).toBeNull();
  });

  it("trims override whitespace", () => {
    expect(resolveCountryFlag("GB", "  🇪🇺  ")).toBe("🇪🇺");
  });
});

describe("archiveBlockReason", () => {
  it("allows archiving when no active applications exist", () => {
    expect(archiveBlockReason({ _count: { applications: 0 } })).toBeNull();
    expect(archiveBlockReason({})).toBeNull();
  });

  it("blocks archiving when active applications reference the country", () => {
    const reason = archiveBlockReason({ _count: { applications: 3 } });
    expect(reason).toMatch(/3 active application/);
    expect(reason).toMatch(/deactivate/i);
  });

  it("blocks when already archived", () => {
    expect(archiveBlockReason({ deletedAt: new Date() })).toMatch(/already archived/i);
  });
});

describe("countrySlug", () => {
  it("lowercases and replaces non-alphanumerics with dashes", () => {
    expect(countrySlug("United Kingdom")).toBe("united-kingdom");
    expect(countrySlug("  New Zealand  ")).toBe("new-zealand");
    expect(countrySlug("Côte d'Ivoire")).toBe("c-te-d-ivoire");
  });

  it("strips leading/trailing dashes", () => {
    expect(countrySlug("---Test---")).toBe("test");
  });
});

describe("countrySchema", () => {
  it("requires name and code", () => {
    expect(countrySchema.safeParse({}).success).toBe(false);
    expect(countrySchema.safeParse({ name: "X" }).success).toBe(false);
    expect(countrySchema.safeParse({ name: "X", code: "GB" }).success).toBe(true);
  });

  it("rejects codes that are too short, too long, or non-alpha", () => {
    expect(countrySchema.safeParse({ name: "X", code: "A" }).success).toBe(false);
    expect(countrySchema.safeParse({ name: "X", code: "ABCD" }).success).toBe(false);
    expect(countrySchema.safeParse({ name: "X", code: "12" }).success).toBe(false);
    expect(countrySchema.safeParse({ name: "X", code: "G1" }).success).toBe(false);
  });

  it("accepts 2 or 3 letter codes (mixed case)", () => {
    expect(countrySchema.safeParse({ name: "X", code: "gb" }).success).toBe(true);
    expect(countrySchema.safeParse({ name: "X", code: "USA" }).success).toBe(true);
  });

  it("defaults status to ACTIVE and accepts the flag override", () => {
    const parsed = countrySchema.parse({ name: "X", code: "GB", flag: "🇬🇧" });
    expect(parsed.status).toBe("ACTIVE");
    expect(parsed.flag).toBe("🇬🇧");
  });

  it("rejects invalid statuses", () => {
    expect(
      countrySchema.safeParse({ name: "X", code: "GB", status: "BANNED" }).success,
    ).toBe(false);
  });
});

describe("countryUpdateSchema", () => {
  it("is partial and accepts the archive flag", () => {
    expect(countryUpdateSchema.safeParse({}).success).toBe(true);
    expect(countryUpdateSchema.safeParse({ archived: true }).success).toBe(true);
    expect(countryUpdateSchema.safeParse({ name: "X", currency: "GBP" }).success).toBe(true);
  });

  it("still validates the code format when supplied", () => {
    expect(countryUpdateSchema.safeParse({ code: "TOOLONG" }).success).toBe(false);
  });
});

describe("visaRequirementCreateSchema", () => {
  it("requires countryId and name", () => {
    expect(visaRequirementCreateSchema.safeParse({ countryId: "c1" }).success).toBe(false);
    expect(visaRequirementCreateSchema.safeParse({ name: "Passport" }).success).toBe(false);
    expect(
      visaRequirementCreateSchema.safeParse({ countryId: "c1", name: "Passport" }).success,
    ).toBe(true);
  });

  it("defaults required to true and sortOrder to 0 when omitted", () => {
    const parsed = visaRequirementCreateSchema.parse({
      countryId: "c1",
      name: "Photo",
    });
    expect(parsed.required).toBe(true);
    expect(parsed.sortOrder).toBe(0);
    expect(parsed.status).toBe("ACTIVE");
  });

  it("accepts an explicit boolean false for required", () => {
    // The FormDialog's toPayload converts the form's string "false" → boolean
    // false before hitting the API, so the schema only ever sees real
    // booleans from our forms.
    const parsed = visaRequirementCreateSchema.parse({
      countryId: "c1",
      name: "Photo",
      required: false,
    });
    expect(parsed.required).toBe(false);
  });

  it("rejects negative sort order", () => {
    expect(
      visaRequirementCreateSchema.safeParse({
        countryId: "c1",
        name: "X",
        sortOrder: -1,
      }).success,
    ).toBe(false);
  });
});

describe("visaRequirementUpdateSchema", () => {
  it("omits countryId (immutable on update)", () => {
    const parsed = visaRequirementUpdateSchema.safeParse({ countryId: "other" });
    // countryId isn't in the resulting shape; safeParse accepts unknown keys by default,
    // but the parsed output should not carry it
    if (parsed.success) {
      expect(parsed.data).not.toHaveProperty("countryId");
    }
  });

  it("allows partial updates with all optional fields", () => {
    expect(visaRequirementUpdateSchema.safeParse({ name: "Updated" }).success).toBe(true);
    expect(visaRequirementUpdateSchema.safeParse({ status: "INACTIVE" }).success).toBe(true);
  });
});

describe("documentRequirementSchema", () => {
  it("requires name and a lowercase code", () => {
    expect(documentRequirementSchema.safeParse({ name: "X" }).success).toBe(false);
    expect(
      documentRequirementSchema.safeParse({ name: "X", code: "Bank Statement" }).success,
    ).toBe(false);
    expect(
      documentRequirementSchema.safeParse({ name: "X", code: "BANK_STATEMENT" }).success,
    ).toBe(false);
    expect(
      documentRequirementSchema.safeParse({ name: "X", code: "bank_statement" }).success,
    ).toBe(true);
  });

  it("defaults appliesTo to APPLICATION and required to true", () => {
    const parsed = documentRequirementSchema.parse({ name: "X", code: "x" });
    expect(parsed.appliesTo).toBe("APPLICATION");
    expect(parsed.required).toBe(true);
    expect(parsed.status).toBe("ACTIVE");
  });

  it("accepts all three appliesTo values", () => {
    for (const v of DOC_REQUIREMENT_SCOPES) {
      expect(
        documentRequirementSchema.safeParse({
          name: "X",
          code: "x",
          appliesTo: v,
        }).success,
      ).toBe(true);
    }
  });
});

describe("documentRequirementUpdateSchema", () => {
  it("omits the code (immutable on update)", () => {
    const parsed = documentRequirementUpdateSchema.safeParse({ code: "new_code" });
    if (parsed.success) {
      expect(parsed.data).not.toHaveProperty("code");
    }
  });

  it("accepts partial updates", () => {
    expect(documentRequirementUpdateSchema.safeParse({ name: "Updated" }).success).toBe(true);
    expect(
      documentRequirementUpdateSchema.safeParse({ required: false }).success,
    ).toBe(true);
  });
});
