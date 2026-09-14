import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/api";
import bcrypt from "bcryptjs";
import { auditLog } from "./audit";
import type { StudentSettingsPatch } from "@/lib/validations";

/**
 * Student-scoped Settings service for Module 17.
 *
 * SECURITY INVARIANT
 * ------------------
 * Every public method takes a `studentId` resolved from the session.
 * The service NEVER trusts a studentId from the client body.
 * Password change verifies the current password before updating.
 */

export type StudentPreferences = {
  id: string;
  notifApplication: boolean;
  notifDocuments: boolean;
  notifVisa: boolean;
  notifPayments: boolean;
  notifTasks: boolean;
  notifMessages: boolean;
  notifAppointments: boolean;
  theme: string;
  language: string;
  updatedAt: Date;
};

export type SettingsAccountView = {
  email: string;
  phone: string | null;
  whatsapp: string | null;
  alternativePhone: string | null;
  firstName: string;
  lastName: string;
};

function buildPrefView(row: {
  id: string;
  notifApplication: boolean;
  notifDocuments: boolean;
  notifVisa: boolean;
  notifPayments: boolean;
  notifTasks: boolean;
  notifMessages: boolean;
  notifAppointments: boolean;
  theme: string;
  language: string;
  updatedAt: Date;
}): StudentPreferences {
  return {
    id: row.id,
    notifApplication: row.notifApplication,
    notifDocuments: row.notifDocuments,
    notifVisa: row.notifVisa,
    notifPayments: row.notifPayments,
    notifTasks: row.notifTasks,
    notifMessages: row.notifMessages,
    notifAppointments: row.notifAppointments,
    theme: row.theme,
    language: row.language,
    updatedAt: row.updatedAt,
  };
}

export const studentSettingsService = {
  /**
   * Get the caller's preferences. Creates default preferences if
   * none exist yet (lazy initialization).
   */
  async getPreferences(studentId: string): Promise<StudentPreferences> {
    let row = await prisma.studentPreference.findUnique({
      where: { studentId },
    });

    if (!row) {
      row = await prisma.studentPreference.create({
        data: { studentId },
      });
    }

    return buildPrefView(row);
  },

  /**
   * Update the caller's preferences (notifications, theme, language).
   * Only the fields in the patch are updated. Ownership is implicit:
   * the query is scoped by studentId from the session.
   *
   * The input is typed as `StudentSettingsPatch` (from the Zod schema)
   * so TypeScript enforces that only schema-allowed fields are passed.
   */
  async updatePreferences(
    studentId: string,
    input: StudentSettingsPatch,
    actorId: string,
  ): Promise<StudentPreferences> {
    // Ensure the preferences row exists
    await this.getPreferences(studentId);

    const updated = await prisma.studentPreference.update({
      where: { studentId },
      data: input,
    });

    await auditLog.record({
      userId: actorId,
      action: "student_settings.updated",
      entity: "StudentPreference",
      entityId: updated.id,
      newValue: input,
    });

    return buildPrefView(updated);
  },

  /**
   * Get the caller's account info (email, phone, name).
   * Never exposes passwordHash, role, permissions, branchId, etc.
   */
  async getAccount(studentId: string): Promise<SettingsAccountView> {
    const student = await prisma.student.findFirst({
      where: { id: studentId, deletedAt: null },
      select: {
        email: true,
        phone: true,
        whatsapp: true,
        alternativePhone: true,
        firstName: true,
        lastName: true,
      },
    });
    if (!student) throw new HttpError(404, "NOT_FOUND", "Student not found");
    return student;
  },

  /**
   * Change the caller's password. Verifies the current password
   * against the stored hash before updating. The new password is
   * hashed with bcrypt (10 rounds).
   *
   * `ipAddress` / `userAgent` are captured from the request and
   * stored on the audit log row for security traceability.
   *
   * Throws 422 VALIDATION_ERROR (with field=currentPassword) when
   * the current password is wrong — this is a form-field validation
   * error, NOT an authorization failure. Using 403 here would be
   * misleading because it would suggest the user is not allowed to
   * change their password, when in fact they just typed the wrong
   * current password.
   */
  async changePassword(
    studentId: string,
    currentPassword: string,
    newPassword: string,
    actorId: string,
    ctx?: { ipAddress?: string | null; userAgent?: string | null },
  ): Promise<void> {
    const student = await prisma.student.findFirst({
      where: { id: studentId, deletedAt: null },
      include: { user: true },
    });
    if (!student) throw new HttpError(404, "NOT_FOUND", "Student not found");

    const user = student.user;
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      // 422 + field=currentPassword so the client can surface the
      // error on the right input. Not 403 (not an authorization
      // failure) and not 401 (user IS authenticated, just mistyped).
      throw new HttpError(422, "VALIDATION_ERROR", "Current password is incorrect");
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    await auditLog.record({
      userId: actorId,
      action: "student.password_changed",
      entity: "User",
      entityId: user.id,
      ipAddress: ctx?.ipAddress ?? undefined,
      userAgent: ctx?.userAgent ?? undefined,
    });
  },
};
