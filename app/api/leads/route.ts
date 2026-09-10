import { NextRequest } from "next/server";
import { ok, handleApiError, sortFrom } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { leadService } from "@/lib/services/lead";
import { leadSchema, paginationSchema } from "@/lib/validations";
import { auditLog } from "@/lib/services/audit";
import { conversionBlockReason } from "@/lib/constants/leads";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest) {
  try {
    const g = await guard("leads.read");
    if (g.error) return g.error;
    const sp = req.nextUrl.searchParams;
    const params = paginationSchema.parse({
      page: sp.get("page") ?? 1,
      pageSize: sp.get("pageSize") ?? 20,
      search: sp.get("search") ?? undefined,
      status: sp.get("status") ?? undefined,
    });

    const createdFromRaw = sp.get("createdFrom");
    const createdToRaw = sp.get("createdTo");
    const createdFrom =
      createdFromRaw && DATE_RE.test(createdFromRaw) ? new Date(`${createdFromRaw}T00:00:00`) : undefined;
    const createdTo =
      createdToRaw && DATE_RE.test(createdToRaw) ? new Date(`${createdToRaw}T23:59:59.999`) : undefined;
    const archived = sp.get("archived") === "true" ? true : sp.get("archived") === "all" ? undefined : false;

    const { data, total } = await leadService.list({
      ...params,
      source: sp.get("source") ?? undefined,
      countryId: sp.get("countryId") ?? undefined,
      intake: sp.get("intake") ?? undefined,
      employeeId: sp.get("employeeId") ?? undefined,
      createdFrom,
      createdTo,
      archived,
      sortBy: sortFrom(sp, ["name", "status", "source", "createdAt"]),
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
    const g = await guard("leads.manage");
    if (g.error) return g.error;
    const body = leadSchema.parse(await req.json());
    const lead = await prisma.lead.create({
      data: { ...body, email: body.email || undefined },
    });
    await auditLog.record({
      userId: g.user.id,
      action: "lead.created",
      entity: "Lead",
      entityId: lead.id,
      newValue: { name: body.name, source: body.source, status: body.status },
    });
    return ok(lead, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

/** Pre-flight check whether a lead can be converted (used by the UI). */
export async function PUT(req: NextRequest) {
  try {
    const g = await guard("leads.manage");
    if (g.error) return g.error;
    const { id } = (await req.json()) as { id?: string };
    if (!id) return ok({ canConvert: false, reason: "Missing id" });
    const lead = await prisma.lead.findFirst({ where: { id, deletedAt: null } });
    if (!lead) return ok({ canConvert: false, reason: "Lead not found" });
    const reason = conversionBlockReason(lead);
    return ok({ canConvert: reason === null, reason });
  } catch (err) {
    return handleApiError(err);
  }
}
