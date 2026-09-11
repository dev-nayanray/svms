import { NextRequest } from "next/server";
import { ok, handleApiError, fail, sortFrom } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { visaApplicationCreateSchema, visaStageChangeSchema } from "@/lib/validations";
import { auditLog } from "@/lib/services/audit";
import { buildAdminVisaWhere, type VisaStatus } from "@/lib/constants/visa";
import { visaService } from "@/lib/services/visa";

/**
 * Admin visa application list endpoint.
 *
 * Returns visa applications with full filters: search (application
 * number OR student name), stage, countryId, studentId, applicationId,
 * universityId. Sorting via the `sortFrom` allow-list. Pagination
 * server-side. Soft-deleted records are excluded by default.
 */
export async function GET(req: NextRequest) {
  try {
    const g = await guard("visa.read");
    if (g.error) return g.error;
    const sp = req.nextUrl.searchParams;
    const page = Math.max(Number(sp.get("page") ?? 1), 1);
    const pageSize = Math.min(Number(sp.get("pageSize") ?? 20), 100);

    const where = buildAdminVisaWhere({
      search: sp.get("search") ?? undefined,
      stage: sp.get("stage") ?? undefined,
      countryId: sp.get("countryId") ?? undefined,
      studentId: sp.get("studentId") ?? undefined,
      applicationId: sp.get("applicationId") ?? undefined,
      universityId: sp.get("universityId") ?? undefined,
    });

    const [data, total] = await Promise.all([
      prisma.visaApplication.findMany({
        where,
        include: {
          application: {
            select: {
              id: true,
              applicationNumber: true,
              student: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  studentId: true,
                },
              },
              country: { select: { id: true, name: true, flag: true } },
              university: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: sortFrom(sp, ["stage", "submittedAt", "biometricsAt", "interviewAt", "decisionAt", "createdAt", "updatedAt"], {
          updatedAt: "desc",
        }),
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.visaApplication.count({ where }),
    ]);
    return ok({
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(Math.ceil(total / pageSize), 1),
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * Create a new visa application record tied to an existing application.
 * Used when an application reaches the visa stage and a visa record
 * doesn't yet exist (the auto-creation happens in applicationService
 * when the stage moves to VISA_PREPARATION, but this endpoint allows
 * manual creation).
 */
export async function POST(req: NextRequest) {
  try {
    const g = await guard("visa.manage");
    if (g.error) return g.error;
    const body = visaApplicationCreateSchema.parse(await req.json());

    // Validate the application exists
    const application = await prisma.application.findFirst({
      where: { id: body.applicationId, deletedAt: null },
    });
    if (!application) return fail("NOT_FOUND", "Application not found", 404);

    // Check there isn't already a visa application for this application
    const existing = await prisma.visaApplication.findUnique({
      where: { applicationId: body.applicationId },
    });
    if (existing) return fail("CONFLICT", "Visa application already exists for this application", 409);

    const visa = await prisma.visaApplication.create({
      data: {
        applicationId: body.applicationId,
        visaType: body.visaType,
        notes: body.notes,
        stage: "PREPARATION",
      },
    });

    await auditLog.record({
      userId: g.user.id,
      action: "visa_application.created",
      entity: "VisaApplication",
      entityId: visa.id,
      newValue: {
        applicationId: body.applicationId,
        visaType: body.visaType,
        stage: "PREPARATION",
      },
    });

    return ok(visa, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * Change the stage of a visa application. Delegates to
 * `visaService.changeStage` which enforces transition rules, writes an
 * `ApplicationStatusHistory` entry, syncs the linked application's
 * stageKey, notifies the student, and audit-logs the change.
 *
 * Body: { id: string, stage: VisaStatus, note?: string }
 */
export async function PATCH(req: NextRequest) {
  try {
    const g = await guard("visa.manage");
    if (g.error) return g.error;
    const raw = (await req.json()) as { id?: string; stage?: string; note?: string };
    if (!raw.id) return fail("BAD_REQUEST", "Visa application id is required", 422);
    const body = visaStageChangeSchema.parse(raw);

    const updated = await visaService.changeStage(
      raw.id,
      body.stage as VisaStatus,
      body.note,
      g.user,
    );
    return ok(updated);
  } catch (err) {
    return handleApiError(err);
  }
}
