import { ok, handleApiError } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/permissions";

export async function GET() {
  try {
    const g = await guard("roles.read");
    if (g.error) return g.error;
    return ok({ data: Object.keys(PERMISSIONS) });
  } catch (err) {
    return handleApiError(err);
  }
}
