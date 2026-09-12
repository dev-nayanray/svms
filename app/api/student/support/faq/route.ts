import { NextRequest } from "next/server";
import { ok, handleApiError } from "@/lib/api";
import { studentApiGuard } from "@/lib/student/guard";
import { studentSupportService } from "@/lib/services/student-support";

export const dynamic = "force-dynamic";

/**
 * GET /api/student/support/faq?search=<search>&category=<category>
 *
 * Returns static FAQ items. Optional search (case-insensitive across
 * question + answer) and category filter. No authentication needed
 * for the FAQ content itself, but we still verify the student session
 * so only authenticated students can access the support center.
 */
export async function GET(req: NextRequest) {
  try {
    const g = await studentApiGuard();
    if (!g.ok) return g.error;

    const sp = req.nextUrl.searchParams;
    const search = sp.get("search") ?? undefined;
    const category = sp.get("category") ?? undefined;

    const faq = studentSupportService.getFAQ(search ?? undefined, category ?? undefined);
    return ok({ faq });
  } catch (err) {
    return handleApiError(err);
  }
}
