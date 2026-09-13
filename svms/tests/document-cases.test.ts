import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────
// Pure constants tests — no DB mocking needed
// ─────────────────────────────────────────────

import {
  validateFileMeta,
  sanitizeFileName,
  extensionMatchesMime,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
  DOCUMENT_STATUSES,
  DOCUMENT_TYPES,
} from "@/lib/constants/documents";

describe("validateFileMeta", () => {
  it("accepts PDF, JPEG, PNG, WebP within 10MB", () => {
    for (const mime of ALLOWED_MIME_TYPES) {
      expect(validateFileMeta(mime, 5 * 1024 * 1024)).toBeNull();
      expect(validateFileMeta(mime, 1)).toBeNull();
    }
  });

  it("rejects SVG, GIF, BMP, EXE, octet-stream", () => {
    expect(validateFileMeta("image/svg+xml", 1024)).toContain("not allowed");
    expect(validateFileMeta("image/gif", 1024)).toContain("not allowed");
    expect(validateFileMeta("image/bmp", 1024)).toContain("not allowed");
    expect(validateFileMeta("application/x-msdownload", 1024)).toContain("not allowed");
    expect(validateFileMeta("application/octet-stream", 1024)).toContain("not allowed");
  });

  it("rejects files over 10MB", () => {
    expect(validateFileMeta("application/pdf", MAX_FILE_SIZE + 1)).toContain("10MB");
  });

  it("rejects empty / nullish MIME types", () => {
    expect(validateFileMeta("", 1024)).toContain("not allowed");
  });
});

describe("sanitizeFileName", () => {
  it("strips path traversal sequences", () => {
    // The sanitizer first strips to basename (everything after the last / or \)
    // and then removes any remaining ".." sequences.
    expect(sanitizeFileName("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFileName("..\\..\\windows\\system32")).toBe("system32");
    expect(sanitizeFileName("../../../etc/passwd.pdf")).toBe("passwd.pdf");
  });

  it("removes null bytes", () => {
    const result = sanitizeFileName("file.pdf\0.exe");
    expect(result).not.toContain("\0");
  });

  it("removes leading dots (hidden files)", () => {
    expect(sanitizeFileName(".htaccess")).toBe("htaccess");
    expect(sanitizeFileName("...hidden")).toBe("hidden");
  });

  it("truncates to 200 characters", () => {
    const long = "a".repeat(300) + ".pdf";
    expect(sanitizeFileName(long).length).toBe(200);
  });

  it("throws on empty filename", () => {
    expect(() => sanitizeFileName("")).toThrow("Filename is required");
    expect(() => sanitizeFileName("   ")).toThrow();
  });

  it("throws on filename that becomes empty after sanitization", () => {
    expect(() => sanitizeFileName("...")).toThrow("empty after sanitization");
    expect(() => sanitizeFileName("..")).toThrow();
  });

  it("preserves valid filenames", () => {
    expect(sanitizeFileName("passport.pdf")).toBe("passport.pdf");
    expect(sanitizeFileName("IELTS_Result_2026.jpg")).toBe("IELTS_Result_2026.jpg");
  });

  it("strips directory components, keeping only the basename", () => {
    expect(sanitizeFileName("/tmp/upload/passport.pdf")).toBe("passport.pdf");
    expect(sanitizeFileName("C:\\Users\\student\\transcript.pdf")).toBe("transcript.pdf");
  });
});

describe("extensionMatchesMime", () => {
  it("matches PDF extension with PDF MIME", () => {
    expect(extensionMatchesMime("file.pdf", "application/pdf")).toBe(true);
  });

  it("matches jpg/jpeg with image/jpeg", () => {
    expect(extensionMatchesMime("file.jpg", "image/jpeg")).toBe(true);
    expect(extensionMatchesMime("file.jpeg", "image/jpeg")).toBe(true);
  });

  it("matches png with image/png", () => {
    expect(extensionMatchesMime("file.png", "image/png")).toBe(true);
  });

  it("matches webp with image/webp", () => {
    expect(extensionMatchesMime("file.webp", "image/webp")).toBe(true);
  });

  it("rejects mismatched extension + MIME", () => {
    expect(extensionMatchesMime("file.exe", "application/pdf")).toBe(false);
    expect(extensionMatchesMime("file.pdf", "image/jpeg")).toBe(false);
    expect(extensionMatchesMime("file.html", "application/pdf")).toBe(false);
  });

  it("rejects unknown extensions", () => {
    expect(extensionMatchesMime("file.unknown", "application/pdf")).toBe(false);
  });
});

describe("DOCUMENT_STATUSES + DOCUMENT_TYPES", () => {
  it("includes all 6 statuses", () => {
    expect(DOCUMENT_STATUSES).toEqual(["REQUESTED", "UPLOADED", "UNDER_REVIEW", "APPROVED", "REJECTED", "EXPIRED"]);
  });

  it("includes all 11 document types", () => {
    expect(DOCUMENT_TYPES).toContain("PASSPORT");
    expect(DOCUMENT_TYPES).toContain("TRANSCRIPT");
    expect(DOCUMENT_TYPES).toContain("IELTS");
    expect(DOCUMENT_TYPES).toContain("BANK_STATEMENT");
    expect(DOCUMENT_TYPES).toContain("OTHER");
  });
});

// ─────────────────────────────────────────────
// Service-level tests — mocked prisma
// ─────────────────────────────────────────────

const prismaMock = vi.hoisted(() => ({
  document: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
  user: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  notification: {
    create: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import {
  listDocuments,
  getDocumentById,
  requireDocument,
  reviewDocument,
  requestReupload,
  uploadDocumentVersion,
  getDocumentForDownload,
} from "@/lib/services/document-cases";
import type { EmployeeScope } from "@/lib/services/employee-dashboard";

const ADMIN_SCOPE: EmployeeScope = { isAdmin: true, userId: "u-admin", employeeId: null };
const EMPLOYEE_SCOPE: EmployeeScope = { isAdmin: false, userId: "u-emp", employeeId: "emp-1" };

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────
// IDOR closure
// ─────────────────────────────────────────────

describe("document IDOR closure", () => {
  it("EMPLOYEE scope embeds student.assignedEmployeeId filter", async () => {
    prismaMock.document.findMany.mockResolvedValue([]);
    prismaMock.document.count.mockResolvedValue(0);
    await listDocuments(EMPLOYEE_SCOPE, {});
    const call = prismaMock.document.findMany.mock.calls[0][0];
    expect(call.where.student).toEqual({ assignedEmployeeId: "emp-1" });
  });

  it("ADMIN scope is empty — sees all documents", async () => {
    prismaMock.document.findMany.mockResolvedValue([]);
    prismaMock.document.count.mockResolvedValue(0);
    await listDocuments(ADMIN_SCOPE, {});
    const call = prismaMock.document.findMany.mock.calls[0][0];
    expect(call.where.student).toBeUndefined();
  });

  it("getDocumentById returns null for foreign documents", async () => {
    prismaMock.document.findFirst.mockResolvedValue(null);
    const result = await getDocumentById(EMPLOYEE_SCOPE, "doc-foreign");
    expect(result).toBeNull();
  });

  it("requireDocument throws 404 for missing/foreign documents", async () => {
    prismaMock.document.findFirst.mockResolvedValue(null);
    await expect(requireDocument(EMPLOYEE_SCOPE, "doc-missing")).rejects.toMatchObject({
      status: 404, code: "NOT_FOUND",
    });
  });
});

// ─────────────────────────────────────────────
// Review — approve / reject
// ─────────────────────────────────────────────

describe("reviewDocument — approve", () => {
  it("approves a document and sets reviewedById + reviewedAt", async () => {
    prismaMock.document.findFirst.mockResolvedValue({ id: "doc-1", status: "UPLOADED" });
    prismaMock.document.update.mockResolvedValue({});
    prismaMock.document.findFirst // second call for notification
      .mockResolvedValueOnce({ id: "doc-1", status: "UPLOADED" })
      .mockResolvedValueOnce({ student: { userId: "u-stu", firstName: "Karim", lastName: "Ahmed" }, name: "Passport" });
    const result = await reviewDocument(EMPLOYEE_SCOPE, "doc-1", "APPROVED", undefined, { id: "u-emp" });
    expect(result.status).toBe("APPROVED");
    expect(result.reviewedAt).toBeInstanceOf(Date);
    expect(prismaMock.document.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: "APPROVED",
        reviewedById: "u-emp",
      }),
    }));
  });

  it("emits a notification to the student on approval", async () => {
    prismaMock.document.findFirst
      .mockResolvedValueOnce({ id: "doc-1", status: "UPLOADED" })
      .mockResolvedValueOnce({ student: { userId: "u-stu", firstName: "Karim", lastName: "Ahmed" }, name: "Passport" });
    prismaMock.document.update.mockResolvedValue({});
    await reviewDocument(EMPLOYEE_SCOPE, "doc-1", "APPROVED", undefined, { id: "u-emp" });
    expect(prismaMock.notification.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: "u-stu",
        type: "DOCUMENT_APPROVED",
      }),
    }));
  });
});

describe("reviewDocument — reject", () => {
  it("blocks rejection without a reason (422 VALIDATION_ERROR)", async () => {
    prismaMock.document.findFirst.mockResolvedValue({ id: "doc-1", status: "UPLOADED" });
    await expect(reviewDocument(EMPLOYEE_SCOPE, "doc-1", "REJECTED", undefined, { id: "u-emp" })).rejects.toMatchObject({
      status: 422, code: "VALIDATION_ERROR",
    });
    await expect(reviewDocument(EMPLOYEE_SCOPE, "doc-1", "REJECTED", "  ", { id: "u-emp" })).rejects.toMatchObject({
      status: 422, code: "VALIDATION_ERROR",
    });
  });

  it("allows rejection with a non-empty reason", async () => {
    prismaMock.document.findFirst
      .mockResolvedValueOnce({ id: "doc-1", status: "UPLOADED" })
      .mockResolvedValueOnce({ student: { userId: "u-stu", firstName: "K", lastName: "A" }, name: "Passport" });
    prismaMock.document.update.mockResolvedValue({});
    const result = await reviewDocument(EMPLOYEE_SCOPE, "doc-1", "REJECTED", "Blurred image", { id: "u-emp" });
    expect(result.status).toBe("REJECTED");
    expect(prismaMock.document.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: "REJECTED",
        reviewNote: "Blurred image",
      }),
    }));
  });

  it("blocks direct rejection of an APPROVED document (409 CONFLICT)", async () => {
    prismaMock.document.findFirst.mockResolvedValue({ id: "doc-1", status: "APPROVED" });
    await expect(reviewDocument(EMPLOYEE_SCOPE, "doc-1", "REJECTED", "reason", { id: "u-emp" })).rejects.toMatchObject({
      status: 409, code: "CONFLICT",
    });
  });
});

// ─────────────────────────────────────────────
// Re-upload request
// ─────────────────────────────────────────────

describe("requestReupload", () => {
  it("blocks re-upload request without a reason (422)", async () => {
    await expect(requestReupload(EMPLOYEE_SCOPE, "doc-1", "", { id: "u-emp" })).rejects.toMatchObject({
      status: 422, code: "VALIDATION_ERROR",
    });
    await expect(requestReupload(EMPLOYEE_SCOPE, "doc-1", "   ", { id: "u-emp" })).rejects.toMatchObject({
      status: 422, code: "VALIDATION_ERROR",
    });
  });

  it("resets status to REQUESTED + sets reviewNote + notifies the student", async () => {
    prismaMock.document.findFirst
      .mockResolvedValueOnce({ id: "doc-1", status: "APPROVED" })
      .mockResolvedValueOnce({ student: { userId: "u-stu" }, name: "Passport" });
    prismaMock.document.update.mockResolvedValue({});
    const result = await requestReupload(EMPLOYEE_SCOPE, "doc-1", "File expired, need a fresh copy", { id: "u-emp" });
    expect(result.status).toBe("REQUESTED");
    expect(prismaMock.document.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: "REQUESTED",
        reviewNote: "File expired, need a fresh copy",
      }),
    }));
    expect(prismaMock.notification.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        type: "DOCUMENT_REUPLOAD_REQUESTED",
      }),
    }));
  });

  it("IDOR: foreign document returns 404", async () => {
    prismaMock.document.findFirst.mockResolvedValue(null);
    await expect(requestReupload(EMPLOYEE_SCOPE, "doc-foreign", "reason", { id: "u-emp" })).rejects.toMatchObject({
      status: 404, code: "NOT_FOUND",
    });
  });
});

// ─────────────────────────────────────────────
// Upload — file security + versioning
// ─────────────────────────────────────────────

describe("uploadDocumentVersion — file security", () => {
  it("rejects invalid MIME types (422)", async () => {
    await expect(uploadDocumentVersion(
      EMPLOYEE_SCOPE, "doc-1",
      { buffer: Buffer.from("x"), mimeType: "image/svg+xml", fileName: "file.svg", fileSize: 100 },
      { id: "u-emp" },
    )).rejects.toMatchObject({ status: 422, code: "VALIDATION_ERROR" });
  });

  it("rejects files over 10MB (422)", async () => {
    await expect(uploadDocumentVersion(
      EMPLOYEE_SCOPE, "doc-1",
      { buffer: Buffer.alloc(11 * 1024 * 1024), mimeType: "application/pdf", fileName: "file.pdf", fileSize: 11 * 1024 * 1024 },
      { id: "u-emp" },
    )).rejects.toMatchObject({ status: 422, code: "VALIDATION_ERROR" });
  });

  it("rejects extension/MIME mismatch (422)", async () => {
    prismaMock.document.findFirst.mockResolvedValue({ id: "doc-1", status: "REQUESTED", version: 1, name: "Passport", documentType: "PASSPORT", studentId: "stu-1", applicationId: null });
    await expect(uploadDocumentVersion(
      EMPLOYEE_SCOPE, "doc-1",
      { buffer: Buffer.from("x"), mimeType: "application/pdf", fileName: "file.exe", fileSize: 100 },
      { id: "u-emp" },
    )).rejects.toMatchObject({ status: 422, code: "VALIDATION_ERROR" });
  });

  it("sanitizes path-traversal filenames before storing", async () => {
    prismaMock.document.findFirst.mockResolvedValue({ id: "doc-1", status: "REQUESTED", version: 1, name: "Passport", documentType: "PASSPORT", studentId: "stu-1", applicationId: null });
    prismaMock.document.update.mockResolvedValue({});
    await uploadDocumentVersion(
      EMPLOYEE_SCOPE, "doc-1",
      { buffer: Buffer.from("x"), mimeType: "application/pdf", fileName: "../../etc/passwd.pdf", fileSize: 100 },
      { id: "u-emp" },
    );
    const updateCall = prismaMock.document.update.mock.calls[0][0];
    // After sanitization: the basename "passwd.pdf" is extracted
    expect(updateCall.data.fileName).toBe("passwd.pdf");
    expect(updateCall.data.fileName).not.toContain("..");
    expect(updateCall.data.fileName).not.toContain("/");
  });

  it("creates a new version row for APPROVED documents (no silent replacement)", async () => {
    prismaMock.document.findFirst.mockResolvedValue({ id: "doc-1", status: "APPROVED", version: 1, name: "Passport", documentType: "PASSPORT", studentId: "stu-1", applicationId: null });
    prismaMock.document.create.mockResolvedValue({ id: "doc-2", version: 2 });
    const result = await uploadDocumentVersion(
      EMPLOYEE_SCOPE, "doc-1",
      { buffer: Buffer.from("new"), mimeType: "application/pdf", fileName: "passport_v2.pdf", fileSize: 200 },
      { id: "u-emp" },
    );
    expect(result.id).toBe("doc-2");
    expect(result.version).toBe(2);
    expect(prismaMock.document.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        version: 2,
        previousVersionId: "doc-1",
        status: "UPLOADED",
      }),
    }));
    // The original APPROVED document is NOT modified
    expect(prismaMock.document.update).not.toHaveBeenCalled();
  });

  it("replaces file in place for non-approved documents (clears review state)", async () => {
    prismaMock.document.findFirst.mockResolvedValue({ id: "doc-1", status: "REJECTED", version: 1, name: "Passport", documentType: "PASSPORT", studentId: "stu-1", applicationId: null });
    prismaMock.document.update.mockResolvedValue({});
    await uploadDocumentVersion(
      EMPLOYEE_SCOPE, "doc-1",
      { buffer: Buffer.from("new"), mimeType: "application/pdf", fileName: "passport.pdf", fileSize: 200 },
      { id: "u-emp" },
    );
    const updateCall = prismaMock.document.update.mock.calls[0][0];
    expect(updateCall.data.status).toBe("UPLOADED");
    expect(updateCall.data.reviewNote).toBeNull();
    expect(updateCall.data.reviewedById).toBeNull();
    expect(updateCall.data.reviewedAt).toBeNull();
  });

  it("IDOR: foreign document returns 404", async () => {
    prismaMock.document.findFirst.mockResolvedValue(null);
    await expect(uploadDocumentVersion(
      EMPLOYEE_SCOPE, "doc-foreign",
      { buffer: Buffer.from("x"), mimeType: "application/pdf", fileName: "file.pdf", fileSize: 100 },
      { id: "u-emp" },
    )).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
  });
});

// ─────────────────────────────────────────────
// Download — ownership-verified
// ─────────────────────────────────────────────

describe("getDocumentForDownload — IDOR closure", () => {
  it("returns the file when the caller owns the document", async () => {
    prismaMock.document.findFirst.mockResolvedValue({
      fileName: "passport.pdf", mimeType: "application/pdf",
      fileUrl: "data:application/pdf;base64,SGVsbG8=", fileSize: 5, status: "UPLOADED",
    });
    const result = await getDocumentForDownload(EMPLOYEE_SCOPE, "doc-1");
    expect(result.fileName).toBe("passport.pdf");
    expect(result.mimeType).toBe("application/pdf");
    expect(result.dataUrl).toContain("base64");
  });

  it("returns 404 for foreign documents (IDOR closure)", async () => {
    prismaMock.document.findFirst.mockResolvedValue(null);
    await expect(getDocumentForDownload(EMPLOYEE_SCOPE, "doc-foreign")).rejects.toMatchObject({
      status: 404, code: "NOT_FOUND",
    });
  });

  it("returns 404 when no file is attached", async () => {
    prismaMock.document.findFirst.mockResolvedValue({
      fileName: null, mimeType: null, fileUrl: null, fileSize: null, status: "REQUESTED",
    });
    await expect(getDocumentForDownload(EMPLOYEE_SCOPE, "doc-1")).rejects.toMatchObject({
      status: 404, code: "NOT_FOUND",
    });
  });
});

// ─────────────────────────────────────────────
// List — filters + pagination
// ─────────────────────────────────────────────

describe("listDocuments — filters", () => {
  it("applies status filter", async () => {
    prismaMock.document.findMany.mockResolvedValue([]);
    prismaMock.document.count.mockResolvedValue(0);
    await listDocuments(EMPLOYEE_SCOPE, { filters: { status: "APPROVED" } });
    const call = prismaMock.document.findMany.mock.calls[0][0];
    expect(call.where.status).toBe("APPROVED");
  });

  it("applies documentType filter", async () => {
    prismaMock.document.findMany.mockResolvedValue([]);
    prismaMock.document.count.mockResolvedValue(0);
    await listDocuments(EMPLOYEE_SCOPE, { filters: { documentType: "PASSPORT" } });
    const call = prismaMock.document.findMany.mock.calls[0][0];
    expect(call.where.documentType).toBe("PASSPORT");
  });

  it("applies studentId filter", async () => {
    prismaMock.document.findMany.mockResolvedValue([]);
    prismaMock.document.count.mockResolvedValue(0);
    await listDocuments(EMPLOYEE_SCOPE, { filters: { studentId: "stu-1" } });
    const call = prismaMock.document.findMany.mock.calls[0][0];
    expect(call.where.studentId).toBe("stu-1");
  });

  it("applies expiry date range", async () => {
    prismaMock.document.findMany.mockResolvedValue([]);
    prismaMock.document.count.mockResolvedValue(0);
    await listDocuments(EMPLOYEE_SCOPE, { filters: { expiryFrom: "2026-01-01", expiryTo: "2026-12-31" } });
    const call = prismaMock.document.findMany.mock.calls[0][0];
    expect(call.where.expiresAt.gte).toEqual(new Date("2026-01-01"));
    expect(call.where.expiresAt.lte).toEqual(new Date("2026-12-31"));
  });

  it("ignores invalid date strings", async () => {
    prismaMock.document.findMany.mockResolvedValue([]);
    prismaMock.document.count.mockResolvedValue(0);
    await listDocuments(EMPLOYEE_SCOPE, { filters: { expiryFrom: "bad", expiryTo: "also-bad" } });
    const call = prismaMock.document.findMany.mock.calls[0][0];
    expect(call.where.expiresAt).toBeUndefined();
  });
});

describe("listDocuments — pagination", () => {
  it("defaults to page 1, pageSize 20", async () => {
    prismaMock.document.findMany.mockResolvedValue([]);
    prismaMock.document.count.mockResolvedValue(0);
    const result = await listDocuments(EMPLOYEE_SCOPE, {});
    expect(prismaMock.document.findMany.mock.calls[0][0].skip).toBe(0);
    expect(prismaMock.document.findMany.mock.calls[0][0].take).toBe(20);
    expect(result.page).toBe(1);
    expect(result.totalPages).toBe(1);
  });

  it("clamps pageSize to 1–100", async () => {
    prismaMock.document.findMany.mockResolvedValue([]);
    prismaMock.document.count.mockResolvedValue(0);
    await listDocuments(EMPLOYEE_SCOPE, { pageSize: 5000 });
    expect(prismaMock.document.findMany.mock.calls[0][0].take).toBe(100);
  });
});

// ─────────────────────────────────────────────
// Error propagation
// ─────────────────────────────────────────────

describe("error propagation", () => {
  it("listDocuments lets prisma errors bubble", async () => {
    prismaMock.document.findMany.mockRejectedValue(new Error("DB lost"));
    prismaMock.document.count.mockResolvedValue(0);
    await expect(listDocuments(EMPLOYEE_SCOPE, {})).rejects.toThrow("DB lost");
  });

  it("reviewDocument lets prisma errors bubble", async () => {
    prismaMock.document.findFirst.mockRejectedValue(new Error("findFirst failed"));
    await expect(reviewDocument(EMPLOYEE_SCOPE, "doc-1", "APPROVED", undefined, { id: "u-1" })).rejects.toThrow("findFirst failed");
  });
});
