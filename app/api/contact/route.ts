import { NextRequest } from "next/server";
import { ok, handleApiError, fail } from "@/lib/api";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/services/audit";

export const dynamic = "force-dynamic";

const contactSchema = z.object({
  name: z.string().min(2, "Please enter your full name").max(80),
  email: z.string().email("Please enter a valid email").max(120).toLowerCase(),
  phone: z.string().max(40).optional().or(z.literal("")),
  destination: z.string().max(60).optional().or(z.literal("")),
  studyLevel: z.enum(["BACHELOR", "MASTER", "PHD", "OTHER"]).optional(),
  course: z.string().max(120).optional().or(z.literal("")),
  message: z.string().min(10, "Please tell us a bit about your plans").max(2000),
});

/**
 * POST /api/contact — public contact / consultation request form.
 *
 * Validates the body with Zod, stores the submission as a Lead (so it
 * can be picked up by the admin/employee panel), and audit-logs the
 * submission. The contact form is the primary CRO conversion path on
 * the marketing site.
 *
 * This is a PUBLIC endpoint — no authentication required. Rate limiting
 * would be applied here in a production setup (the in-memory limiter
 * in lib/security/rate-limit.ts can be wired in if abuse becomes an issue).
 */
export async function POST(req: NextRequest) {
  try {
    const parsed = contactSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return fail("VALIDATION_ERROR", "Please check your inputs", 422, {
        fields: Object.fromEntries(
          parsed.error.issues.map((i) => [i.path.join(".") || "_", i.message]),
        ),
      });
    }
    const { name, email, phone, destination, studyLevel, course, message } = parsed.data;

    // Store as a Lead so admin/employee panels can pick it up.
    // Lead.source = "WEBSITE" so counselors know the origin.
    const lead = await prisma.lead.create({
      data: {
        name,
        email,
        phone: phone || null,
        source: "WEBSITE",
        status: "NEW",
        notes: [
          destination && `Destination: ${destination}`,
          studyLevel && `Level: ${studyLevel}`,
          course && `Course: ${course}`,
          `Message: ${message}`,
        ].filter(Boolean).join("\n"),
      },
    });

    const { ipAddress, userAgent } = auditLog.fromRequest(req);
    await auditLog.record({
      action: "contact.submitted",
      entity: "Lead",
      entityId: lead.id,
      newValue: { name, email, destination, studyLevel, course, messageLength: message.length },
      ipAddress,
      userAgent,
    });

    return ok({ id: lead.id, received: true }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
