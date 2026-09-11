import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { Readable } from "node:stream";

// ─────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────

const mockAuth = vi.fn();
const mockStudentFindFirst = vi.fn();
const mockDocumentFindFirst = vi.fn();
const mockDocumentFindMany = vi.fn();
const mockDocumentCreate = vi.fn();
const mockStat = vi.fn();
const mockUnlink = vi.fn();
const mockMkdir = vi.fn();
const mockWriteFile = vi.fn();
const mockCreateReadStream = vi.fn();
const mockAuditRecord = vi.fn();
const mockNotificationsPush = vi.fn();
const mockStudentFindUnique = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    student: {
      findFirst: (args: unknown) => mockStudentFindFirst(args),
      findUnique: (args: unknown) => mockStudentFindUnique(args),
    },
    document: {
      findFirst: (args: unknown) => mockDocumentFindFirst(args),
      findMany: (args: unknown) => mockDocumentFindMany(args),
      create: (args: unknown) => mockDocumentCreate(args),
    },
  },
}));
vi.mock("@/lib/services/audit", () => ({
  auditLog: {
    record: (input: unknown) => mockAuditRecord(input),
  },
}));
vi.mock("@/lib/services/notification", () => ({
  notifications: { push: (input: unknown) => mockNotificationsPush(input) },
}));
vi.mock("node:fs/promises", () => ({
  stat: (p: string) => mockStat(p),
  unlink: (p: string) => mockUnlink(p),
  mkdir: (p: string, opts: unknown) => mockMkdir(p, opts),
  writeFile: (p: string, b: unknown) => mockWriteFile(p, b),
}));
vi.mock("node:fs", () => ({
  createReadStream: (p: string) => mockCreateReadStream(p),
}));

// Stub crypto (we use sha256 for the on-disk filename).
vi.mock("node:crypto", () => ({
  createHash: () => ({
    update: () => ({
      digest: () => ({
        slice: (_s: number, e: number) => "a".repeat(e ?? 16),
      }),
    }),
  }),
}));

import { GET as GET_list, POST as POST_upload } from "@/app/api/student/documents/route";
import { GET as GET_byId } from "@/app/api/student/documents/[id]/route";
import { POST as POST_replace } from "@/app/api/student/documents/[id]/replace/route";
import { GET as GET_download } from "@/app/api/student/documents/[id]/download/route";

// ─────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────

const baseStudent = {
  id: "stu-1",
  userId: "user-1",
  studentId: "STD-2026-000001",
  firstName: "Karim",
  lastName: "Ahmed",
  email: "k@x.com",
  deletedAt: null,
};

const baseDocument = {
  id: "doc-1",
  studentId: "stu-1",
  applicationId: null,
  requirementId: null,
  name: "Passport Bio Page",
  fileUrl: "private:stu-1/1234-aaaaaaaaaaaaaaaa.pdf",
  fileName: "1234-aaaaaaaaaaaaaaaa.pdf",
  mimeType: "application/pdf",
  fileSize: 100_000,
  status: "UPLOADED",
  category: "Passport",
  replacesId: null,
  uploadedById: "user-1",
  reviewedById: null,
  reviewNote: null,
  uploadedAt: new Date("2026-01-01T08:00:00Z"),
  reviewedAt: null,
  expiresAt: null,
  deletedAt: null,
  createdAt: new Date("2026-01-01T08:00:00Z"),
  updatedAt: new Date("2026-01-01T08:00:00Z"),
};

const approvedDocument = {
  ...baseDocument,
  id: "doc-2",
  status: "APPROVED",
  reviewNote: "Looks good",
  reviewedById: "user-2",
  reviewedAt: new Date("2026-01-02T10:00:00Z"),
};

const rejectedDocument = {
  ...baseDocument,
  id: "doc-3",
  status: "REJECTED",
  reviewNote: "Passport copy is not clear.",
  reviewedById: "user-2",
  reviewedAt: new Date("2026-01-02T10:00:00Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers().setSystemTime(new Date("2026-09-11T12:00:00Z"));
  mockAuth.mockResolvedValue({ user: { id: "user-1", role: "STUDENT" } });
  mockStudentFindFirst.mockResolvedValue(baseStudent);
  mockDocumentFindMany.mockResolvedValue([baseDocument]);
  mockDocumentFindFirst.mockResolvedValue(baseDocument);
  mockDocumentCreate.mockResolvedValue(baseDocument);
  mockStudentFindUnique.mockResolvedValue({
    ...baseStudent,
    employee: null,
  });
  mockStat.mockResolvedValue({ size: 100_000 });
  mockUnlink.mockResolvedValue(undefined);
  mockMkdir.mockResolvedValue(undefined);
  mockWriteFile.mockResolvedValue(undefined);
  mockCreateReadStream.mockReturnValue(Readable.from([Buffer.from("pdf-bytes")]));
  mockAuditRecord.mockResolvedValue(undefined);
  mockNotificationsPush.mockResolvedValue(undefined);
});

function mockAuthResolved(user: { id: string | null; role?: string }) {
  mockAuth.mockResolvedValue(user.id ? { user } : null);
}

function makeMultipartRequest(fields: {
  file?: { name: string; type: string; content: string };
  name?: string;
  category?: string;
  applicationId?: string;
  requirementId?: string;
}, url = "http://localhost/api/student/documents"): NextRequest {
  const formData = new FormData();
  if (fields.file) {
    const blob = new Blob([fields.file.content], { type: fields.file.type });
    formData.append("file", blob, fields.file.name);
  }
  if (fields.name !== undefined) formData.append("name", fields.name);
  if (fields.category !== undefined) formData.append("category", fields.category);
  if (fields.applicationId !== undefined) formData.append("applicationId", fields.applicationId);
  if (fields.requirementId !== undefined) formData.append("requirementId", fields.requirementId);
  return new NextRequest(url, { method: "POST", body: formData });
}

// ─────────────────────────────────────────────
// GET /api/student/documents (list)
// ─────────────────────────────────────────────

describe("GET /api/student/documents (list)", () => {
  it("rejects unauthenticated callers with 401", async () => {
    mockAuthResolved({ id: null });
    const res = await GET_list(new NextRequest("http://localhost/api/student/documents"));
    expect(res.status).toBe(401);
  });

  it("rejects non-STUDENT roles with 403", async () => {
    mockAuthResolved({ id: "user-1", role: "ADMIN" });
    const res = await GET_list(new NextRequest("http://localhost/api/student/documents"));
    expect(res.status).toBe(403);
  });

  it("returns only the caller's current documents (no superseded)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await GET_list(new NextRequest("http://localhost/api/student/documents"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.documents.length).toBe(1);
    expect(body.data.documents[0].id).toBe("doc-1");
    expect(body.data.documents[0].name).toBe("Passport Bio Page");
    // fileUrl is NEVER exposed on the wire — defense-in-depth.
    expect("fileUrl" in body.data.documents[0]).toBe(false);
  });

  it("scopes the findMany call by studentId from the session", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await GET_list(new NextRequest("http://localhost/api/student/documents"));
    expect(mockDocumentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          studentId: "stu-1",
          deletedAt: null,
          replacedBy: { none: {} }, // only "current" versions
        }),
      }),
    );
  });

  it("supports the ?category= filter", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await GET_list(
      new NextRequest("http://localhost/api/student/documents?category=Passport"),
    );
    expect(mockDocumentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ category: "Passport" }),
      }),
    );
  });

  it("supports the ?status= filter", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await GET_list(
      new NextRequest("http://localhost/api/student/documents?status=APPROVED"),
    );
    expect(mockDocumentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "APPROVED" }),
      }),
    );
  });
});

// ─────────────────────────────────────────────
// POST /api/student/documents (upload)
// ─────────────────────────────────────────────

describe("POST /api/student/documents (upload)", () => {
  it("rejects unauthenticated callers with 401", async () => {
    mockAuthResolved({ id: null });
    const res = await POST_upload(makeMultipartRequest({}));
    expect(res.status).toBe(401);
  });

  it("rejects uploads with no file (422 VALIDATION_ERROR)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await POST_upload(
      makeMultipartRequest({ name: "Passport", category: "Passport" }),
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects invalid file types (422, not on disk)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await POST_upload(
      makeMultipartRequest({
        file: { name: "evil.exe", type: "application/x-msdownload", content: "MZ" },
        name: "Passport",
        category: "Passport",
      }),
    );
    expect(res.status).toBe(422);
    expect(mockWriteFile).not.toHaveBeenCalled(); // file never touches disk
  });

  it("rejects oversized files (422, not on disk)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    // Build a real ~11MB File by passing a large Uint8Array to the
    // Blob constructor. The Blob's `.size` is computed from the
    // underlying buffer, so the route's `file.size > MAX_FILE_SIZE`
    // check sees the right value.
    const bigBytes = new Uint8Array(11 * 1024 * 1024);
    bigBytes.fill(0x41); // 'A'
    const fakeFile = new File([bigBytes], "big.pdf", { type: "application/pdf" });
    expect(fakeFile.size).toBeGreaterThan(10 * 1024 * 1024); // sanity check
    const formData = new FormData();
    formData.append("file", fakeFile);
    formData.append("name", "Big");
    formData.append("category", "Passport");
    const req = new NextRequest("http://localhost/api/student/documents", {
      method: "POST",
      body: formData,
    });
    const res = await POST_upload(req);
    expect(res.status).toBe(422);
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it("rejects empty files (422, not on disk)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const fakeFile = new File([""], "empty.pdf", { type: "application/pdf" });
    Object.defineProperty(fakeFile, "size", { value: 0 });
    const formData = new FormData();
    formData.append("file", fakeFile);
    formData.append("name", "Empty");
    formData.append("category", "Passport");
    const req = new NextRequest("http://localhost/api/student/documents", {
      method: "POST",
      body: formData,
    });
    const res = await POST_upload(req);
    expect(res.status).toBe(422);
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it("rejects missing name field (422)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await POST_upload(
      makeMultipartRequest({
        file: { name: "ok.pdf", type: "application/pdf", content: "PDF-1.4" },
        category: "Passport",
      }),
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects invalid category (422)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await POST_upload(
      makeMultipartRequest({
        file: { name: "ok.pdf", type: "application/pdf", content: "PDF-1.4" },
        name: "Passport",
        category: "INVALID_CATEGORY",
      }),
    );
    expect(res.status).toBe(422);
  });

  it("accepts a valid PDF upload and creates the document", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await POST_upload(
      makeMultipartRequest({
        file: { name: "passport.pdf", type: "application/pdf", content: "PDF-1.4 bytes" },
        name: "Passport Bio Page",
        category: "Passport",
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.document.id).toBe("doc-1");
    // The file was written to private storage.
    expect(mockWriteFile).toHaveBeenCalled();
    // The Document row was created with status=UPLOADED and the
    // session-resolved studentId.
    expect(mockDocumentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          studentId: "stu-1",
          status: "UPLOADED",
          category: "Passport",
          mimeType: "application/pdf",
        }),
      }),
    );
    // Audit-log entry for the upload.
    expect(mockAuditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "student_document.uploaded",
        entity: "Document",
      }),
    );
    // The on-disk path uses a sha256-based filename, NOT the
    // original filename (which could contain PII or special chars).
    const writeCall = mockWriteFile.mock.calls[0][0] as string;
    expect(writeCall).not.toContain("passport.pdf");
    expect(writePathHasPrivatePrefix(writeCall)).toBe(true);
  });

  it("never trusts studentId from the body — uses session", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    // Even if a studentId field were in the form, the schema doesn't
    // accept it, and the service uses g.student.id (from the session).
    const res = await POST_upload(
      makeMultipartRequest({
        file: { name: "ok.pdf", type: "application/pdf", content: "x" },
        name: "X",
        category: "Passport",
      }),
    );
    expect(res.status).toBe(201);
    expect(mockDocumentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ studentId: "stu-1" }),
      }),
    );
  });
});

// ─────────────────────────────────────────────
// GET /api/student/documents/[id] (detail)
// ─────────────────────────────────────────────

describe("GET /api/student/documents/[id] (detail)", () => {
  async function callGet(id: string) {
    return GET_byId(
      new NextRequest(`http://localhost/api/student/documents/${id}`),
      { params: Promise.resolve({ id }) },
    );
  }

  it("rejects unauthenticated callers with 401", async () => {
    mockAuthResolved({ id: null });
    const res = await callGet("doc-1");
    expect(res.status).toBe(401);
  });

  it("returns 404 when the document does not belong to the caller (IDOR-safe)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    mockDocumentFindFirst.mockResolvedValue(null); // service's where clause excludes foreign
    const res = await callGet("foreign-doc-id");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.error.message).not.toContain("foreign");
  });

  it("scopes the findFirst call by studentId from the session", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await callGet("doc-1");
    expect(mockDocumentFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "doc-1",
          studentId: "stu-1",
          deletedAt: null,
        }),
      }),
    );
  });

  it("returns the document detail with student-safe fields", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await callGet("doc-1");
    expect(res.status).toBe(200);
    const body = await res.json();
    const doc = body.data.document;
    expect(doc.id).toBe("doc-1");
    expect(doc.name).toBe("Passport Bio Page");
    expect(doc.status).toBe("UPLOADED");
    expect(doc.category).toBe("Passport");
    expect(doc.previewable).toBe(true); // PDF is previewable
    // fileUrl is NEVER exposed.
    expect("fileUrl" in doc).toBe(false);
    expect("uploadedById" in doc).toBe(false); // internal ObjectId
    expect("reviewedById" in doc).toBe(false);
    expect("deletedBy" in doc).toBe(false);
    // History is included (empty in the basic fixture).
    expect(Array.isArray(doc.history)).toBe(true);
    expect(doc.historyCount).toBe(0);
  });
});

// ─────────────────────────────────────────────
// POST /api/student/documents/[id]/replace (replace)
// ─────────────────────────────────────────────

describe("POST /api/student/documents/[id]/replace (replace)", () => {
  async function callReplace(docId: string, fields: Parameters<typeof makeMultipartRequest>[0]) {
    return POST_replace(
      makeMultipartRequest(fields, `http://localhost/api/student/documents/${docId}/replace`),
      { params: Promise.resolve({ id: docId }) },
    );
  }

  it("rejects unauthenticated callers with 401", async () => {
    mockAuthResolved({ id: null });
    const res = await callReplace("doc-1", {});
    expect(res.status).toBe(401);
  });

  it("returns 404 when the OLD document doesn't belong to the caller (IDOR-safe)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    // First findFirst in replaceDocument returns null because the
    // where clause excludes foreign docs.
    mockDocumentFindFirst.mockResolvedValue(null);
    const res = await callReplace("foreign-doc-id", {
      file: { name: "ok.pdf", type: "application/pdf", content: "x" },
      name: "New",
      category: "Passport",
    });
    expect(res.status).toBe(404);
  });

  it("creates a NEW document row with replacesId pointing to the old one (preserves APPROVED)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    // First call (the OLD doc lookup) returns the APPROVED document;
    // second call (the create) returns the new UPLOADED document.
    mockDocumentFindFirst.mockResolvedValue(approvedDocument);
    mockDocumentCreate.mockResolvedValue({
      ...baseDocument,
      id: "doc-new",
      status: "UPLOADED",
      replacesId: "doc-2",
      createdAt: new Date("2026-09-11T12:00:00Z"),
      uploadedAt: new Date("2026-09-11T12:00:00Z"),
    });

    const res = await callReplace("doc-2", {
      file: { name: "new.pdf", type: "application/pdf", content: "new bytes" },
      name: "Passport v2",
      category: "Passport",
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.document.id).toBe("doc-new");
    expect(body.data.document.status).toBe("UPLOADED");
    expect(body.data.document.replacesId).toBe("doc-2");

    // The OLD document is NOT modified — its status stays APPROVED.
    // (mockDocumentFindFirst was called for the OLD doc, but no
    //  prisma.document.update was called.)
    expect(mockDocumentCreate).toHaveBeenCalledTimes(1);

    // The new row's data has replacesId pointing to the old doc.
    expect(mockDocumentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          replacesId: "doc-2",
          status: "UPLOADED",
          studentId: "stu-1", // from the session, not the body
        }),
      }),
    );

    // Audit-log records both the replacement_created event AND the
    // replaced event (the createDocument call logs the latter when
    // replacesId is set; replaceDocument logs the former separately).
    const actions = mockAuditRecord.mock.calls.map(
      (c) => (c[0] as { action: string }).action,
    );
    expect(actions).toContain("student_document.replaced");
    expect(actions).toContain("student_document.replacement_created");
  });

  it("preserves the REJECTED document's status when replacing (no silent overwrite)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    mockDocumentFindFirst.mockResolvedValue(rejectedDocument);
    mockDocumentCreate.mockResolvedValue({
      ...baseDocument,
      id: "doc-new2",
      status: "UPLOADED",
      replacesId: "doc-3",
    });

    const res = await callReplace("doc-3", {
      file: { name: "v2.pdf", type: "application/pdf", content: "v2 bytes" },
      name: "Passport v2",
      category: "Passport",
    });

    expect(res.status).toBe(201);
    // The OLD doc's status (REJECTED + reviewNote "Passport copy is not clear.")
    // is preserved — we never called prisma.document.update.
    expect(mockDocumentCreate).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid file types in the replace flow too", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    mockDocumentFindFirst.mockResolvedValue(approvedDocument);
    const res = await callReplace("doc-2", {
      file: { name: "evil.exe", type: "application/x-msdownload", content: "MZ" },
      name: "Bad",
      category: "Passport",
    });
    expect(res.status).toBe(422);
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it("writes the new file to private storage (NOT /public/)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    mockDocumentFindFirst.mockResolvedValue(approvedDocument);
    mockDocumentCreate.mockResolvedValue({
      ...baseDocument,
      id: "doc-new",
      replacesId: "doc-2",
    });

    await callReplace("doc-2", {
      file: { name: "ok.pdf", type: "application/pdf", content: "x" },
      name: "New",
      category: "Passport",
    });

    expect(mockWriteFile).toHaveBeenCalled();
    const writePath = mockWriteFile.mock.calls[0][0] as string;
    expect(writePath).toContain("private-uploads");
    expect(writePath).not.toContain("/public/");
  });
});

// ─────────────────────────────────────────────
// GET /api/student/documents/[id]/download (secure download)
// ─────────────────────────────────────────────

describe("GET /api/student/documents/[id]/download (secure download)", () => {
  async function callDownload(id: string) {
    return GET_download(
      new NextRequest(`http://localhost/api/student/documents/${id}/download`),
      { params: Promise.resolve({ id }) },
    );
  }

  it("rejects unauthenticated callers with 401", async () => {
    mockAuthResolved({ id: null });
    const res = await callDownload("doc-1");
    expect(res.status).toBe(401);
  });

  it("returns 404 when the document does not belong to the caller (IDOR-safe)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    mockDocumentFindFirst.mockResolvedValue(null);
    const res = await callDownload("foreign-doc-id");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 404 when the file is missing from disk (orphan DB row)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    mockStat.mockRejectedValue(new Error("ENOENT"));
    const res = await callDownload("doc-1");
    expect(res.status).toBe(404);
  });

  it("returns 409 for REQUESTED documents (no file uploaded yet)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    mockDocumentFindFirst.mockResolvedValue({
      ...baseDocument,
      status: "REQUESTED",
      fileUrl: "private:stu-1/none.pdf",
      fileName: "none.pdf",
      mimeType: "application/pdf",
      fileSize: 0,
      name: "Requested Doc",
    });
    const res = await callDownload("doc-1");
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("CONFLICT");
  });

  it("streams the file with Content-Type + Content-Disposition: attachment", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await callDownload("doc-1");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toContain('attachment;');
    expect(res.headers.get("Content-Disposition")).toContain('filename=');
    // The original fileName is NOT exposed (it's a sha256-based name).
    expect(res.headers.get("Content-Disposition")).not.toContain("passport.pdf");
    // Cache headers prevent caching the private file.
    expect(res.headers.get("Cache-Control")).toContain("no-store");
    expect(res.headers.get("Cache-Control")).toContain("private");
    // X-Frame-Options prevents clickjacking of the download URL.
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
  });

  it("sanitizes the filename in Content-Disposition (no header injection)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    // fileName with CR/LF and quotes — must be sanitized.
    mockDocumentFindFirst.mockResolvedValue({
      ...baseDocument,
      fileName: 'evil\r\nHeader-Inject"; injection.pdf',
    });
    const res = await callDownload("doc-1");
    expect(res.status).toBe(200);
    const cd = res.headers.get("Content-Disposition") ?? "";
    // No raw CRLF should make it into the header.
    expect(cd).not.toContain("\r");
    expect(cd).not.toContain("\n");
  });

  it("audit-logs the download (every file access is recorded)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await callDownload("doc-1");
    // The auditLog.record call is best-effort (catches errors) so we
    // can't await it in the test directly — but the call should have
    // been made. Use vi.mocked to check.
    expect(mockAuditRecord).toHaveBeenCalled();
    const downloadCall = mockAuditRecord.mock.calls.find(
      (c) => (c[0] as { action: string }).action === "student_document.downloaded",
    );
    expect(downloadCall).toBeDefined();
  });

  it("rejects legacy public-URL fileUrls (not downloadable via this endpoint)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    // Legacy document with a public-URL fileUrl (pre-Module 06 format).
    mockDocumentFindFirst.mockResolvedValue({
      ...baseDocument,
      fileUrl: "/uploads/old-doc.pdf", // public URL, not private:
    });
    const res = await callDownload("doc-1");
    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function writePathHasPrivatePrefix(path: string): boolean {
  return path.includes("private-uploads") && path.includes("student-docs");
}
