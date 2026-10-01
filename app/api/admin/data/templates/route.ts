import { NextRequest } from "next/server";
import { ok, handleApiError } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { generateTemplate } from "@/lib/services/data-import";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/data/templates?module=students
 *
 * Returns a JSON template for the specified module.
 * Used by the Data Management page for "Download Template" functionality.
 */
export async function GET(req: NextRequest) {
  try {
    const g = await guard();
    if (g.error) return g.error;

    const moduleName = req.nextUrl.searchParams.get("module") ?? "students";
    const template = generateTemplate(moduleName);
    return ok(template);
  } catch (err) {
    return handleApiError(err);
  }
}
