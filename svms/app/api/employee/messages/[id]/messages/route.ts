import { NextRequest } from "next/server";
import { ok, handleApiError, HttpError } from "@/lib/api";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { z } from "zod";
import {
  sendMessage,
  type AttachmentInput,
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

const sendSchema = z.object({
  body: z.string().min(1).max(MAX_MESSAGE_BODY),
  kind: z.enum(MESSAGE_KINDS).default("STUDENT_MESSAGE"),
  attachments: z.array(attachmentSchema).max(MAX_ATTACHMENTS_PER_MESSAGE).optional(),
});

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
    userId: session.user.id,
    role,
  };
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { scope, userId, role } = await resolveScope();
    if (!hasPermission(role, "messages.create")) {
      throw new HttpError(403, "FORBIDDEN", "Missing messages.create permission");
    }
    const { id } = await ctx.params;
    const body = sendSchema.parse(await req.json());
    const result = await sendMessage(
      scope,
      id,
      {
        body: body.body,
        kind: body.kind,
        attachments: body.attachments as AttachmentInput[] | undefined,
      },
      { id: userId },
    );
    return ok(result, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
