import { NextRequest } from "next/server";
import { ok, handleApiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { z } from "zod";

const contactSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().max(160),
  phone: z.string().max(40).optional().or(z.literal("")),
  destination: z.string().max(40).optional().or(z.literal("")),
  studyLevel: z.enum(["BACHELOR", "MASTER", "PHD", "DIPLOMA", "OTHER"]).optional().or(z.literal("")),
  course: z.string().max(200).optional().or(z.literal("")),
  message: z.string().max(2000).optional().or(z.literal("")),
});

export async function POST(req: NextRequest) {
  try {
    const body = contactSchema.parse(await req.json());

    // Persist as a Lead so employees can follow up — this mirrors the
    // existing business workflow. Mark the source so the lead dashboard
    // can distinguish marketing inbound from manual entries.
    await prisma.lead.create({
      data: {
        name: body.name,
        email: body.email.toLowerCase(),
        phone: body.phone || null,
        interestedCountry: body.destination || null,
        source: "WEBSITE",
        status: "NEW",
        notes: [
          body.studyLevel && `Study level: ${body.studyLevel}`,
          body.course && `Intended course: ${body.course}`,
          body.message && `Message: ${body.message}`,
        ]
          .filter(Boolean)
          .join("\n"),
      },
    });

    return ok({ received: true });
  } catch (err) {
    return handleApiError(err);
  }
}
