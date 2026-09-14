import { NextRequest } from "next/server";
import { ok, handleApiError, HttpError } from "@/lib/api";
import { auth } from "@/lib/auth";
import { z } from "zod";
import {
  getProfile,
  updateOwnProfile,
  MAX_NAME, MAX_PHONE, MAX_AVATAR_URL, MAX_TITLE, MAX_BRANCH, MAX_DESIGNATION, MAX_ADDRESS,
} from "@/lib/services/profile-cases";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
  const role = (session.user as { role?: string }).role;
  if (role !== "EMPLOYEE" && role !== "ADMIN") throw new HttpError(403, "FORBIDDEN", "Employees only");
  return { userId: session.user.id, role };
}

const updateSchema = z.object({
  name: z.string().min(1).max(MAX_NAME).optional(),
  phone: z.string().max(MAX_PHONE).nullable().optional(),
  avatar: z.string().max(MAX_AVATAR_URL).nullable().optional(),
  title: z.string().max(MAX_TITLE).nullable().optional(),
  branch: z.string().max(MAX_BRANCH).nullable().optional(),
  designation: z.string().max(MAX_DESIGNATION).nullable().optional(),
  address: z.string().max(MAX_ADDRESS).nullable().optional(),
});

export async function GET() {
  try {
    const { userId } = await requireUser();
    const profile = await getProfile(userId);
    return ok(profile);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { userId } = await requireUser();
    const body = updateSchema.parse(await req.json());
    const profile = await updateOwnProfile(userId, body, {
      id: userId,
      ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
      userAgent: req.headers.get("user-agent") ?? undefined,
    });
    return ok(profile);
  } catch (err) {
    return handleApiError(err);
  }
}
