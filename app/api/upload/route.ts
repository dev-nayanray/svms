import { NextRequest } from "next/server";
import { ok, handleApiError, fail } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { createHash } from "node:crypto";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

const ALLOWED_MIME = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB for logos

const EXT_BY_MIME: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/svg+xml": ".svg",
  "image/webp": ".webp",
};

/**
 * POST /api/upload
 *
 * General file upload for admin branding assets (logos, etc.).
 * Saves to /public/uploads/brand/ and returns the public URL.
 *
 * Form data:
 *  - file (required, File) — the image file
 *  - folder (optional, string) — subfolder under /public/uploads/
 *
 * Returns { url: string, fileName: string }
 *
 * Restrictions:
 *  - Admin/employee only (guard)
 *  - Rate limited (upload preset)
 *  - MIME type allow-list (PNG, JPEG, SVG, WebP only)
 *  - Max 5MB
 */
export async function POST(req: NextRequest) {
  try {
    const limited = rateLimit(req, RATE_LIMIT_PRESETS.upload, "upload");
    if (limited) return limited as Response;

    const g = await guard();
    if (g.error) return g.error;

    const form = await req.formData();
    const file = form.get("file");
    const folder = (form.get("folder") as string)?.trim() || "misc";

    if (!(file instanceof File)) {
      return fail("VALIDATION_ERROR", "A file is required", 422, {
        fields: { file: "A file is required" },
      });
    }

    if (!ALLOWED_MIME.includes(file.type)) {
      return fail(
        "VALIDATION_ERROR",
        `Unsupported file type: ${file.type}. Accepted: PNG, JPEG, SVG, WebP.`,
        422,
      );
    }

    if (file.size > MAX_SIZE) {
      return fail(
        "VALIDATION_ERROR",
        `File exceeds the 5MB limit (${(file.size / 1024 / 1024).toFixed(1)} MB).`,
        422,
      );
    }

    // Sanitize folder — only allow alphanumeric + dash
    const safeFolder = folder.replace(/[^a-zA-Z0-9-]/g, "");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
    const ext = EXT_BY_MIME[file.type] ?? ".bin";
    const fileName = `${Date.now()}-${hash}${ext}`;
    const uploadDir = join(process.cwd(), "public", "uploads", safeFolder);
    const filePath = join(uploadDir, fileName);

    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, bytes);

    const publicUrl = `/uploads/${safeFolder}/${fileName}`;

    return ok({ url: publicUrl, fileName }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
