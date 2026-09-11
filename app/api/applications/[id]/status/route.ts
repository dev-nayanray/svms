import { NextRequest } from "next/server";
import { ok, handleApiError } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { applicationService } from "@/lib/services/application";
import { applicationStatusSchema } from "@/lib/validations";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard("applications.manage");
    if (g.error) return g.error;
    const { id } = await params;
    const body = applicationStatusSchema.parse(await req.json());
    const app = await applicationService.changeStage(id, body.stageKey, body.note, g.user);
    return ok(app);
  } catch (err) {
    return handleApiError(err);
  }
}
