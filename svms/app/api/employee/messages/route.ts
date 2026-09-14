import { NextRequest } from "next/server";
import { ok, handleApiError, HttpError } from "@/lib/api";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { z } from "zod";
import {
  listConversations,
  startConversation,
  type ConversationListFilters,
  type AttachmentInput,
  MAX_SUBJECT,
  MAX_MESSAGE_BODY,
  MAX_ATTACHMENTS_PER_MESSAGE,
  MAX_ATTACHMENT_BYTES,
  ALLOWED_ATTACHMENT_MIME_TYPES,
  MESSAGE_KINDS,
} from "@/lib/services/message-cases";

const attachmentSchema = z.object({
  fileUrl: z.string().url().max(2048),
  fileName: z.string().min(1).max(255),
  mimeType: z.enum(ALLOWED_ATTACHMENT_MIME_TYPES),
  fileSize: z.number().int().positive().max(MAX_ATTACHMENT_BYTES),
  uploadedAt: z.string().datetime().optional(),
});

const createSchema = z.object({
  studentId: z.string().min(1).max(64),
  applicationId: z.string().min(1).max(64).optional(),
  subject: z.string().max(MAX_SUBJECT).optional(),
  firstMessage: z.string().max(MAX_MESSAGE_BODY).optional(),
  firstMessageKind: z.enum(MESSAGE_KINDS).optional(),
  attachments: z.array(attachmentSchema).max(MAX_ATTACHMENTS_PER_MESSAGE).optional(),
});

/**
 * Helper: resolves the EmployeeScope from the session. Throws HttpError
 * on auth failures so the route handler can let it bubble to handleApiError.
 */
async function resolveScope() {
  const session = await auth();
  if (!session?.user?.id) throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
  const role = (session.user as { role?: string }).role;
  if (role !== "EMPLOYEE" && role !== "ADMIN") throw new HttpError(403, "FORBIDDEN", "Employees only");

  let employeeId: string | null = null;
  if (role === "EMPLOYEE") {
    const employee = await prisma.employee.findFirst({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (!employee) throw new HttpError(403, "FORBIDDEN", "No employee record");
    employeeId = employee.id;
  }
  return {
    scope: { isAdmin: role === "ADMIN", userId: session.user.id, employeeId },
    user: { id: session.user.id, name: session.user.name, email: session.user.email },
    role,
  };
}

export async function GET(req: NextRequest) {
  try {
    const { scope } = await resolveScope();
    const sp = req.nextUrl.searchParams;
    const filters: ConversationListFilters = {
      search: sp.get("search") ?? undefined,
      studentId: sp.get("studentId") ?? undefined,
      applicationId: sp.get("applicationId") ?? undefined,
      unreadOnly: sp.get("unreadOnly") === "true",
    };
    const result = await listConversations(scope, {
      filters,
      page: Number(sp.get("page") ?? 1),
      pageSize: Number(sp.get("pageSize") ?? 20),
    });
    return ok(result);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { scope, user, role } = await resolveScope();
    if (!hasPermission(role, "messages.create")) {
      throw new HttpError(403, "FORBIDDEN", "Missing messages.create permission");
    }
    const body = createSchema.parse(await req.json());
    const result = await startConversation(
      scope,
      {
        studentId: body.studentId,
        applicationId: body.applicationId,
        subject: body.subject,
        firstMessage: body.firstMessage,
        firstMessageKind: body.firstMessageKind,
        attachments: body.attachments as AttachmentInput[] | undefined,
      },
      { id: user.id },
    );
    return ok(result, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
