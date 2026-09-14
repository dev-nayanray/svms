import { NextRequest } from "next/server";
import { ok, handleApiError, notFound, fail } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { documentRequirementUpdateSchema } from "@/lib/validations";
import { auditLog } from "@/lib/services/audit";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard("documents.read");
    if (g.error) return g.error;
    const { id } = await params;
    const item = await prisma.documentRequirement.findUnique({
      where: { id },
      include: { country: true },
    });
    if (!item) throw notFound("Document requirement");
    return ok(item);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard("documents.review");
    if (g.error) return g.error;
    const { id } = await params;
    const body = documentRequirementUpdateSchema.parse(await req.json());
    const item = await prisma.documentRequirement.findUnique({ where: { id } });
    if (!item) throw notFound("Document requirement");

    if (body.countryId) {
      const country = await prisma.country.findFirst({
        where: { id: body.countryId, deletedAt: null },
      });
      if (!country) return fail("NOT_FOUND", "Country not found", 404);
    }

    const updated = await prisma.documentRequirement.update({
      where: { id },
      data: body,
    });
    await auditLog.record({
      userId: g.user.id,
      action: "document_requirement.updated",
      entity: "DocumentRequirement",
      entityId: id,
      oldValue: {
        name: item.name,
        description: item.description,
        countryId: item.countryId,
        appliesTo: item.appliesTo,
        required: item.required,
        status: item.status,
      },
      newValue: {
        name: body.name,
        description: body.description,
        countryId: body.countryId,
        appliesTo: body.appliesTo,
        required: body.required,
        status: body.status,
      },
    });
    return ok(updated);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard("documents.review");
    if (g.error) return g.error;
    const { id } = await params;
    const item = await prisma.documentRequirement.findUnique({ where: { id } });
    if (!item) throw notFound("Document requirement");

    // Guard: a requirement referenced by uploaded documents should not be
    // hard-deleted (it would orphan the join). Soft-delete by setting status
    // to INACTIVE instead. The route returns 409 with a clear message so the
    // UI can pivot to the soft-delete path.
    const referenced = await prisma.document.count({
      where: { requirementId: id },
    });
    if (referenced > 0) {
      return fail(
        "CONFLICT",
        `${referenced} uploaded document(s) reference this requirement. Deactivate it instead of deleting.`,
        409,
      );
    }
    await prisma.documentRequirement.delete({ where: { id } });
    await auditLog.record({
      userId: g.user.id,
      action: "document_requirement.deleted",
      entity: "DocumentRequirement",
      entityId: id,
      oldValue: { name: item.name, code: item.code, countryId: item.countryId },
    });
    return ok({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
