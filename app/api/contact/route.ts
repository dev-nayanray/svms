import { NextRequest } from "next/server";
import { ok, handleApiError, fail } from "@/lib/api";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/services/audit";
import { sendNewLeadNotificationEmail } from "@/lib/services/email";

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
 * 1. Validates the body with Zod.
 * 2. Stores the submission as a Lead (source: WEBSITE, status: NEW).
 * 3. Creates in-app Notifications for all ADMIN + EMPLOYEE users.
 * 4. Sends an email notification to admins/employees (if SMTP configured).
 * 5. Audit-logs the submission.
 *
 * This is a PUBLIC endpoint — no authentication required.
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

    // Create in-app notifications for all admin + employee users
    const staff = await prisma.user.findMany({
      where: {
        roleName: { in: ["ADMIN", "EMPLOYEE"] },
        status: "ACTIVE",
        deletedAt: null,
      },
      select: { id: true },
    });

    if (staff.length > 0) {
      await prisma.notification.createMany({
        data: staff.map((s) => ({
          userId: s.id,
          type: "NEW_LEAD",
          title: `New lead: ${name}`,
          message: `${name} (${email}) submitted a consultation request from the website.${phone ? ` Phone: ${phone}` : ""}`,
          link: "/admin/leads",
        })),
      });
    }

    // Send email notification to staff (best-effort — won't fail the request)
    void sendNewLeadNotificationEmail({
      name,
      email,
      phone: phone || null,
      source: "WEBSITE",
    });

    const { ipAddress, userAgent } = auditLog.fromRequest(req);
    await auditLog.record({
      action: "contact.submitted",
      entity: "Lead",
      entityId: lead.id,
      newValue: { name, email, destination, studyLevel, course, messageLength: message.length, notificationsSent: staff.length },
      ipAddress,
      userAgent,
    });

    return ok({ id: lead.id, received: true }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
