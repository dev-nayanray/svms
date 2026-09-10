import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/api";
import type { AuthUser } from "@/lib/auth/guards";
import { auditLog } from "./audit";
import { notifications } from "./notification";
import {
  validateFileMeta,
  isReviewable,
  canReject,
} from "@/lib/constants/documents";

export const documentService = {
  validateFileMeta(mimeType: string, fileSize: number) {
    const err = validateFileMeta(mimeType, fileSize);
    if (err) throw new HttpError(400, "BAD_REQUEST", err);
  },

  async upload(
    input: {
      studentId: string;
      applicationId?: string;
      requirementId?: string;
      name: string;
      fileUrl: string;
      fileName: string;
      mimeType: string;
      fileSize: number;
    },
    actor: AuthUser,
  ) {
    this.validateFileMeta(input.mimeType, input.fileSize);

    // Students can only upload their own documents
    if (actor.role === "STUDENT") {
      const student = await prisma.student.findUnique({
        where: { userId: actor.id },
      });
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

  /**
   * Review a document — approve, reject, or put under review.
   *
   * Business rules:
   *  - Only REVIEWABLE statuses can be reviewed (UPLOADED, UNDER_REVIEW, REJECTED).
   *  - APPROVED documents cannot be rejected — they must first be revoked.
   *  - Rejection requires a reason (enforced by the Zod schema).
   */
  async review(
    id: string,
    decision: "APPROVED" | "REJECTED" | "UNDER_REVIEW",
    reviewNote: string | undefined,
    actor: AuthUser,
  ) {
    const doc = await prisma.document.findFirst({ where: { id, deletedAt: null } });
    if (!doc) throw new HttpError(404, "NOT_FOUND", "Document not found");

    if (!isReviewable(doc.status)) {
      throw new HttpError(
        409,
        "CONFLICT",
        `Documents in ${doc.status} status cannot be reviewed. ${
          doc.status === "APPROVED"
            ? "Revoke the approval first to re-review."
            : ""
        }`,
      );
    }

    if (decision === "REJECTED" && !canReject(doc.status)) {
      throw new HttpError(
        409,
        "CONFLICT",
        "Approved documents cannot be rejected; they must first be explicitly revoked",
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
        title: `Document ${decision.toLowerCase().replace("_", " ")}`,
        message:
          decision === "REJECTED"
            ? `Your document "${doc.name}" was rejected. ${reviewNote ?? "Please re-upload."}`
            : decision === "APPROVED"
              ? `Your document "${doc.name}" was approved.`
              : `Your document "${doc.name}" is under review.`,
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

  /**
   * Request re-upload of a document. Resets the status to REQUESTED and
   * stores the admin's reason as the reviewNote. Notifies the student.
   *
   * This can be used on any non-archived, non-REQUESTED, non-EXPIRED
   * document — including APPROVED documents (e.g. the file has expired
   * or the requirement changed), which implicitly revokes the approval.
   */
  async requestReupload(id: string, reason: string, actor: AuthUser) {
    const doc = await prisma.document.findFirst({ where: { id, deletedAt: null } });
    if (!doc) throw new HttpError(404, "NOT_FOUND", "Document not found");

    if (doc.status === "REQUESTED") {
      throw new HttpError(409, "CONFLICT", "This document is already awaiting upload");
    }

    const updated = await prisma.document.update({
      where: { id },
      data: {
        status: "REQUESTED",
        reviewedById: actor.id,
        reviewedAt: new Date(),
        reviewNote: reason,
      },
    });

    const student = await prisma.student.findUnique({ where: { id: doc.studentId } });
    if (student) {
      await notifications.push({
        userId: student.userId,
        type: "DOCUMENT_REUPLOAD_REQUESTED",
        title: "Document re-upload requested",
        message: `Please re-upload "${doc.name}". Reason: ${reason}`,
      });
    }

    await auditLog.record({
      userId: actor.id,
      action: "document.reupload_requested",
      entity: "Document",
      entityId: id,
      oldValue: { status: doc.status },
      newValue: { status: "REQUESTED", reason },
    });
    return updated;
  },

  /**
   * Archive (soft-delete) or unarchive a document. Archived documents
   * retain their data for audit trails but are hidden from the default
   * list.
   */
  async archive(id: string, archived: boolean, actor: AuthUser) {
    const doc = await prisma.document.findFirst({ where: { id } });
    if (!doc) throw new HttpError(404, "NOT_FOUND", "Document not found");

    const updated = await prisma.document.update({
      where: { id },
      data: {
        deletedAt: archived ? new Date() : null,
        deletedBy: archived ? actor.id : null,
      },
    });

    await auditLog.record({
      userId: actor.id,
      action: archived ? "document.archived" : "document.unarchived",
      entity: "Document",
      entityId: id,
      oldValue: { name: doc.name, deletedAt: doc.deletedAt },
      newValue: { deletedAt: updated.deletedAt },
    });
    return updated;
  },

  /**
   * List documents with full admin filters: search, status, countryId,
   * applicationId, studentId, employeeId, uploaded date range.
   * Uses `buildAdminDocumentWhere` from the constants module.
   */
  async list(params: {
    page: number;
    pageSize: number;
    search?: string;
    status?: string;
    countryId?: string;
    applicationId?: string;
    studentId?: string;
    employeeId?: string;
    uploadedFrom?: Date;
    uploadedTo?: Date;
    archived?: boolean;
  }) {
    // Lazy-import to avoid a circular dependency at module load time
    // (documents.ts imports from constants/documents.ts which has no
    // dependencies, but this keeps the import graph clean).
    const { buildAdminDocumentWhere } = await import("@/lib/constants/documents");
    const where = buildAdminDocumentWhere({
      search: params.search,
      status: params.status,
      countryId: params.countryId,
      applicationId: params.applicationId,
      studentId: params.studentId,
      employeeId: params.employeeId,
      uploadedFrom: params.uploadedFrom,
      uploadedTo: params.uploadedTo,
      archived: params.archived,
    });

    const [data, total] = await Promise.all([
      prisma.document.findMany({
        where,
        include: {
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              studentId: true,
              assignedEmployeeId: true,
            },
          },
          application: {
            select: {
              id: true,
              applicationNumber: true,
              country: { select: { id: true, name: true, flag: true } },
            },
          },
          requirement: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      prisma.document.count({ where }),
    ]);
    return { data, total };
  },
};
