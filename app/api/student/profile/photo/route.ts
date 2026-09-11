import { NextRequest } from "next/server";
import { ok, handleApiError, fail } from "@/lib/api";
import { studentApiGuard } from "@/lib/student/guard";
import { studentProfileService } from "@/lib/services/student-profile";
import { createHash } from "node:crypto";
import { mkdir, writeFile, unlink, stat } from "node:fs/promises";
import { dirname, join } from "node:path";

export const dynamic = "force-dynamic";

/**
 * Allowed MIME types for profile photos. Anything else is rejected
 * before the file touches disk. We deliberately exclude HEIC because
 * browsers can't render it for preview.
 */
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

/** Maps a MIME type to a safe extension. Falls back to .bin for unknown. */
const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

/** Hard cap on photo size — 5 MiB. */
const MAX_SIZE = 5 * 1024 * 1024;

/** Public base path where photos are served from /public/uploads/profile-photos/. */
const UPLOAD_DIR = join(process.cwd(), "public", "uploads", "profile-photos");

/** Public URL prefix matching the upload dir. */
const UPLOAD_URL_PREFIX = "/uploads/profile-photos";

/**
 * POST /api/student/profile/photo (multipart/form-data with field `file`)
 *
 * Validates the uploaded file (MIME allow-list + size cap), writes it
 * to /public/uploads/profile-photos/<studentId>/...jpg, and atomically
 * commits the new URL to the student's `profilePhotoUrl` field.
 *
 * SECURITY
 *  - Identity is taken from the session, not the body.
 *  - The MIME type is checked against an allow-list, NOT inferred from
 *    the file extension. The extension on disk is derived from the
 *    MIME type, so a `.exe` re-named to `.jpg` cannot execute.
 *  - The on-disk filename is a sha-256 hash of the file contents + a
 *    timestamp, so two students uploading the same file get distinct
 *    paths and overwrite attempts don't collide.
 *  - The previous photo (if any) is removed from disk after the new
 *    one is committed, so we don't accumulate orphan files.
 */
export async function POST(req: NextRequest) {
  try {
    const g = await studentApiGuard();
    if (!g.ok) return g.error;

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

    // Read the bytes — small enough (≤5MB) to load into memory safely.
    const bytes = new Uint8Array(await file.arrayBuffer());
    const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
    const ext = EXT_BY_MIME[file.type] ?? ".bin";
    const studentDir = join(UPLOAD_DIR, g.student.id);
    const fileName = `${Date.now()}-${hash}${ext}`;
    const filePath = join(studentDir, fileName);

    // Ensure the per-student directory exists.
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, bytes);

    // Commit the URL to the student record.
    const fileUrl = `${UPLOAD_URL_PREFIX}/${g.student.id}/${fileName}`;
    const previous = g.student.profilePhotoUrl;
    const updated = await studentProfileService.setProfilePhoto(g.student, fileUrl, g.userId);

    // Best-effort cleanup of the previous photo. Don't fail the request
    // if cleanup can't remove the old file — the database is already
    // updated; orphan files are a janitorial problem, not a user-visible
    // failure.
    if (previous && previous.startsWith(UPLOAD_URL_PREFIX) && previous !== fileUrl) {
      const oldPath = join(process.cwd(), "public", previous.slice(1));
      try {
        await stat(oldPath);
        await unlink(oldPath);
      } catch {
        // best-effort
      }
    }

    return ok(studentProfileService.toView(updated), { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * DELETE /api/student/profile/photo
 *
 * Removes the caller's profile photo. Sets `profilePhotoUrl` to null
 * and deletes the file from disk. Returns the updated profile view.
 */
export async function DELETE() {
  try {
    const g = await studentApiGuard();
    if (!g.ok) return g.error;

    const previous = g.student.profilePhotoUrl;
    const updated = await studentProfileService.removeProfilePhoto(g.student, g.userId);

    if (previous && previous.startsWith(UPLOAD_URL_PREFIX)) {
      const oldPath = join(process.cwd(), "public", previous.slice(1));
      try {
        await stat(oldPath);
        await unlink(oldPath);
      } catch {
        // best-effort
      }
    }

    return ok(studentProfileService.toView(updated));
  } catch (err) {
    return handleApiError(err);
  }
}
