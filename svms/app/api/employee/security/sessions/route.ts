import { NextRequest } from "next/server";
import { ok, handleApiError, HttpError } from "@/lib/api";
import { auth } from "@/lib/auth";
import { listSessions, revokeAllSessions } from "@/lib/services/profile-cases";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
  const role = (session.user as { role?: string }).role;
  if (role !== "EMPLOYEE" && role !== "ADMIN") throw new HttpError(403, "FORBIDDEN", "Employees only");
  return session.user.id;
}

export async function GET() {
  try {
    const userId = await requireUser();
    const result = await listSessions(userId);
    return ok(result);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const userId = await requireUser();
    const result = await revokeAllSessions(userId, {
      id: userId,
      ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
      userAgent: req.headers.get("user-agent") ?? undefined,
    });
    return ok(result);
  } catch (err) {
    return handleApiError(err);
  }
}
