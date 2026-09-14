import { describe, it, expect } from "vitest";
import { computeProfileCompletion, PROFILE_SECTIONS } from "@/lib/utils/profile-completion";

describe("computeProfileCompletion", () => {
  it("returns 0% for an empty profile", () => {
    const r = computeProfileCompletion({
      firstName: "",
      lastName: "",
      dateOfBirth: null,
      gender: null,
      nationality: null,
      profilePhotoUrl: null,
      email: "",
      phone: null,
      whatsapp: null,
      alternativePhone: null,
      country: null,
      division: null,
      district: null,
      city: null,
      address: null,
      postalCode: null,
      passportNumber: null,
      passportIssueDate: null,
      passportExpiryDate: null,
      passportIssuingCountry: null,
      emergencyContactName: null,
      emergencyContactPhone: null,
      emergencyContactRelation: null,
      academicRecords: [],
      englishProficiencies: [],
    });
    expect(r.percent).toBe(0);
    expect(r.filled).toBe(0);
    expect(r.missing.length).toBeGreaterThan(0);
  });

  it("counts an academic record as filling the academic section", () => {
    const r = computeProfileCompletion({
      academicRecords: [{ id: "rec-1" }],
      englishProficiencies: [],
      firstName: "Karim",
      lastName: "Ahmed",
      email: "k@x.com",
    });
    const academic = r.bySection.find((s) => s.key === "academic");
    expect(academic?.filled).toBe(1);
    expect(academic?.percent).toBe(100);
  });

  it("counts an english proficiency as filling the english section", () => {
    const r = computeProfileCompletion({
      academicRecords: [],
      englishProficiencies: [{ id: "ep-1" }],
      firstName: "Karim",
      lastName: "Ahmed",
      email: "k@x.com",
    });
    const english = r.bySection.find((s) => s.key === "english");
    expect(english?.filled).toBe(1);
    expect(english?.percent).toBe(100);
  });

  it("treats whitespace-only strings as empty", () => {
    const r = computeProfileCompletion({
      firstName: "   ",
      lastName: "Ahmed",
    });
    const personal = r.bySection.find((s) => s.key === "personal");
    // personal has 6 fields; firstName counts as missing, lastName counts as filled
    expect(personal?.filled).toBe(1);
  });

  it("caps percent at 100 for a fully-filled profile", () => {
    const r = computeProfileCompletion({
      firstName: "Karim",
      lastName: "Ahmed",
      dateOfBirth: new Date("2000-01-01"),
      gender: "MALE",
      nationality: "Bangladeshi",
      profilePhotoUrl: "/uploads/x.jpg",
      email: "k@x.com",
      phone: "+880",
      whatsapp: "+880",
      country: "Bangladesh",
      division: "Dhaka",
      district: "Dhaka",
      city: "Dhaka",
      address: "123 Road",
      postalCode: "1207",
      passportNumber: "AB1234567",
      passportIssueDate: new Date("2020-01-01"),
      passportExpiryDate: new Date("2030-01-01"),
      passportIssuingCountry: "Bangladesh",
      emergencyContactName: "Mom",
      emergencyContactPhone: "+880",
      emergencyContactRelation: "Parent",
      academicRecords: [{ id: "r1" }],
      englishProficiencies: [{ id: "e1" }],
    });
    expect(r.percent).toBe(100);
    expect(r.missing.length).toBe(0);
  });

  it("groups missing fields by section so the UI can highlight them", () => {
    const r = computeProfileCompletion({
      firstName: "Karim",
      lastName: "Ahmed",
      email: "k@x.com",
    });
    // Each missing field has section + sectionKey + label
    for (const m of r.missing) {
      expect(m.section).toBeTruthy();
      expect(m.sectionKey).toBeTruthy();
      expect(m.label).toBeTruthy();
      expect(m.path).toBeTruthy();
    }
  });

  it("PROFILE_SECTIONS has the 7 required sections (academic and english are meta)", () => {
    const keys = PROFILE_SECTIONS.map((s) => s.key);
    expect(keys).toEqual([
      "personal",
      "contact",
      "address",
      "passport",
      "academic",
      "english",
      "emergency",
    ]);
  });
});
