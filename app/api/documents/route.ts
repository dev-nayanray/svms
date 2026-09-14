import { NextRequest } from "next/server";
import { ok, handleApiError } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { documentService } from "@/lib/services/document";
import { documentUploadSchema, paginationSchema } from "@/lib/validations";
import { prisma } from "@/lib/db";

/**
 * Admin document list endpoint.
 *
 * Returns documents with the soft-delete filter driven by the
 * `?archived=true` toggle. Server-side search spans document name,
 * file name, and student name. Filters: status, countryId, applicationId,
 * studentId, employeeId, uploadedFrom/uploadedTo (date range on
 * uploadedAt). Sorting is by createdAt desc (most recent first).
 */
export async function GET(req: NextRequest) {
  try {
    const g = await guard("documents.read");
    if (g.error) return g.error;
    const sp = req.nextUrl.searchParams;
    const params = paginationSchema.parse({
      page: sp.get("page") ?? 1,
      pageSize: sp.get("pageSize") ?? 20,
      search: sp.get("search") ?? undefined,
      status: sp.get("status") ?? undefined,
    });

    // Students can only see their own documents — this is enforced at
    // the service level so the filter is applied even if the client
    // tries to omit it.
    let studentId = sp.get("studentId") ?? undefined;
    if (g.user.role === "STUDENT") {
      const me = await prisma.student.findUnique({ where: { userId: g.user.id } });
      studentId = me?.id ?? "none";
    }

    const archived = sp.get("archived") === "true";
    const uploadedFrom = sp.get("uploadedFrom")
      ? new Date(sp.get("uploadedFrom")!)
      : undefined;
    const uploadedTo = sp.get("uploadedTo")
      ? new Date(sp.get("uploadedTo")!)
      : undefined;

    const { data, total } = await documentService.list({
      page: params.page,
      pageSize: params.pageSize,
      search: params.search,
      status: params.status,
      countryId: sp.get("countryId") ?? undefined,
      applicationId: sp.get("applicationId") ?? undefined,
      studentId,
      employeeId: sp.get("employeeId") ?? undefined,
      uploadedFrom,
      uploadedTo,
      archived,
    });
    return ok({
      data,
      pagination: {
        page: params.page,
        pageSize: params.pageSize,
        total,
        totalPages: Math.max(Math.ceil(total / params.pageSize), 1),
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const g = await guard("documents.upload");
    if (g.error) return g.error;
    const body = documentUploadSchema.parse(await req.json());
    const doc = await documentService.upload(body, g.user);
    return ok(doc, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
