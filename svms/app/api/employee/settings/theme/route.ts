import { NextRequest } from "next/server";
import { ok, handleApiError, HttpError } from "@/lib/api";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { updateTheme, THEMES } from "@/lib/services/settings-cases";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
  const role = (session.user as { role?: string }).role;
  if (role !== "EMPLOYEE" && role !== "ADMIN") throw new HttpError(403, "FORBIDDEN", "Employees only");
  return session.user.id;
}

const schema = z.object({
  theme: z.enum(THEMES),
});

export async function PATCH(req: NextRequest) {
  try {
    const userId = await requireUser();
    const { theme } = schema.parse(await req.json());
    const settings = await updateTheme(userId, theme, {
      id: userId,
      ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
      userAgent: req.headers.get("user-agent") ?? undefined,
    });
    return ok(settings);
  } catch (err) {
    return handleApiError(err);
  }
}
