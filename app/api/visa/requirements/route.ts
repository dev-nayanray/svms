import { NextRequest } from "next/server";
import { ok, handleApiError } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const g = await guard("visa.read");
    if (g.error) return g.error;
    const countryId = req.nextUrl.searchParams.get("countryId") ?? undefined;
    const data = await prisma.visaRequirement.findMany({
      where: { status: "ACTIVE", ...(countryId ? { countryId } : {}) },
      include: { country: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    return ok({ data });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const g = await guard("visa.manage");
    if (g.error) return g.error;
    const body = (await req.json()) as {
      countryId: string;
      name: string;
      description?: string;
      required?: boolean;
      sortOrder?: number;
    };
    const item = await prisma.visaRequirement.create({ data: body });
    return ok(item, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
