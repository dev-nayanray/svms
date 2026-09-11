import { NextRequest } from "next/server";
import { ok, handleApiError } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { leadService } from "@/lib/services/lead";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard("leads.manage");
    if (g.error) return g.error;
    const { id } = await params;
    const student = await leadService.convertToStudent(id, g.user);
    return ok(student, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
