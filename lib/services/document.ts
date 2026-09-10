import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/api";
import type { AuthUser } from "@/lib/auth/guards";
import { auditLog } from "./audit";
import { notifications } from "./notification";

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const documentService = {
  validateFileMeta(mimeType: string, fileSize: number) {
    if (!ALLOWED_MIME_TYPES.includes(mimeType as (typeof ALLOWED_MIME_TYPES)[number])) {
      throw new HttpError(400, "BAD_REQUEST", `File type ${mimeType} is not allowed`);
    }
    if (fileSize > 10 * 1024 * 1024) {
      throw new HttpError(400, "BAD_REQUEST", "File exceeds the 10MB limit");
    }
  },

  async upload(input: {
    studentId: string;
    applicationId?: string;
    requirementId?: string;
    name: string;
    fileUrl: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
  }, actor: AuthUser) {
    this.validateFileMeta(input.mimeType, input.fileSize);

    // Students can only upload their own documents
    if (actor.role === "STUDENT") {
      const student = await prisma.student.findUnique({ where: { userId: actor.id } });
      if (!student || student.id !== input.studentId) {
        throw new HttpError(403, "FORBIDDEN", "You can only upload your own documents");
      }
    }

    const doc = await prisma.document.create({
      data: {
        ...input,
        status: "UPLOADED",
        uploadedById: actor.id,
        uploadedAt: new Date(),
      },
    });

    // Notify assigned employee
    const student = await prisma.student.findUnique({
      where: { id: input.studentId },
      include: { employee: true },
    });
    if (student?.employee) {
      await notifications.push({
        userId: student.employee.userId,
        type: "DOCUMENT_UPLOADED",
        title: "Document uploaded",
        message: `${student.firstName} uploaded "${input.name}".`,
      });
    }

    await auditLog.record({
      userId: actor.id,
      action: "document.uploaded",
      entity: "Document",
      entityId: doc.id,
      newValue: { name: input.name, mimeType: input.mimeType, fileSize: input.fileSize },
    });
    return doc;
  },

  async review(
    id: string,
    decision: "APPROVED" | "REJECTED" | "UNDER_REVIEW",
    reviewNote: string | undefined,
    actor: AuthUser
  ) {
    const doc = await prisma.document.findFirst({ where: { id, deletedAt: null } });
    if (!doc) throw new HttpError(404, "NOT_FOUND", "Document not found");
    if (doc.status === "APPROVED" && decision === "REJECTED") {
      throw new HttpError(
        409,
        "CONFLICT",
        "Approved documents cannot be rejected; they must first be explicitly revoked"
      );
    }

    const updated = await prisma.document.update({
      where: { id },
      data: {
        status: decision,
        reviewedById: actor.id,
        reviewedAt: new Date(),
        reviewNote,
      },
    });

    const student = await prisma.student.findUnique({ where: { id: doc.studentId } });
    if (student) {
      await notifications.push({
        userId: student.userId,
        type: decision === "APPROVED" ? "DOCUMENT_APPROVED" : "DOCUMENT_REJECTED",
        title: `Document ${decision.toLowerCase()}`,
        message:
          decision === "REJECTED"
            ? `Your document "${doc.name}" was rejected. ${reviewNote ?? "Please re-upload."}`
            : `Your document "${doc.name}" was approved.`,
      });
    }

    await auditLog.record({
      userId: actor.id,
      action: `document.${decision.toLowerCase()}`,
      entity: "Document",
      entityId: id,
      oldValue: { status: doc.status },
      newValue: { status: decision, reviewNote },
    });
    return updated;
  },

  async list(params: {
    page: number;
    pageSize: number;
    studentId?: string;
    applicationId?: string;
    status?: string;
  }) {
    const where = {
      deletedAt: null,
      ...(params.studentId ? { studentId: params.studentId } : {}),
      ...(params.applicationId ? { applicationId: params.applicationId } : {}),
      ...(params.status ? { status: params.status } : {}),
    };
    const [data, total] = await Promise.all([
      prisma.document.findMany({
        where,
        include: { student: true },
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      prisma.document.count({ where }),
    ]);
    return { data, total };
  },
};
