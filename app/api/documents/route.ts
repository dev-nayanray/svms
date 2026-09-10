import { NextRequest } from "next/server";
import { ok, handleApiError } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { documentService } from "@/lib/services/document";
import { documentUploadSchema, paginationSchema } from "@/lib/validations";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const g = await guard("documents.read");
    if (g.error) return g.error;
    const sp = req.nextUrl.searchParams;
    const params = paginationSchema.parse({
      page: sp.get("page") ?? 1,
      pageSize: sp.get("pageSize") ?? 20,
      status: sp.get("status") ?? undefined,
    });

    let studentId = sp.get("studentId") ?? undefined;
    if (g.user.role === "STUDENT") {
      const me = await prisma.student.findUnique({ where: { userId: g.user.id } });
      studentId = me?.id ?? "none";
    }

    const { data, total } = await documentService.list({
      ...params,
      studentId,
      applicationId: sp.get("applicationId") ?? undefined,
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
