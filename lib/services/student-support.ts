import { prisma } from "@/lib/db";
import { auditLog } from "./audit";
import { FAQ_ITEMS, type FAQItem } from "@/lib/constants/support";

/**
 * Student-scoped Support service for Module 16 (Help & Support).
 *
 * SECURITY INVARIANT
 * ------------------
 * Every public method takes a `studentId` resolved from the session
 * (via `studentApiGuard()`). The service NEVER trusts a
 * `supportRequestId` from the client without re-verifying that the
 * request's `studentId` matches the caller. Foreign/missing records
 * return null → 404.
 *
 * Students can:
 *  - Submit support requests (create)
 *  - View their own requests (list + detail)
 *  - NOT update, resolve, or close requests (admin only)
 */

export type SupportRequestView = {
  id: string;
  subject: string;
  category: string;
  description: string;
  attachmentUrl: string | null;
  attachmentName: string | null;
  status: string;
  statusLabel: string;
  priority: string;
  response: string | null;
  respondedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const STATUS_LABELS: Record<string, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

function buildView(row: {
  id: string;
  subject: string;
  category: string;
  description: string;
  attachmentUrl: string | null;
  attachmentName: string | null;
  status: string;
  priority: string;
  response: string | null;
  respondedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): SupportRequestView {
  return {
    id: row.id,
    subject: row.subject,
    category: row.category,
    description: row.description,
    attachmentUrl: row.attachmentUrl,
    attachmentName: row.attachmentName,
    status: row.status,
    statusLabel: STATUS_LABELS[row.status] ?? row.status,
    priority: row.priority,
    response: row.response,
    respondedAt: row.respondedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    // NOTE: studentId, respondedById are intentionally omitted.
  };
}

export const studentSupportService = {
  /**
   * List the caller's support requests. Optional status filter.
   */
  async list(studentId: string, status?: string): Promise<SupportRequestView[]> {
    const where: Record<string, unknown> = { studentId };
    if (status) where.status = status;

    const rows = await prisma.supportRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
    return rows.map(buildView);
  },

  /**
   * Get one support request. Ownership verified: scoped by `studentId`.
   */
  async getById(studentId: string, requestId: string): Promise<SupportRequestView | null> {
    const row = await prisma.supportRequest.findFirst({
      where: { id: requestId, studentId },
    });
    if (!row) return null;
    return buildView(row);
  },

  /**
   * Create a new support request. The `studentId` comes from the
   * session — never from the body. The request starts with status
   * OPEN and priority MEDIUM (admin can adjust later).
   */
  async create(
    studentId: string,
    input: {
      subject: string;
      category: string;
      description: string;
      attachmentUrl?: string;
      attachmentName?: string;
    },
    actorId: string,
  ): Promise<SupportRequestView> {
    const row = await prisma.supportRequest.create({
      data: {
        studentId,
        subject: input.subject,
        category: input.category,
        description: input.description,
        attachmentUrl: input.attachmentUrl ?? null,
        attachmentName: input.attachmentName ?? null,
        status: "OPEN",
        priority: "MEDIUM",
      },
    });

    await auditLog.record({
      userId: actorId,
      action: "support_request.created",
      entity: "SupportRequest",
      entityId: row.id,
      newValue: {
        subject: input.subject,
        category: input.category,
        hasAttachment: !!input.attachmentUrl,
      },
    });

    return buildView(row);
  },

  /**
   * Return static FAQ items. If a search term is provided, filter
   * by question or answer (case-insensitive). If a category is
   * provided, filter by category.
   */
  getFAQ(search?: string, category?: string): FAQItem[] {
    let items = FAQ_ITEMS;
    if (category) {
      items = items.filter((i) => i.category.toLowerCase() === category.toLowerCase());
    }
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        (i) =>
          i.question.toLowerCase().includes(q) ||
          i.answer.toLowerCase().includes(q),
      );
    }
    return items;
  },
};
