import { NextRequest } from "next/server";
import { ok, handleApiError, fail } from "@/lib/api";
import { studentApiGuard } from "@/lib/student/guard";
import { studentProfileService } from "@/lib/services/student-profile";
import { auditLog } from "@/lib/services/audit";
import { createHash } from "node:crypto";
import { mkdir, writeFile, unlink, stat } from "node:fs/promises";
import { dirname, join } from "node:path";

export const dynamic = "force-dynamic";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};
const MAX_SIZE = 5 * 1024 * 1024;

/**
 * Profile photos are stored under /public/uploads/profile-photos/
 * so the browser can access them directly via <img src="/uploads/...">
 * — NO serving endpoint needed.
 *
 * Previously photos were stored with a `private:` prefix in private
 * storage, but there was no endpoint to serve them back to the browser.
 * Profile photos are avatars (publicly visible in the UI), not sensitive
 * documents, so public storage is the correct approach.
 */
const UPLOAD_BASE_DIR = join(process.cwd(), "public", "uploads", "profile-photos");
const UPLOAD_BASE_URL = "/uploads/profile-photos";

/** POST /api/student/profile/photo — upload self photo (student) */
export async function POST(req: NextRequest) {
  try {
    const g = await studentApiGuard();
    if (!g.ok) return g.error;
    return await handlePhotoUpload(g.student.id, g.userId, req, "student_profile.photo_changed");
  } catch (err) {
    return handleApiError(err);
  }
}

/** DELETE /api/student/profile/photo — remove self photo (student) */
export async function DELETE() {
  try {
    const g = await studentApiGuard();
    if (!g.ok) return g.error;

    const previous = g.student.profilePhotoUrl;
    const updated = await studentProfileService.removeProfilePhoto(g.student, g.userId);
    cleanupOldPhoto(previous);
    return ok(studentProfileService.toView(updated));
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * Shared photo upload handler — used by both the student self-service
 * route and the admin upload route.
 */
export async function handlePhotoUpload(
  studentId: string,
  userId: string,
  req: NextRequest,
  auditAction: string,
) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return fail("VALIDATION_ERROR", "Photo file is required", 422, {
      fields: { file: "A file is required" },
    });
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return fail("VALIDATION_ERROR", "Unsupported file type. Use JPG, PNG, or WEBP.", 422, {
      fields: { file: `Unsupported type: ${file.type || "unknown"}` },
    });
  }
  if (file.size > MAX_SIZE) {
    return fail("VALIDATION_ERROR", "Photo is too large (max 5MB)", 422, {
      fields: { file: `File is ${file.size} bytes; max is ${MAX_SIZE}` },
    });
  }
  if (file.size === 0) {
    return fail("VALIDATION_ERROR", "Photo file is empty", 422, {
      fields: { file: "File is empty" },
    });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
  const ext = EXT_BY_MIME[file.type] ?? ".bin";
  const studentDir = join(UPLOAD_BASE_DIR, studentId);
  const fileName = `${Date.now()}-${hash}${ext}`;
  const filePath = join(studentDir, fileName);

  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, bytes);

  // Store the PUBLIC URL — browser can access this directly
  const fileUrl = `${UPLOAD_BASE_URL}/${studentId}/${fileName}`;

  // Get the student + update profile photo
  const student = await studentProfileService.load(studentId);
  const previous = student.profilePhotoUrl;
  const updated = await studentProfileService.setProfilePhoto(student, fileUrl, userId);

  // Cleanup old photo
  cleanupOldPhoto(previous);

  // Audit log
  const { ipAddress, userAgent } = auditLog.fromRequest(req);
  await auditLog.record({
    userId,
    action: auditAction,
    entity: "Student",
    entityId: studentId,
    oldValue: { profilePhotoUrl: previous },
    newValue: { profilePhotoUrl: fileUrl },
    ipAddress,
    userAgent,
  });

  return ok(studentProfileService.toView(updated), { status: 201 });
}

/** Best-effort cleanup of old profile photo from public dir. */
function cleanupOldPhoto(previousUrl: string | null | undefined) {
  if (!previousUrl || !previousUrl.startsWith(UPLOAD_BASE_URL)) return;
  const relPath = previousUrl.slice(UPLOAD_BASE_URL.length);
  const oldPath = join(UPLOAD_BASE_DIR, relPath);
  if (!oldPath.startsWith(UPLOAD_BASE_DIR)) return; // path containment
  stat(oldPath).then(() => unlink(oldPath).catch(() => {})).catch(() => {});
}
