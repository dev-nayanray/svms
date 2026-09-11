import { describe, it, expect } from "vitest";
import {
  studentProfilePatchSchema,
  academicRecordCreateSchema,
  academicRecordUpdateSchema,
  englishProficiencyCreateSchema,
  englishProficiencyUpdateSchema,
  profilePhotoSchema,
} from "@/lib/validations";

describe("studentProfilePatchSchema", () => {
  it("accepts a partial update with only some fields", () => {
    const r = studentProfilePatchSchema.safeParse({ firstName: "Karim", phone: "+880" });
    expect(r.success).toBe(true);
  });

  it("coerces ISO date strings to Date objects", () => {
    const r = studentProfilePatchSchema.safeParse({ dateOfBirth: "2000-01-01" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.dateOfBirth).toBeInstanceOf(Date);
    }
  });

  it("accepts null to clear an optional field", () => {
    const r = studentProfilePatchSchema.safeParse({ phone: null, whatsapp: null });
    expect(r.success).toBe(true);
  });

  it("rejects invalid gender values", () => {
    const r = studentProfilePatchSchema.safeParse({ gender: "OTHER_X" });
    expect(r.success).toBe(false);
  });

  it("rejects overly long strings (max length enforcement)", () => {
    const r = studentProfilePatchSchema.safeParse({ firstName: "x".repeat(81) });
    expect(r.success).toBe(false);
  });

  // SECURITY: these fields must NOT be in the schema at all — the
  // student cannot change role/ownership/etc. through the profile
  // patch endpoint. Even if they're sent, Zod strips them.
  it("silently strips ownership-critical fields (defense-in-depth)", () => {
    const r = studentProfilePatchSchema.safeParse({
      firstName: "Karim",
      studentId: "STD-2026-000001",
      userId: "user-x",
      branchId: "br-1",
      assignedEmployeeId: "emp-1",
      status: "SUSPENDED",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      const data = r.data as Record<string, unknown>;
      expect("studentId" in data).toBe(false);
      expect("userId" in data).toBe(false);
      expect("branchId" in data).toBe(false);
      expect("assignedEmployeeId" in data).toBe(false);
      expect("status" in data).toBe(false);
    }
  });

  it("has no 'email' field — email changes go through verification", () => {
    expect("email" in studentProfilePatchSchema.shape).toBe(false);
  });

  it("has no 'role', 'permissions', or 'internal notes' field", () => {
    const shape = studentProfilePatchSchema.shape as Record<string, unknown>;
    expect("role" in shape).toBe(false);
    expect("permissions" in shape).toBe(false);
    expect("notes" in shape).toBe(false);
  });
});

describe("academicRecordCreateSchema", () => {
  it("requires an institution and a valid level", () => {
    expect(academicRecordCreateSchema.safeParse({ institution: "X" }).success).toBe(false);
    expect(
      academicRecordCreateSchema.safeParse({ level: "SSC", institution: "X" }).success
    ).toBe(true);
  });

  it("accepts all six education levels plus OTHER", () => {
    for (const level of ["SSC", "HSC", "DIPLOMA", "BACHELOR", "MASTER", "PHD", "OTHER"]) {
      expect(
        academicRecordCreateSchema.safeParse({ level, institution: "X" }).success
      ).toBe(true);
    }
  });

  it("rejects an unknown level", () => {
    expect(
      academicRecordCreateSchema.safeParse({ level: "KINDERGARTEN", institution: "X" }).success
    ).toBe(false);
  });

  it("coerces passingYear from string to number", () => {
    const r = academicRecordCreateSchema.safeParse({
      level: "SSC",
      institution: "X",
      passingYear: "2024",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.passingYear).toBe(2024);
  });

  it("rejects passingYear outside the 1900-2100 range", () => {
    expect(
      academicRecordCreateSchema.safeParse({ level: "SSC", institution: "X", passingYear: 1800 })
        .success
    ).toBe(false);
    expect(
      academicRecordCreateSchema.safeParse({ level: "SSC", institution: "X", passingYear: 2200 })
        .success
    ).toBe(false);
  });

  it("update schema is partial (all fields optional)", () => {
    expect(academicRecordUpdateSchema.safeParse({}).success).toBe(true);
    expect(academicRecordUpdateSchema.safeParse({ institution: "New" }).success).toBe(true);
  });
});

describe("englishProficiencyCreateSchema", () => {
  it("requires a valid test type", () => {
    expect(englishProficiencyCreateSchema.safeParse({}).success).toBe(false);
    expect(englishProficiencyCreateSchema.safeParse({ testType: "IELTS" }).success).toBe(true);
  });

  it("accepts IELTS, TOEFL, PTE, DUOLINGO, OTHER", () => {
    for (const t of ["IELTS", "TOEFL", "PTE", "DUOLINGO", "OTHER"]) {
      expect(englishProficiencyCreateSchema.safeParse({ testType: t }).success).toBe(true);
    }
  });

  it("rejects an unknown test type", () => {
    expect(englishProficiencyCreateSchema.safeParse({ testType: "GRE" }).success).toBe(false);
  });

  it("accepts an expiry date (Module 03 extension)", () => {
    const r = englishProficiencyCreateSchema.safeParse({
      testType: "IELTS",
      expiryDate: "2027-01-01",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.expiryDate).toBeInstanceOf(Date);
  });

  it("accepts null to clear the test date", () => {
    const r = englishProficiencyCreateSchema.safeParse({ testType: "IELTS", testDate: null });
    expect(r.success).toBe(true);
  });

  it("rejects negative scores", () => {
    expect(
      englishProficiencyCreateSchema.safeParse({ testType: "IELTS", overallScore: -1 }).success
    ).toBe(false);
  });

  it("update schema is partial", () => {
    expect(englishProficiencyUpdateSchema.safeParse({}).success).toBe(true);
  });
});

describe("profilePhotoSchema", () => {
  it("requires a fileUrl, fileName, mimeType, and fileSize", () => {
    expect(profilePhotoSchema.safeParse({}).success).toBe(false);
  });

  it("accepts a valid photo metadata payload", () => {
    expect(
      profilePhotoSchema.safeParse({
        fileUrl: "/uploads/x.jpg",
        fileName: "photo.jpg",
        mimeType: "image/jpeg",
        fileSize: 100_000,
      }).success
    ).toBe(true);
  });

  it("rejects a file larger than 5MB", () => {
    expect(
      profilePhotoSchema.safeParse({
        fileUrl: "/uploads/x.jpg",
        fileName: "photo.jpg",
        mimeType: "image/jpeg",
        fileSize: 6 * 1024 * 1024,
      }).success
    ).toBe(false);
  });

  it("rejects a non-positive fileSize", () => {
    expect(
      profilePhotoSchema.safeParse({
        fileUrl: "/uploads/x.jpg",
        fileName: "photo.jpg",
        mimeType: "image/jpeg",
        fileSize: 0,
      }).success
    ).toBe(false);
  });
});
