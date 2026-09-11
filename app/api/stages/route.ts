import { ok, handleApiError } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";

/** The live application pipeline (ApplicationStage table — dynamic, admin-editable). */
export async function GET() {
  try {
    const g = await guard("applications.read");
    if (g.error) return g.error;
    const stages = await prisma.applicationStage.findMany({
      where: { enabled: true },
      orderBy: { sortOrder: "asc" },
    });
    return ok({ data: stages });
  } catch (err) {
    return handleApiError(err);
  }
}
