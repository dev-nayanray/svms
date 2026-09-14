import { NextRequest } from "next/server";
import { ok, handleApiError } from "@/lib/api";
import { studentApiGuard } from "@/lib/student/guard";
import { studentSupportService } from "@/lib/services/student-support";
import { supportRequestSchema } from "@/lib/validations";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

/**
 * GET /api/student/support?status=<status>
 *
 * Returns the caller's support requests. Optional `?status=` filter
 * (OPEN, IN_PROGRESS, RESOLVED, CLOSED). Scoped by `studentId`.
 */
export async function GET(req: NextRequest) {
  try {
    const g = await studentApiGuard();
    if (!g.ok) return g.error;

    const sp = req.nextUrl.searchParams;
    const status = sp.get("status") ?? undefined;
    const requests = await studentSupportService.list(g.student.id, status ?? undefined);
    return ok({ requests });
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * POST /api/student/support
 *
 * Submit a new support request. Body validated by
 * `supportRequestSchema` (subject 3-200 chars, category enum,
 * description 10-5000 chars, optional attachmentUrl + attachmentName).
 *
 * The `studentId` is resolved from the session — never from the body.
 * The request starts with status OPEN and priority MEDIUM.
 */
export async function POST(req: NextRequest) {
  try {
    // Rate-limit support-ticket creation to prevent ticket spam —
    // 5 bursts per IP, +1 token / min.
    const limited = rateLimit(req, RATE_LIMIT_PRESETS.supportTicket, "support");
    if (limited) return limited as Response;

    const g = await studentApiGuard();
    if (!g.ok) return g.error;

    const input = supportRequestSchema.parse(await req.json());
    const request = await studentSupportService.create(
      g.student.id,
      input,
      g.userId,
    );
    return ok({ request }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
