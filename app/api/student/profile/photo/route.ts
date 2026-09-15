import { NextRequest } from "next/server";
import { ok, handleApiError, fail } from "@/lib/api";
import { studentApiGuard } from "@/lib/student/guard";
import { studentProfileService } from "@/lib/services/student-profile";
import { auditLog } from "@/lib/services/audit";
import { fileStorage } from "@/lib/services/file-storage";
import { createHash } from "node:crypto";

export const dynamic = "force-dynamic";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};
const MAX_SIZE = 5 * 1024 * 1024;

/**
 * Profile photos are persisted in MongoDB (StoredFile) and served via
 * /api/files/<id>. Serverless hosts have a read-only filesystem, so
 * the previous write-to-/public approach failed on Vercel. The stored
 * URL is session-gated but cacheable — each upload gets a fresh id,
 * so caching can never show a stale photo.
 */
const PHOTO_URL_PREFIX = "/api/files/";

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
  const fileName = `${Date.now()}-${hash}${ext}`;

  const storedFileId = await fileStorage.put({
    kind: "profile-photo",
    ownerId: studentId,
    bytes,
    fileName,
    origName: file.name || fileName,
    mimeType: file.type,
  });

  // Session-gated URL served by /api/files/[id]
  const fileUrl = `${PHOTO_URL_PREFIX}${storedFileId}`;

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

/** Best-effort cleanup of the previous photo's stored file. */
function cleanupOldPhoto(previousUrl: string | null | undefined) {
  if (!previousUrl || !previousUrl.startsWith(PHOTO_URL_PREFIX)) return;
  const id = previousUrl.slice(PHOTO_URL_PREFIX.length);
  if (!/^[a-f0-9]{24}$/i.test(id)) return;
  fileStorage.remove(id);
}
