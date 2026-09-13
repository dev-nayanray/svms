import { NextRequest } from "next/server";
import { ok, handleApiError, fail } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/services/audit";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/users/[id] — user detail with linked profile.
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard("employees.read");
    if (g.error) return g.error;
    const { id } = await params;
    const user = await prisma.user.findFirst({
      where: { id },
      select: {
        id: true, name: true, email: true, phone: true,
        roleName: true, status: true, lastLoginAt: true,
        emailVerifiedAt: true, createdAt: true, updatedAt: true,
        branchId: true,
        student: {
          select: {
            id: true, studentId: true, firstName: true, lastName: true,
            email: true, phone: true, whatsapp: true, nationality: true,
            passportNumber: true, city: true, country: true,
            profilePhotoUrl: true, status: true,
          },
        },
        employee: {
          select: { id: true, title: true },
        },
        branch: { select: { id: true, name: true, code: true } },
      },
    });
    if (!user) return fail("NOT_FOUND", "User not found", 404);
    return ok(user);
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * PATCH /api/users/[id] — update user name, phone, status.
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard("employees.update");
    if (g.error) return g.error;
    const { id } = await params;
    const body = await req.json();
    const existing = await prisma.user.findFirst({ where: { id } });
    if (!existing) return fail("NOT_FOUND", "User not found", 404);

    const data: Record<string, unknown> = {};
    if (body.name) data.name = body.name;
    if (body.phone !== undefined) data.phone = body.phone;
    if (body.status) data.status = body.status; // ACTIVE | INACTIVE | SUSPENDED

    const updated = await prisma.user.update({ where: { id }, data });

    const { ipAddress, userAgent } = auditLog.fromRequest(req);
    await auditLog.record({
      userId: g.user.id,
      action: "user.updated",
      entity: "User",
      entityId: id,
      oldValue: { name: existing.name, status: existing.status },
      newValue: data,
      ipAddress,
      userAgent,
    });

    return ok({ id: updated.id, name: updated.name, status: updated.status });
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * DELETE /api/users/[id] — soft delete user (set deletedAt).
 */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard("employees.delete");
    if (g.error) return g.error;
    const { id } = await params;

    // Prevent self-deletion
    if (id === g.user.id) {
      return fail("BAD_REQUEST", "You cannot delete your own account", 400);
    }

    const existing = await prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return fail("NOT_FOUND", "User not found", 404);

    await prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), status: "INACTIVE" },
    });

    const { ipAddress, userAgent } = auditLog.fromRequest(req);
    await auditLog.record({
      userId: g.user.id,
      action: "user.deleted",
      entity: "User",
      entityId: id,
      oldValue: { name: existing.name, email: existing.email },
      ipAddress,
      userAgent,
    });

    return ok({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
