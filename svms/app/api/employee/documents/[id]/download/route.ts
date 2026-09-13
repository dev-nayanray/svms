import { NextRequest } from "next/server";
import { handleApiError, HttpError } from "@/lib/api";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getDocumentForDownload } from "@/lib/services/document-cases";

export const dynamic = "force-dynamic";

/**
 * GET /api/employee/documents/[id]/download
 *
 * Streams the document file to the caller. Ownership is verified
 * server-side — the file is never served from a public URL. Returns
 * the file with a Content-Disposition header so the browser downloads
 * it rather than rendering it inline (prevents XSS via uploaded HTML).
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
    const role = (session.user as { role?: string }).role;
    if (role !== "EMPLOYEE" && role !== "ADMIN") throw new HttpError(403, "FORBIDDEN", "Employees only");

    let employeeId: string | null = null;
    if (role === "EMPLOYEE") {
      const employee = await prisma.employee.findFirst({ where: { userId: session.user.id }, select: { id: true } });
      if (!employee) throw new HttpError(403, "FORBIDDEN", "No employee record");
      employeeId = employee.id;
    }

    const scope = { isAdmin: role === "ADMIN", userId: session.user.id, employeeId };
    const { id } = await ctx.params;
    const file = await getDocumentForDownload(scope, id);

    // Decode the data URL into a binary buffer
    const match = file.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      throw new HttpError(500, "INTERNAL_ERROR", "File is not in a decodable format");
    }
    const buffer = Buffer.from(match[2], "base64");

    // Return with Content-Disposition: attachment (not inline) to prevent
    // the browser from rendering potentially malicious content.
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": `attachment; filename="${file.fileName}"`,
        "Content-Length": String(buffer.length),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

import { NextResponse } from "next/server";
