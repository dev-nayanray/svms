import { NextRequest } from "next/server";
import { ok, handleApiError, HttpError } from "@/lib/api";
import { auth } from "@/lib/auth";
import { getSettings } from "@/lib/services/settings-cases";

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
    const settings = await getSettings(userId);
    return ok(settings);
  } catch (err) {
    return handleApiError(err);
  }
}
