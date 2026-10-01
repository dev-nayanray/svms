import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/api";
import type { EmployeeScope } from "@/lib/services/employee-dashboard";
import type { JsonValue } from "@prisma/client/runtime/library";
import { emitNotification } from "@/lib/services/notification-cases";

/**
 * Employee Messaging service — secure Student ↔ Employee communication.
 *
 * ── IDOR closure ──────────────────────────────────────────────────────
 * Every read/write function embeds `conversationScope(scope)` in the Prisma
 * `where` clause. An EMPLOYEE caller can only see / mutate conversations on
 * students assigned to them. ADMIN sees all. The scope filter is built from
 * the session-derived employeeId — never from the client.
 *
 * ── Internal vs. student-visible messages ────────────────────────────
 * A Message has `kind` ∈ {STUDENT_MESSAGE, INTERNAL_NOTE}. The employee
 * service returns both kinds. Any *student-facing* endpoint/service MUST
 * filter `kind: "STUDENT_MESSAGE"` so internal notes never leak.
 *
 * ── Attachments ──────────────────────────────────────────────────────
 * Stored inline on the Message row as a JSON array. Each item has the
 * shape: { fileUrl, fileName, mimeType, fileSize, uploadedAt }.
 * The list of allowed MIME types is enforced here; the upload itself is
 * handled out-of-band (e.g. a presign route, a future storage module).
 */

// ─── Constants ────────────────────────────────────────────────────────

export const MESSAGE_KINDS = ["STUDENT_MESSAGE", "INTERNAL_NOTE"] as const;
export type MessageKind = (typeof MESSAGE_KINDS)[number];

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB per file
export const MAX_ATTACHMENTS_PER_MESSAGE = 5;
export const MAX_MESSAGE_BODY = 10_000;
export const MAX_SUBJECT = 200;

export const ALLOWED_ATTACHMENT_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
  "application/zip",
] as const;

// ─── Types ────────────────────────────────────────────────────────────

export type AttachmentInput = {
  fileUrl: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  uploadedAt?: string;
};

export type Attachment = {
  fileUrl: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: string;
};

export type ConversationListFilters = {
  search?: string;
  studentId?: string;
  applicationId?: string;
  unreadOnly?: boolean;
};

export type ConversationListItem = {
  id: string;
  subject: string | null;
  student: { id: string; firstName: string; lastName: string; email: string };
  application: { id: string; applicationNumber: string } | null;
  employee: { id: string; name: string } | null;
  unreadCount: number; // messages where readAt is null AND senderId !== caller userId
  lastMessage: {
    id: string;
    body: string;
    kind: string;
    senderId: string;
    createdAt: Date;
  } | null;
  updatedAt: Date;
  createdAt: Date;
};

export type ConversationListResult = {
  rows: ConversationListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type MessageRow = {
  id: string;
  body: string;
  kind: string;
  senderId: string;
  readAt: Date | null;
  createdAt: Date;
  attachments: Attachment[];
};

export type ConversationDetail = {
  id: string;
  subject: string | null;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    studentId: string;
  };
  application: { id: string; applicationNumber: string } | null;
  employee: { id: string; name: string } | null;
  messages: MessageRow[];
  createdAt: Date;
  updatedAt: Date;
};

// ─── Scope helpers ────────────────────────────────────────────────────

/**
 * Returns the Prisma `where` fragment that scopes Conversation records to
 * the caller. EMPLOYEE sees only conversations whose Student is assigned
 * to them. ADMIN sees all.
 */
export function conversationScope(scope: EmployeeScope): Record<string, unknown> {
  return scope.isAdmin
    ? {}
    : { student: { assignedEmployeeId: scope.employeeId } };
}

/**
 * Like conversationScope, but used when starting a new conversation — the
 * caller must own the *target student* before a conversation can be opened.
 */
export function studentOwnershipScope(scope: EmployeeScope): Record<string, unknown> {
  return scope.isAdmin ? {} : { assignedEmployeeId: scope.employeeId };
}

// ─── Validation ───────────────────────────────────────────────────────

function normalizeAttachments(input: AttachmentInput[] | undefined): Attachment[] {
  if (!input || input.length === 0) return [];

  if (input.length > MAX_ATTACHMENTS_PER_MESSAGE) {
    throw new HttpError(
      422,
      "VALIDATION_ERROR",
      `Maximum ${MAX_ATTACHMENTS_PER_MESSAGE} attachments per message`,
    );
  }

  const out: Attachment[] = [];
  for (const a of input) {
    if (!a?.fileUrl || typeof a.fileUrl !== "string") {
      throw new HttpError(422, "VALIDATION_ERROR", "Attachment is missing fileUrl");
    }
    if (!a?.fileName || typeof a.fileName !== "string" || a.fileName.length > 255) {
      throw new HttpError(422, "VALIDATION_ERROR", "Attachment is missing or invalid fileName");
    }
    if (!a?.mimeType || typeof a.mimeType !== "string") {
      throw new HttpError(422, "VALIDATION_ERROR", "Attachment is missing mimeType");
    }
    if (!ALLOWED_ATTACHMENT_MIME_TYPES.includes(a.mimeType as (typeof ALLOWED_ATTACHMENT_MIME_TYPES)[number])) {
      throw new HttpError(422, "VALIDATION_ERROR", `Unsupported attachment type: ${a.mimeType}`);
    }
    if (typeof a.fileSize !== "number" || a.fileSize <= 0 || a.fileSize > MAX_ATTACHMENT_BYTES) {
      throw new HttpError(
        422,
        "VALIDATION_ERROR",
        `Attachment "${a.fileName}" exceeds the ${MAX_ATTACHMENT_BYTES} byte limit`,
      );
    }
    out.push({
      fileUrl: a.fileUrl,
      fileName: a.fileName,
      mimeType: a.mimeType,
      fileSize: a.fileSize,
      uploadedAt: a.uploadedAt ?? new Date().toISOString(),
    });
  }
  return out;
}

function assertMessageKind(kind: string): asserts kind is MessageKind {
  if (!MESSAGE_KINDS.includes(kind as MessageKind)) {
    throw new HttpError(400, "BAD_REQUEST", `Invalid message kind: ${kind}`);
  }
}

// ─── List ─────────────────────────────────────────────────────────────

export async function listConversations(
  scope: EmployeeScope,
  params: { filters?: ConversationListFilters; page?: number; pageSize?: number } = {},
): Promise<ConversationListResult> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
  const filters = params.filters ?? {};
  const owner = conversationScope(scope);

  const fieldFilters: Record<string, unknown> = {};
  if (filters.studentId) fieldFilters.studentId = filters.studentId;
  if (filters.applicationId) fieldFilters.applicationId = filters.applicationId;

  const search = filters.search?.trim();
  const searchFilter = search
    ? {
        OR: [
          { subject: { contains: search, mode: "insensitive" as const } },
          { student: { firstName: { contains: search, mode: "insensitive" as const } } },
          { student: { lastName: { contains: search, mode: "insensitive" as const } } },
          { student: { email: { contains: search, mode: "insensitive" as const } } },
        ],
      }
    : {};

  const where = { ...owner, ...searchFilter, ...fieldFilters };

  const [rows, total] = await Promise.all([
    prisma.conversation.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        subject: true,
        createdAt: true,
        updatedAt: true,
        student: { select: { id: true, firstName: true, lastName: true, email: true } },
        application: { select: { id: true, applicationNumber: true } },
        employee: { select: { id: true, user: { select: { name: true } } } },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true, body: true, kind: true, senderId: true, createdAt: true },
        },
      },
    }),
    prisma.conversation.count({ where }),
  ]);

  // Unread counts — fetch per-conversation in parallel (single round-trip per row).
  // This is acceptable because the page size is capped at 100.
  const unreadPromises = rows.map((r) =>
    prisma.message.count({
      where: {
        conversationId: r.id,
        readAt: null,
        senderId: { not: scope.userId },
      },
    }),
  );
  const unreadCounts = await Promise.all(unreadPromises);

  const mapped: ConversationListItem[] = rows.map((r, i) => ({
    id: r.id,
    subject: r.subject,
    student: r.student,
    application: r.application,
    employee: r.employee ? { id: r.employee.id, name: r.employee.user.name } : null,
    unreadCount: unreadCounts[i] ?? 0,
    lastMessage: r.messages[0]
      ? {
          id: r.messages[0].id,
          body: r.messages[0].body,
          kind: r.messages[0].kind,
          senderId: r.messages[0].senderId,
          createdAt: r.messages[0].createdAt,
        }
      : null,
    updatedAt: r.updatedAt,
    createdAt: r.createdAt,
  }));

  // Apply unreadOnly filter *after* counting (cheap, page-sized).
  const filtered = filters.unreadOnly ? mapped.filter((c) => c.unreadCount > 0) : mapped;

  return {
    rows: filtered,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

// ─── Detail ───────────────────────────────────────────────────────────

export async function getConversationById(
  scope: EmployeeScope,
  id: string,
): Promise<ConversationDetail | null> {
  const owner = conversationScope(scope);
  const conv = await prisma.conversation.findFirst({
    where: { id, ...owner },
    select: {
      id: true,
      subject: true,
      createdAt: true,
      updatedAt: true,
      student: { select: { id: true, firstName: true, lastName: true, email: true, studentId: true } },
      application: { select: { id: true, applicationNumber: true } },
      employee: { select: { id: true, user: { select: { name: true } } } },
      messages: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true, body: true, kind: true, senderId: true,
          readAt: true, createdAt: true, attachments: true,
        },
      },
    },
  });
  if (!conv) return null;

  return {
    id: conv.id,
    subject: conv.subject,
    student: conv.student,
    application: conv.application,
    employee: conv.employee ? { id: conv.employee.id, name: conv.employee.user.name } : null,
    messages: conv.messages.map((m) => ({
      id: m.id,
      body: m.body,
      kind: m.kind,
      senderId: m.senderId,
      readAt: m.readAt,
      createdAt: m.createdAt,
      attachments: normalizeAttachmentsFromDb(m.attachments),
    })),
    createdAt: conv.createdAt,
    updatedAt: conv.updatedAt,
  };
}

export async function requireConversation(
  scope: EmployeeScope,
  id: string,
): Promise<ConversationDetail> {
  const c = await getConversationById(scope, id);
  if (!c) throw new HttpError(404, "NOT_FOUND", "Conversation not found");
  return c;
}

// ─── Start conversation ───────────────────────────────────────────────

export async function startConversation(
  scope: EmployeeScope,
  input: {
    studentId: string;
    applicationId?: string;
    subject?: string;
    firstMessage?: string;
    firstMessageKind?: MessageKind;
    attachments?: AttachmentInput[];
  },
  actor: { id: string },
): Promise<{ id: string }> {
  if (!input.studentId?.trim()) {
    throw new HttpError(422, "VALIDATION_ERROR", "studentId is required");
  }
  if (input.subject && input.subject.length > MAX_SUBJECT) {
    throw new HttpError(422, "VALIDATION_ERROR", `Subject must be ≤ ${MAX_SUBJECT} characters`);
  }

  // Verify the caller owns this student (IDOR guard).
  const studentOwner = studentOwnershipScope(scope);
  const student = await prisma.student.findFirst({
    where: { id: input.studentId, ...studentOwner },
    select: { id: true, assignedEmployeeId: true },
  });
  if (!student) {
    throw new HttpError(404, "NOT_FOUND", "Student not found");
  }

  // Verify application belongs to the student, if specified.
  if (input.applicationId) {
    const app = await prisma.application.findFirst({
      where: { id: input.applicationId, studentId: input.studentId },
      select: { id: true },
    });
    if (!app) {
      throw new HttpError(404, "NOT_FOUND", "Application not found for this student");
    }
  }

  // Resolve the employee on the conversation. For ADMIN callers, attach to
  // the student's assigned employee (if any) so the conversation has a
  // responsible owner.
  let employeeId: string | null = null;
  if (scope.isAdmin) {
    employeeId = student.assignedEmployeeId;
  } else {
    employeeId = scope.employeeId;
  }

  const firstKind = input.firstMessageKind ?? "STUDENT_MESSAGE";
  assertMessageKind(firstKind);

  const firstBody = input.firstMessage?.trim();
  if (firstBody && firstBody.length > MAX_MESSAGE_BODY) {
    throw new HttpError(422, "VALIDATION_ERROR", `Message body must be ≤ ${MAX_MESSAGE_BODY} characters`);
  }
  const attachments = normalizeAttachments(input.attachments);

  const conv = await prisma.conversation.create({
    data: {
      studentId: input.studentId,
      employeeId,
      applicationId: input.applicationId ?? null,
      subject: input.subject?.trim() || null,
      messages: firstBody
        ? {
            create: [
              {
                senderId: actor.id,
                body: firstBody,
                kind: firstKind,
                attachments: attachments.length > 0 ? (attachments as unknown as JsonValue) : undefined,
                // Employee-sent messages are read by sender at creation.
                readAt: new Date(),
              },
            ],
          }
        : undefined,
    },
    select: { id: true },
  });

  try {
    await prisma.auditLog.create({
      data: {
        userId: actor.id,
        action: "conversation.created",
        entity: "Conversation",
        entityId: conv.id,
        newValue: { studentId: input.studentId, applicationId: input.applicationId ?? null } as object,
      },
    });
  } catch (err) {
    console.error("[conversation-create] audit failed", err);
  }

  return { id: conv.id };
}

// ─── Send message ─────────────────────────────────────────────────────

export async function sendMessage(
  scope: EmployeeScope,
  conversationId: string,
  input: {
    body: string;
    kind?: MessageKind;
    attachments?: AttachmentInput[];
  },
  actor: { id: string },
): Promise<{ id: string }> {
  const body = input.body?.trim();
  if (!body) {
    throw new HttpError(422, "VALIDATION_ERROR", "Message body cannot be empty");
  }
  if (body.length > MAX_MESSAGE_BODY) {
    throw new HttpError(422, "VALIDATION_ERROR", `Message body must be ≤ ${MAX_MESSAGE_BODY} characters`);
  }

  const kind = input.kind ?? "STUDENT_MESSAGE";
  assertMessageKind(kind);

  const attachments = normalizeAttachments(input.attachments);

  // IDOR: ensure the conversation is owned by the caller.
  const owner = conversationScope(scope);
  const conv = await prisma.conversation.findFirst({
    where: { id: conversationId, ...owner },
    select: { id: true },
  });
  if (!conv) {
    throw new HttpError(404, "NOT_FOUND", "Conversation not found");
  }

  const message = await prisma.message.create({
    data: {
      conversationId,
      senderId: actor.id,
      body,
      kind,
      attachments: attachments.length > 0 ? (attachments as unknown as JsonValue) : undefined,
      // Sender has implicitly read their own message.
      readAt: new Date(),
    },
    select: { id: true },
  });

  // Bump conversation.updatedAt so the list re-sorts.
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  // Notify the other party if the message is a student-visible one.
  // (Internal notes never notify students — they're employee-only.)
  if (kind === "STUDENT_MESSAGE") {
    try {
      const studentRow = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { student: { select: { userId: true, firstName: true } } },
      });
      if (studentRow) {
        await emitNotification({
          userId: studentRow.student.userId,
          type: "MESSAGE_RECEIVED",
          title: "New message",
          message: body.slice(0, 120),
          link: `/student/messages/${conversationId}`,
          entityType: "Conversation",
          entityId: conversationId,
        });
      }
    } catch (err) {
      console.error("[message-send] notification failed", err);
    }
  }

  try {
    await prisma.auditLog.create({
      data: {
        userId: actor.id,
        action: "message.sent",
        entity: "Message",
        entityId: message.id,
        newValue: { conversationId, kind, attachmentCount: attachments.length } as object,
      },
    });
  } catch (err) {
    console.error("[message-send] audit failed", err);
  }

  return { id: message.id };
}

// ─── Mark conversation as read ─────────────────────────────────────────

/**
 * Mark all messages in the conversation as read by the caller. Only marks
 * messages where `senderId !== callerUserId` AND `readAt IS NULL`.
 *
 * This is the read-receipt side of the spec: when an employee opens a
 * conversation, every unread message *from the student* is marked read.
 * Messages the employee themselves sent already have `readAt` set.
 */
export async function markConversationRead(
  scope: EmployeeScope,
  conversationId: string,
  callerUserId: string,
): Promise<{ updated: number }> {
  const owner = conversationScope(scope);
  const conv = await prisma.conversation.findFirst({
    where: { id: conversationId, ...owner },
    select: { id: true },
  });
  if (!conv) {
    throw new HttpError(404, "NOT_FOUND", "Conversation not found");
  }

  // Update all messages that are not from the caller and not yet read.
  const result = await prisma.message.updateMany({
    where: {
      conversationId,
      senderId: { not: callerUserId },
      readAt: null,
    },
    data: { readAt: new Date() },
  });

  return { updated: result.count };
}

// ─── Unread count (badge) ──────────────────────────────────────────────

export async function getUnreadCount(scope: EmployeeScope): Promise<{
  total: number;
  byConversation: { conversationId: string; unread: number }[];
}> {
  const owner = conversationScope(scope);
  const conversations = await prisma.conversation.findMany({
    where: owner,
    select: {
      id: true,
      _count: {
        select: {
          messages: {
            where: { readAt: null, senderId: { not: scope.userId } },
          },
        },
      },
    },
  });

  const byConversation = conversations
    .map((c) => ({ conversationId: c.id, unread: c._count.messages }))
    .filter((c) => c.unread > 0);

  return {
    total: byConversation.reduce((sum, c) => sum + c.unread, 0),
    byConversation,
  };
}

// ─── Latest message cursor (for polling) ──────────────────────────────

/**
 * Lightweight endpoint for polling: returns only the messages created after
 * `sinceCursor` (ISO timestamp). Used by the chat detail page to fetch new
 * messages without re-fetching the whole history.
 *
 * Returns the messages *and* the latest message id (so the client can
 * pass it as the next cursor — though using the latest `createdAt` is fine).
 */
export async function pollNewMessages(
  scope: EmployeeScope,
  conversationId: string,
  since: Date,
): Promise<{ messages: MessageRow[] }> {
  const owner = conversationScope(scope);
  const conv = await prisma.conversation.findFirst({
    where: { id: conversationId, ...owner },
    select: { id: true },
  });
  if (!conv) {
    throw new HttpError(404, "NOT_FOUND", "Conversation not found");
  }

  const messages = await prisma.message.findMany({
    where: {
      conversationId,
      createdAt: { gt: since },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true, body: true, kind: true, senderId: true,
      readAt: true, createdAt: true, attachments: true,
    },
    take: 100,
  });

  return {
    messages: messages.map((m) => ({
      id: m.id,
      body: m.body,
      kind: m.kind,
      senderId: m.senderId,
      readAt: m.readAt,
      createdAt: m.createdAt,
      attachments: normalizeAttachmentsFromDb(m.attachments),
    })),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────

function normalizeAttachmentsFromDb(raw: unknown): Attachment[] {
  if (!raw || !Array.isArray(raw)) return [];
  const out: Attachment[] = [];
  for (const item of raw as unknown[]) {
    if (!item || typeof item !== "object") continue;
    const a = item as Record<string, unknown>;
    if (
      typeof a.fileUrl === "string" &&
      typeof a.fileName === "string" &&
      typeof a.mimeType === "string" &&
      typeof a.fileSize === "number"
    ) {
      out.push({
        fileUrl: a.fileUrl,
        fileName: a.fileName,
        mimeType: a.mimeType,
        fileSize: a.fileSize,
        uploadedAt: typeof a.uploadedAt === "string" ? a.uploadedAt : new Date().toISOString(),
      });
    }
  }
  return out;
}
