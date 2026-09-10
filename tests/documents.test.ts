import { describe, it, expect } from "vitest";
import {
  DOCUMENT_STATUSES,
  DOCUMENT_STATUS_LABELS,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
  REVIEWABLE_STATUSES,
  DOCUMENT_SORT_KEYS,
  isReviewable,
  canRequestReupload,
  canReject,
  validateFileMeta,
  formatFileSize,
  buildAdminDocumentWhere,
} from "@/lib/constants/documents";
import {
  documentUploadSchema,
  documentReviewSchema,
  documentReuploadSchema,
  documentArchiveSchema,
} from "@/lib/validations";

describe("document enums", () => {
  it("exposes the canonical statuses", () => {
    expect(DOCUMENT_STATUSES).toEqual([
      "REQUESTED",
      "UPLOADED",
      "UNDER_REVIEW",
      "APPROVED",
      "REJECTED",
      "EXPIRED",
    ]);
  });

  it("labels every status", () => {
    expect(DOCUMENT_STATUS_LABELS.REQUESTED).toBe("Requested");
    expect(DOCUMENT_STATUS_LABELS.UPLOADED).toBe("Uploaded");
    expect(DOCUMENT_STATUS_LABELS.UNDER_REVIEW).toBe("Under Review");
    expect(DOCUMENT_STATUS_LABELS.APPROVED).toBe("Approved");
    expect(DOCUMENT_STATUS_LABELS.REJECTED).toBe("Rejected");
    expect(DOCUMENT_STATUS_LABELS.EXPIRED).toBe("Expired");
  });

  it("exposes the allowed MIME types", () => {
    expect(ALLOWED_MIME_TYPES).toContain("application/pdf");
    expect(ALLOWED_MIME_TYPES).toContain("image/jpeg");
    expect(ALLOWED_MIME_TYPES).toContain("image/png");
    expect(ALLOWED_MIME_TYPES).toContain("image/webp");
  });

  it("max file size is 10MB", () => {
    expect(MAX_FILE_SIZE).toBe(10 * 1024 * 1024);
  });

  it("reviewable statuses are UPLOADED, UNDER_REVIEW, REJECTED", () => {
    expect(REVIEWABLE_STATUSES).toEqual(["UPLOADED", "UNDER_REVIEW", "REJECTED"]);
  });

  it("exposes a stable sort allow-list", () => {
    expect(DOCUMENT_SORT_KEYS).toEqual([
      "name",
      "status",
      "uploadedAt",
      "reviewedAt",
      "expiresAt",
      "createdAt",
    ]);
  });
});

describe("isReviewable", () => {
  it("returns true for UPLOADED, UNDER_REVIEW, REJECTED", () => {
    expect(isReviewable("UPLOADED")).toBe(true);
    expect(isReviewable("UNDER_REVIEW")).toBe(true);
    expect(isReviewable("REJECTED")).toBe(true);
  });

  it("returns false for REQUESTED, APPROVED, EXPIRED", () => {
    expect(isReviewable("REQUESTED")).toBe(false);
    expect(isReviewable("APPROVED")).toBe(false);
    expect(isReviewable("EXPIRED")).toBe(false);
  });
});

describe("canRequestReupload", () => {
  it("returns true for UPLOADED, UNDER_REVIEW, APPROVED, REJECTED", () => {
    expect(canRequestReupload("UPLOADED")).toBe(true);
    expect(canRequestReupload("UNDER_REVIEW")).toBe(true);
    expect(canRequestReupload("APPROVED")).toBe(true);
    expect(canRequestReupload("REJECTED")).toBe(true);
  });

  it("returns false for REQUESTED and EXPIRED", () => {
    expect(canRequestReupload("REQUESTED")).toBe(false);
    expect(canRequestReupload("EXPIRED")).toBe(false);
  });
});

describe("canReject", () => {
  it("returns true for UPLOADED, UNDER_REVIEW, REJECTED", () => {
    expect(canReject("UPLOADED")).toBe(true);
    expect(canReject("UNDER_REVIEW")).toBe(true);
    expect(canReject("REJECTED")).toBe(true);
  });

  it("returns false for APPROVED and EXPIRED", () => {
    expect(canReject("APPROVED")).toBe(false);
    expect(canReject("EXPIRED")).toBe(false);
  });
});

describe("validateFileMeta", () => {
  it("returns null for valid PDF within size limit", () => {
    expect(validateFileMeta("application/pdf", 5 * 1024 * 1024)).toBeNull();
  });

  it("returns null for valid image within size limit", () => {
    expect(validateFileMeta("image/jpeg", 1024)).toBeNull();
    expect(validateFileMeta("image/png", 1024)).toBeNull();
    expect(validateFileMeta("image/webp", 1024)).toBeNull();
  });

  it("returns an error for disallowed MIME types", () => {
    expect(validateFileMeta("application/msword", 1024)).toMatch(/not allowed/i);
    expect(validateFileMeta("video/mp4", 1024)).toMatch(/not allowed/i);
    expect(validateFileMeta("text/html", 1024)).toMatch(/not allowed/i);
  });

  it("returns an error when file exceeds the 10MB limit", () => {
    expect(validateFileMeta("application/pdf", 11 * 1024 * 1024)).toMatch(/10MB/i);
  });

  it("accepts a file exactly at the 10MB limit", () => {
    expect(validateFileMeta("application/pdf", MAX_FILE_SIZE)).toBeNull();
  });
});

describe("formatFileSize", () => {
  it("returns em-dash for nullish input", () => {
    expect(formatFileSize(null)).toBe("—");
    expect(formatFileSize(undefined)).toBe("—");
  });

  it("formats bytes below 1KB as B", () => {
    expect(formatFileSize(512)).toBe("512 B");
  });

  it("formats bytes between 1KB and 1MB as KB", () => {
    expect(formatFileSize(1024)).toBe("1.0 KB");
    expect(formatFileSize(1536)).toBe("1.5 KB");
  });

  it("formats bytes at or above 1MB as MB", () => {
    expect(formatFileSize(1024 * 1024)).toBe("1.0 MB");
    expect(formatFileSize(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});

describe("buildAdminDocumentWhere", () => {
  it("filters by deletedAt null when archived=false (default)", () => {
    const where = buildAdminDocumentWhere({});
    expect(where.AND).toContainEqual({ deletedAt: null });
  });

  it("filters by deletedAt not-null when archived=true", () => {
    const where = buildAdminDocumentWhere({ archived: true });
    expect(where.AND).toContainEqual({ deletedAt: { not: null } });
  });

  it("applies status filter as an AND clause", () => {
    const where = buildAdminDocumentWhere({ status: "APPROVED" });
    expect(where.AND).toContainEqual({ status: "APPROVED" });
  });

  it("applies applicationId filter", () => {
    const where = buildAdminDocumentWhere({ applicationId: "app-1" });
    expect(where.AND).toContainEqual({ applicationId: "app-1" });
  });

  it("applies studentId filter", () => {
    const where = buildAdminDocumentWhere({ studentId: "stu-1" });
    expect(where.AND).toContainEqual({ studentId: "stu-1" });
  });

  it("applies employeeId filter via nested student join", () => {
    const where = buildAdminDocumentWhere({ employeeId: "emp-1" });
    expect(where.AND).toContainEqual({
      student: { assignedEmployeeId: "emp-1" },
    });
  });

  it("applies countryId filter via nested application join", () => {
    const where = buildAdminDocumentWhere({ countryId: "c1" });
    expect(where.AND).toContainEqual({
      application: { countryId: "c1" },
    });
  });

  it("searches across document name, file name, and student name", () => {
    const where = buildAdminDocumentWhere({ search: "passport" });
    expect(where.AND).toContainEqual({
      OR: [
        { name: { contains: "passport", mode: "insensitive" } },
        { fileName: { contains: "passport", mode: "insensitive" } },
        {
          student: {
            OR: [
              { firstName: { contains: "passport", mode: "insensitive" } },
              { lastName: { contains: "passport", mode: "insensitive" } },
            ],
          },
        },
      ],
    });
  });

  it("builds a date range filter on uploadedAt (both bounds inclusive)", () => {
    const from = new Date("2026-01-01");
    const to = new Date("2026-12-31");
    const where = buildAdminDocumentWhere({ uploadedFrom: from, uploadedTo: to });
    expect(where.AND).toContainEqual({
      uploadedAt: { gte: from, lte: to },
    });
  });

  it("supports a single-sided date range (from only)", () => {
    const from = new Date("2026-01-01");
    const where = buildAdminDocumentWhere({ uploadedFrom: from });
    expect(where.AND).toContainEqual({ uploadedAt: { gte: from } });
  });

  it("supports a single-sided date range (to only)", () => {
    const to = new Date("2026-12-31");
    const where = buildAdminDocumentWhere({ uploadedTo: to });
    expect(where.AND).toContainEqual({ uploadedAt: { lte: to } });
  });

  it("combines all filters into a single AND chain", () => {
    const where = buildAdminDocumentWhere({
      archived: false,
      status: "UPLOADED",
      countryId: "c1",
      applicationId: "a1",
      studentId: "s1",
      employeeId: "e1",
      search: "passport",
      uploadedFrom: new Date("2026-01-01"),
      uploadedTo: new Date("2026-12-31"),
    });
    // 1 (deletedAt) + 1 (status) + 1 (applicationId) + 1 (studentId) +
    // 1 (employeeId) + 1 (countryId) + 1 (search) + 1 (uploadedAt range)
    expect(where.AND).toHaveLength(8);
  });
});

describe("documentUploadSchema", () => {
  it("requires studentId, name, fileUrl, fileName, mimeType, fileSize", () => {
    expect(documentUploadSchema.safeParse({}).success).toBe(false);
    expect(
      documentUploadSchema.safeParse({
        studentId: "s1",
        name: "Passport",
        fileUrl: "/files/passport.pdf",
        fileName: "passport.pdf",
        mimeType: "application/pdf",
        fileSize: 1024,
      }).success,
    ).toBe(true);
  });

  it("rejects files exceeding the 10MB limit", () => {
    expect(
      documentUploadSchema.safeParse({
        studentId: "s1",
        name: "Big",
        fileUrl: "/files/big.pdf",
        fileName: "big.pdf",
        mimeType: "application/pdf",
        fileSize: 11 * 1024 * 1024,
      }).success,
    ).toBe(false);
  });

  it("rejects negative file sizes", () => {
    expect(
      documentUploadSchema.safeParse({
        studentId: "s1",
        name: "X",
        fileUrl: "/x",
        fileName: "x.pdf",
        mimeType: "application/pdf",
        fileSize: -1,
      }).success,
    ).toBe(false);
  });

  it("accepts optional applicationId and requirementId", () => {
    expect(
      documentUploadSchema.safeParse({
        studentId: "s1",
        applicationId: "a1",
        requirementId: "r1",
        name: "Passport",
        fileUrl: "/x",
        fileName: "x.pdf",
        mimeType: "application/pdf",
        fileSize: 1024,
      }).success,
    ).toBe(true);
  });
});

describe("documentReviewSchema", () => {
  it("accepts APPROVED without a note", () => {
    expect(
      documentReviewSchema.safeParse({ decision: "APPROVED" }).success,
    ).toBe(true);
  });

  it("accepts UNDER_REVIEW without a note", () => {
    expect(
      documentReviewSchema.safeParse({ decision: "UNDER_REVIEW" }).success,
    ).toBe(true);
  });

  it("rejects REJECTED without a reason", () => {
    const result = documentReviewSchema.safeParse({ decision: "REJECTED" });
    expect(result.success).toBe(false);
  });

  it("rejects REJECTED with an empty reason", () => {
    const result = documentReviewSchema.safeParse({
      decision: "REJECTED",
      reviewNote: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects REJECTED with a whitespace-only reason", () => {
    const result = documentReviewSchema.safeParse({
      decision: "REJECTED",
      reviewNote: "   ",
    });
    expect(result.success).toBe(false);
  });

  it("accepts REJECTED with a non-empty reason", () => {
    const result = documentReviewSchema.safeParse({
      decision: "REJECTED",
      reviewNote: "Document is blurry",
    });
    expect(result.success).toBe(true);
  });

  it("rejects unknown decision values", () => {
    expect(
      documentReviewSchema.safeParse({ decision: "PENDING" }).success,
    ).toBe(false);
  });

  it("accepts an optional reviewNote for APPROVED", () => {
    expect(
      documentReviewSchema.safeParse({
        decision: "APPROVED",
        reviewNote: "Looks good",
      }).success,
    ).toBe(true);
  });

  it("rejects reviewNote longer than 2000 chars", () => {
    expect(
      documentReviewSchema.safeParse({
        decision: "APPROVED",
        reviewNote: "a".repeat(2001),
      }).success,
    ).toBe(false);
  });
});

describe("documentReuploadSchema", () => {
  it("requires a reason", () => {
    expect(documentReuploadSchema.safeParse({}).success).toBe(false);
    expect(
      documentReuploadSchema.safeParse({ reason: "" }).success,
    ).toBe(false);
  });

  it("accepts a non-empty reason", () => {
    expect(
      documentReuploadSchema.safeParse({ reason: "Please re-upload" }).success,
    ).toBe(true);
  });

  it("rejects a reason longer than 2000 chars", () => {
    expect(
      documentReuploadSchema.safeParse({ reason: "a".repeat(2001) }).success,
    ).toBe(false);
  });
});

describe("documentArchiveSchema", () => {
  it("requires a boolean archived field", () => {
    expect(documentArchiveSchema.safeParse({}).success).toBe(false);
    expect(
      documentArchiveSchema.safeParse({ archived: true }).success,
    ).toBe(true);
    expect(
      documentArchiveSchema.safeParse({ archived: false }).success,
    ).toBe(true);
  });

  it("rejects non-boolean archived values", () => {
    expect(
      documentArchiveSchema.safeParse({ archived: "yes" }).success,
    ).toBe(false);
  });
});
