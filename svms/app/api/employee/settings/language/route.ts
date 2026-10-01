import { NextRequest } from "next/server";
import { ok, handleApiError, HttpError } from "@/lib/api";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { updateLanguage } from "@/lib/services/settings-cases";
import { SUPPORTED_LANGUAGES } from "@/lib/i18n";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
  const role = (session.user as { role?: string }).role;
  if (role !== "EMPLOYEE" && role !== "ADMIN") throw new HttpError(403, "FORBIDDEN", "Employees only");
  return session.user.id;
}

const schema = z.object({
  language: z.enum(SUPPORTED_LANGUAGES),
});

export async function PATCH(req: NextRequest) {
  try {
    const userId = await requireUser();
    const { language } = schema.parse(await req.json());
    const settings = await updateLanguage(userId, language, {
      id: userId,
      ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
      userAgent: req.headers.get("user-agent") ?? undefined,
    });
    return ok(settings);
  } catch (err) {
    return handleApiError(err);
  }
}
