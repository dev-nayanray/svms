import { NextRequest } from "next/server";
import { ok, handleApiError, notFound } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { visaApplicationUpdateSchema } from "@/lib/validations";
import { visaService } from "@/lib/services/visa";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Get a single visa application with full detail: the visa record
 * itself, the linked application (student, country, university, course),
 * the student's documents relevant to this application, and the status
 * history timeline (from ApplicationStatusHistory — shared with the
 * application pipeline).
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard("visa.read");
    if (g.error) return g.error;
    const { id } = await params;

    const visa = await prisma.visaApplication.findFirst({
      where: { id, deletedAt: null },
      include: {
        application: {
          select: {
            id: true,
            applicationNumber: true,
            stageKey: true,
            status: true,
            priority: true,
            student: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                studentId: true,
                email: true,
                phone: true,
              },
            },
            country: { select: { id: true, name: true, flag: true } },
            university: { select: { id: true, name: true } },
            course: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!visa) throw notFound("Visa application");

    // Documents relevant to this application (visa + application scope)
    const documents = await prisma.document.findMany({
      where: {
        deletedAt: null,
        applicationId: visa.applicationId,
      },
      select: {
        id: true,
        name: true,
        fileName: true,
        mimeType: true,
        fileSize: true,
        status: true,
        uploadedAt: true,
        reviewedAt: true,
        expiresAt: true,
        requirement: {
          select: { id: true, name: true, appliesTo: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Timeline = ApplicationStatusHistory for this application, plus
    // audit-log entries for this visa record. Merged and sorted by date.
    // The ApplicationStatusHistory model stores changedById as a plain
    // ObjectId (no relation to User), so we resolve names separately.
    const [history, auditEntries] = await Promise.all([
      prisma.applicationStatusHistory.findMany({
        where: { applicationId: visa.applicationId },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.auditLog.findMany({
        where: { entity: "VisaApplication", entityId: id },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
    ]);

    // Resolve the actor names for the history entries (changedById → User.name)
    const changedByIds = [
      ...new Set(
        history
          .map((h) => h.changedById)
          .filter((id): id is string => !!id),
      ),
    ];
    const users = changedByIds.length
      ? await prisma.user.findMany({
          where: { id: { in: changedByIds } },
          select: { id: true, name: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u.name]));

    // Merge the two timeline sources into a single sorted list
    const timeline = [
      ...history.map((h) => ({
        id: h.id,
        type: "stage_change" as const,
        fromStage: h.fromStage,
        toStage: h.toStage,
        note: h.note,
        actor: h.changedById ? userMap.get(h.changedById) ?? "System" : "System",
        createdAt: h.createdAt,
      })),
      ...auditEntries.map((a) => ({
        id: a.id,
        type: "audit" as const,
        action: a.action,
        oldValue: a.oldValue,
        newValue: a.newValue,
        actor: null,
        createdAt: a.createdAt,
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return ok({ ...visa, documents, timeline });
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * Update editable fields on a visa application (visaType, dates, notes).
 * Stage changes go through PATCH /api/visa (the stage-change endpoint)
 * so they can be audit-logged distinctly from field edits.
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard("visa.manage");
    if (g.error) return g.error;
    const { id } = await params;
    const body = visaApplicationUpdateSchema.parse(await req.json());
    const updated = await visaService.update(id, body, g.user);
    return ok(updated);
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * Archive (soft-delete) a visa application. Retains the record for
 * audit trails.
 */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard("visa.manage");
    if (g.error) return g.error;
    const { id } = await params;
    const archived = await visaService.archive(id, g.user);
    return ok({ archived: true, deletedAt: archived.deletedAt });
  } catch (err) {
    return handleApiError(err);
  }
}
