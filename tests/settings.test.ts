import { describe, it, expect } from "vitest";
import {
  SETTING_SECTIONS,
  SECRET_KEYS,
  SECRET_MASK,
  isSecretKey,
  maskSecretValue,
  getSettingSection,
  getAllSettingKeys,
  getDefaultValue,
  isReadOnly,
} from "@/lib/constants/settings";

describe("setting sections", () => {
  it("exposes 11 sections", () => {
    expect(SETTING_SECTIONS.length).toBe(11);
  });

  it("includes all documented section keys", () => {
    const sectionKeys = SETTING_SECTIONS.map((s) => s.key);
    expect(sectionKeys).toEqual([
      "company",
      "branches",
      "workflow",
      "documents",
      "visa",
      "countries",
      "notifications",
      "email",
      "payments",
      "security",
      "system",
    ]);
  });

  it("every section has a label, icon, description, and at least one setting", () => {
    for (const section of SETTING_SECTIONS) {
      expect(section.label.length).toBeGreaterThan(0);
      expect(section.icon.length).toBeGreaterThan(0);
      expect(section.description.length).toBeGreaterThan(0);
      expect(section.settings.length).toBeGreaterThan(0);
    }
  });

  it("every setting has a unique key across all sections", () => {
    const allKeys = getAllSettingKeys();
    expect(new Set(allKeys).size).toBe(allKeys.length);
  });
});

describe("company section", () => {
  it("has the 5 expected company settings", () => {
    const company = SETTING_SECTIONS.find((s) => s.key === "company");
    expect(company).toBeDefined();
    const keys = company!.settings.map((s) => s.key);
    expect(keys).toContain("company_name");
    expect(keys).toContain("company_logo");
    expect(keys).toContain("company_email");
    expect(keys).toContain("company_phone");
    expect(keys).toContain("company_address");
  });
});

describe("security section", () => {
  it("has session, password, and lockout settings", () => {
    const security = SETTING_SECTIONS.find((s) => s.key === "security");
    expect(security).toBeDefined();
    const keys = security!.settings.map((s) => s.key);
    expect(keys).toContain("session_timeout_minutes");
    expect(keys).toContain("password_min_length");
    expect(keys).toContain("password_require_uppercase");
    expect(keys).toContain("password_require_lowercase");
    expect(keys).toContain("password_require_number");
    expect(keys).toContain("password_require_special");
    expect(keys).toContain("max_login_attempts");
    expect(keys).toContain("lockout_duration_minutes");
  });

  it("has sensible defaults for security settings", () => {
    expect(getDefaultValue("password_min_length")).toBe(8);
    expect(getDefaultValue("session_timeout_minutes")).toBe(60);
    expect(getDefaultValue("max_login_attempts")).toBe(5);
    expect(getDefaultValue("lockout_duration_minutes")).toBe(15);
    expect(getDefaultValue("password_require_uppercase")).toBe(true);
    expect(getDefaultValue("password_require_special")).toBe(false);
  });
});

describe("secret keys", () => {
  it("identifies SMTP password as a secret", () => {
    expect(isSecretKey("email_server_password")).toBe(true);
  });

  it("identifies payment gateway keys as secrets", () => {
    expect(isSecretKey("bkash_merchant_key")).toBe(true);
    expect(isSecretKey("nagad_merchant_key")).toBe(true);
    expect(isSecretKey("stripe_secret_key")).toBe(true);
  });

  it("does NOT identify publishable keys as secrets", () => {
    expect(isSecretKey("stripe_publishable_key")).toBe(false);
  });

  it("does NOT identify non-secret settings as secrets", () => {
    expect(isSecretKey("company_name")).toBe(false);
    expect(isSecretKey("default_currency")).toBe(false);
    expect(isSecretKey("email_server_host")).toBe(false);
    expect(isSecretKey("email_server_user")).toBe(false);
  });

  it("returns false for unknown keys", () => {
    expect(isSecretKey("unknown_key")).toBe(false);
    expect(isSecretKey("")).toBe(false);
  });

  it("SECRET_KEYS list is non-empty", () => {
    expect(SECRET_KEYS.length).toBeGreaterThan(0);
  });

  it("SECRET_MASK is a non-empty string", () => {
    expect(SECRET_MASK.length).toBeGreaterThan(0);
    expect(SECRET_MASK).toBe("••••••••");
  });
});

describe("maskSecretValue", () => {
  it("masks secret values with SECRET_MASK", () => {
    expect(maskSecretValue("email_server_password", "my-secret-password")).toBe(SECRET_MASK);
    expect(maskSecretValue("stripe_secret_key", "sk_live_12345")).toBe(SECRET_MASK);
  });

  it("returns empty string for empty/null secret values", () => {
    expect(maskSecretValue("email_server_password", "")).toBe("");
    expect(maskSecretValue("email_server_password", null)).toBe("");
    expect(maskSecretValue("email_server_password", undefined)).toBe("");
  });

  it("returns the original value for non-secret keys", () => {
    expect(maskSecretValue("company_name", "My Company")).toBe("My Company");
    expect(maskSecretValue("email_server_host", "smtp.gmail.com")).toBe("smtp.gmail.com");
    expect(maskSecretValue("default_currency", "BDT")).toBe("BDT");
  });

  it("returns numbers and booleans unchanged for non-secret keys", () => {
    expect(maskSecretValue("session_timeout_minutes", 60)).toBe(60);
    expect(maskSecretValue("password_require_uppercase", true)).toBe(true);
  });
});

describe("getSettingSection", () => {
  it("returns the correct section for a known key", () => {
    expect(getSettingSection("company_name")?.key).toBe("company");
    expect(getSettingSection("default_currency")?.key).toBe("countries");
    expect(getSettingSection("email_server_password")?.key).toBe("email");
    expect(getSettingSection("password_min_length")?.key).toBe("security");
    expect(getSettingSection("system_version")?.key).toBe("system");
  });

  it("returns null for unknown keys", () => {
    expect(getSettingSection("unknown_key")).toBeNull();
    expect(getSettingSection("")).toBeNull();
  });
});

describe("getAllSettingKeys", () => {
  it("returns keys in section order", () => {
    const keys = getAllSettingKeys();
    // Company keys come before Branches keys
    const companyIdx = keys.indexOf("company_name");
    const branchIdx = keys.indexOf("default_branch_code");
    expect(companyIdx).toBeLessThan(branchIdx);
    expect(companyIdx).toBeGreaterThanOrEqual(0);
  });

  it("returns all keys (no duplicates)", () => {
    const keys = getAllSettingKeys();
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("getDefaultValue", () => {
  it("returns the default value for a known key", () => {
    expect(getDefaultValue("default_currency")).toBe("BDT");
    expect(getDefaultValue("invoice_prefix")).toBe("INV");
    expect(getDefaultValue("timezone")).toBe("Asia/Dhaka");
    expect(getDefaultValue("password_min_length")).toBe(8);
    expect(getDefaultValue("auto_advance_stages")).toBe(false);
    expect(getDefaultValue("auto_create_visa_record")).toBe(true);
  });

  it("returns undefined for unknown keys", () => {
    expect(getDefaultValue("unknown_key")).toBeUndefined();
  });
});

describe("isReadOnly", () => {
  it("returns true for system section keys", () => {
    expect(isReadOnly("system_version")).toBe(true);
    expect(isReadOnly("system_database")).toBe(true);
    expect(isReadOnly("system_environment")).toBe(true);
  });

  it("returns false for non-system section keys", () => {
    expect(isReadOnly("company_name")).toBe(false);
    expect(isReadOnly("default_currency")).toBe(false);
    expect(isReadOnly("email_server_password")).toBe(false);
    expect(isReadOnly("password_min_length")).toBe(false);
  });

  it("returns false for unknown keys", () => {
    expect(isReadOnly("unknown_key")).toBe(false);
  });
});

describe("notification settings", () => {
  it("has toggle settings for each notification category", () => {
    const notifSection = SETTING_SECTIONS.find((s) => s.key === "notifications");
    expect(notifSection).toBeDefined();
    const keys = notifSection!.settings.map((s) => s.key);
    expect(keys).toContain("notif_document_events");
    expect(keys).toContain("notif_application_events");
    expect(keys).toContain("notif_task_events");
    expect(keys).toContain("notif_payment_events");
    expect(keys).toContain("notif_visa_events");
    expect(keys).toContain("notif_message_events");
  });

  it("defaults all notification toggles to true", () => {
    expect(getDefaultValue("notif_document_events")).toBe(true);
    expect(getDefaultValue("notif_application_events")).toBe(true);
    expect(getDefaultValue("notif_payment_events")).toBe(true);
    expect(getDefaultValue("notif_visa_events")).toBe(true);
  });
});

describe("payment settings", () => {
  it("has payment method configuration", () => {
    const paymentSection = SETTING_SECTIONS.find((s) => s.key === "payments");
    expect(paymentSection).toBeDefined();
    const keys = paymentSection!.settings.map((s) => s.key);
    expect(keys).toContain("payment_methods_enabled");
    expect(keys).toContain("bkash_merchant_key");
    expect(keys).toContain("nagad_merchant_key");
    expect(keys).toContain("stripe_secret_key");
    expect(keys).toContain("stripe_publishable_key");
  });

  it("marks merchant keys and stripe secret as secret", () => {
    expect(isSecretKey("bkash_merchant_key")).toBe(true);
    expect(isSecretKey("nagad_merchant_key")).toBe(true);
    expect(isSecretKey("stripe_secret_key")).toBe(true);
  });

  it("does NOT mark stripe publishable key as secret", () => {
    expect(isSecretKey("stripe_publishable_key")).toBe(false);
  });
});
