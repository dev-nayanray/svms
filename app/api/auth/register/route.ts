import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { ok, handleApiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { registerSchema } from "@/lib/validations/auth";
import { auditLog } from "@/lib/services/audit";

export async function POST(req: NextRequest) {
  try {
    const body = registerSchema.parse(await req.json());
    const email = body.email.toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return ok({ alreadyRegistered: true });
    }

    const passwordHash = await bcrypt.hash(body.password, 10);
    const [firstName, ...rest] = body.name.split(" ");

    const user = await prisma.user.create({
      data: {
        name: body.name,
        email,
        phone: body.phone,
        passwordHash,
        roleName: "STUDENT",
        status: "ACTIVE",
      },
    });
    await prisma.student.create({
      data: {
        userId: user.id,
        studentId: `STD-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`,
        firstName: firstName || body.name,
        lastName: rest.join(" ") || "-",
        email,
        phone: body.phone,
      },
    });

    await auditLog.record({
      userId: user.id,
      action: "user.registered",
      entity: "User",
      entityId: user.id,
    });
    return ok({ id: user.id }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
