import { NextRequest } from "next/server";
import { ok, handleApiError, HttpError } from "@/lib/api";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { changePassword } from "@/lib/services/profile-cases";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
  const role = (session.user as { role?: string }).role;
  if (role !== "EMPLOYEE" && role !== "ADMIN") throw new HttpError(403, "FORBIDDEN", "Employees only");
  return session.user.id;
}

const schema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "Password must be ≥ 8 characters").max(200),
});

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUser();
    const { currentPassword, newPassword } = schema.parse(await req.json());
    const result = await changePassword(userId, currentPassword, newPassword, {
      id: userId,
      ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
      userAgent: req.headers.get("user-agent") ?? undefined,
    });
    return ok(result);
  } catch (err) {
    return handleApiError(err);
  }
}
