import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/api";
import { auditLog } from "./audit";
import { maskPassport } from "@/lib/utils/student-insights";
import { computeProfileCompletion, type ProfileCompletionResult } from "@/lib/utils/profile-completion";
import type { StudentProfilePatch } from "@/lib/validations";
import type { Student as PrismaStudent, AcademicRecord, EnglishProficiency } from "@prisma/client";

/**
 * Profile service for the Student Panel's Module 03 (My Profile).
 *
 * SECURITY INVARIANT
 * ------------------
 * Every public method takes an already-resolved student id (the
 * one derived from the session by `studentApiGuard`). The service
 * never trusts a `studentId` from the caller. Identity is fixed at the
 * route layer; this service only operates on the row the route says
 * the caller owns.
 *
 * The mask-on-read for passport fields is enforced here, not in the
 * route, so every consumer (route, server component, future cron) gets
 * the masked form by default. The unmasked value never leaves the
 * server surface area except when explicitly requested by an audited
 * admin path.
 */
export type StudentProfileRow = PrismaStudent & {
  academicRecords: AcademicRecord[];
  englishProficiencies: EnglishProficiency[];
};

/** The masked, client-safe shape returned by GET /api/student/profile. */
export type StudentProfileView = ReturnType<typeof buildProfileView>;

function buildProfileView(row: StudentProfileRow) {
  return {
    id: row.id,
    studentId: row.studentId,
    // Personal
    firstName: row.firstName,
    lastName: row.lastName,
    dateOfBirth: row.dateOfBirth,
    gender: row.gender,
    nationality: row.nationality,
    profilePhotoUrl: row.profilePhotoUrl,
    // Contact
    email: row.email,
    phone: row.phone,
    whatsapp: row.whatsapp,
    alternativePhone: row.alternativePhone,
    // Address
    country: row.country,
    division: row.division,
    district: row.district,
    city: row.city,
    address: row.address,
    postalCode: row.postalCode,
    // Passport — masked
    passportNumber: row.passportNumber,
    passportNumberMasked: maskPassport(row.passportNumber),
    passportIssueDate: row.passportIssueDate,
    passportExpiryDate: row.passportExpiryDate,
    passportIssuingCountry: row.passportIssuingCountry,
    // Emergency
    emergencyContactName: row.emergencyContactName,
    emergencyContactPhone: row.emergencyContactPhone,
    emergencyContactRelation: row.emergencyContactRelation,
    // Relational
    academicRecords: row.academicRecords,
    englishProficiencies: row.englishProficiencies,
    // Meta
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * The set of fields a student is allowed to self-edit. This is the
 * hard server-side allow-list — anything not here is silently dropped
 * by `sanitizePatchInput` even if the schema somehow let it through.
 *
 * Deliberately absent: studentId, userId, branchId, assignedEmployeeId,
 * status, role, financial fields, internal notes, application
 * ownership — those are admin-only operations.
 */
const ALLOWED_PATCH_KEYS = new Set<keyof StudentProfilePatch>([
  "firstName",
  "lastName",
  "dateOfBirth",
  "gender",
  "nationality",
  "phone",
  "whatsapp",
  "alternativePhone",
  "country",
  "division",
  "district",
  "city",
  "address",
  "postalCode",
  "passportNumber",
  "passportIssueDate",
  "passportExpiryDate",
  "passportIssuingCountry",
  "emergencyContactName",
  "emergencyContactPhone",
  "emergencyContactRelation",
]);

/** Strip any key not in the allow-list. Defense-in-depth on top of the Zod schema. */
function sanitizePatchInput(input: StudentProfilePatch): StudentProfilePatch {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (ALLOWED_PATCH_KEYS.has(k as keyof StudentProfilePatch)) out[k] = v;
  }
  return out as StudentProfilePatch;
}

/**
 * Contact changes that we treat as "sensitive" — they alter how we
 * reach the student, so the audit log records the old → new value.
 * The route uses this list to emit dedicated audit events.
 * NOTE: email is NOT here — email changes go through a verified
 * email-change flow, not the profile patch endpoint.
 */
const SENSITIVE_CONTACT_FIELDS: (keyof StudentProfilePatch)[] = [
  "phone",
  "whatsapp",
  "alternativePhone",
];

export const studentProfileService = {
  /** Load the student profile + related rows. Caller (route) already proved ownership. */
  async load(studentId: string): Promise<StudentProfileRow> {
    const row = await prisma.student.findFirst({
      where: { id: studentId, deletedAt: null },
      include: {
        academicRecords: { orderBy: { passingYear: "desc" } },
        englishProficiencies: { orderBy: { testDate: "desc" } },
      },
    });
    if (!row) throw new HttpError(404, "NOT_FOUND", "Student record not found");
    return row;
  },

  /** Build the masked, client-safe view + completion metadata. */
  toView(row: StudentProfileRow) {
    const view = buildProfileView(row);
    const completion: ProfileCompletionResult = computeProfileCompletion({
      ...row,
      academicRecords: row.academicRecords.map((r) => ({ id: r.id })),
      englishProficiencies: row.englishProficiencies.map((r) => ({ id: r.id })),
    });
    return { ...view, completion };
  },

  /**
   * Apply a student-self-service patch. The caller passes the resolved
   * student row (the one derived from the session); the service writes
   * only the allow-listed fields and emits dedicated audit events for
   * sensitive contact changes.
   */
  async patch(
    student: PrismaStudent,
    rawInput: StudentProfilePatch,
    actorId: string,
  ): Promise<StudentProfileRow> {
    const input = sanitizePatchInput(rawInput);

    // Capture pre-image for the audit trail. Only fields we allow.
    const oldValue: Record<string, unknown> = {};
    for (const k of Object.keys(input) as (keyof StudentProfilePatch)[]) {
      oldValue[k] = (student as unknown as Record<string, unknown>)[k];
    }

    const updated = await prisma.student.update({
      where: { id: student.id },
      data: input as Record<string, unknown>,
      include: {
        academicRecords: { orderBy: { passingYear: "desc" } },
        englishProficiencies: { orderBy: { testDate: "desc" } },
      },
    });

    await auditLog.record({
      userId: actorId,
      action: "student_profile.updated",
      entity: "Student",
      entityId: student.id,
      oldValue,
      newValue: input as Record<string, unknown>,
    });

    // Emit one audit event per sensitive contact field that actually
    // changed value — so reviewers can filter on `phone_changed` etc.
    for (const f of SENSITIVE_CONTACT_FIELDS) {
      const before = oldValue[f];
      const after = (input as Record<string, unknown>)[f];
      if (after !== undefined && before !== after) {
        await auditLog.record({
          userId: actorId,
          action: `student_profile.${String(f)}_changed`,
          entity: "Student",
          entityId: student.id,
          oldValue: { [f]: before },
          newValue: { [f]: after },
        });
      }
    }

    return updated;
  },

  /** Set the profile photo URL after the upload endpoint stored the file. */
  async setProfilePhoto(
    student: PrismaStudent,
    fileUrl: string,
    actorId: string,
  ): Promise<StudentProfileRow> {
    const oldValue = student.profilePhotoUrl;
    const updated = await prisma.student.update({
      where: { id: student.id },
      data: { profilePhotoUrl: fileUrl },
      include: {
        academicRecords: { orderBy: { passingYear: "desc" } },
        englishProficiencies: { orderBy: { testDate: "desc" } },
      },
    });
    await auditLog.record({
      userId: actorId,
      action: "student_profile.photo_changed",
      entity: "Student",
      entityId: student.id,
      oldValue: { profilePhotoUrl: oldValue },
      newValue: { profilePhotoUrl: fileUrl },
    });
    return updated;
  },

  /** Remove the profile photo (set to null). */
  async removeProfilePhoto(student: PrismaStudent, actorId: string): Promise<StudentProfileRow> {
    const oldValue = student.profilePhotoUrl;
    const updated = await prisma.student.update({
      where: { id: student.id },
      data: { profilePhotoUrl: null },
      include: {
        academicRecords: { orderBy: { passingYear: "desc" } },
        englishProficiencies: { orderBy: { testDate: "desc" } },
      },
    });
    await auditLog.record({
      userId: actorId,
      action: "student_profile.photo_removed",
      entity: "Student",
      entityId: student.id,
      oldValue: { profilePhotoUrl: oldValue },
      newValue: { profilePhotoUrl: null },
    });
    return updated;
  },

  // ── Academic records ─────────────────────────────────────────────

  async addAcademicRecord(
    studentId: string,
    input: {
      level: string;
      institution: string;
      group?: string;
      subject?: string;
      result?: string;
      passingYear?: number;
      certificateUrl?: string;
    },
    actorId: string,
  ): Promise<AcademicRecord> {
    const rec = await prisma.academicRecord.create({
      data: {
        studentId,
        level: input.level,
        institution: input.institution,
        group: input.group,
        subject: input.subject,
        result: input.result,
        passingYear: input.passingYear,
        certificateUrl: input.certificateUrl,
      },
    });
    await auditLog.record({
      userId: actorId,
      action: "academic_record.created",
      entity: "AcademicRecord",
      entityId: rec.id,
      newValue: { studentId, level: input.level, institution: input.institution },
    });
    return rec;
  },

  async updateAcademicRecord(
    studentId: string,
    recordId: string,
    input: Record<string, unknown>,
    actorId: string,
  ): Promise<AcademicRecord> {
    // Re-verify ownership before any write — the route resolved the
    // student from the session, but the recordId came from the URL.
    const existing = await prisma.academicRecord.findFirst({
      where: { id: recordId, studentId },
    });
    if (!existing) throw new HttpError(404, "NOT_FOUND", "Academic record not found");
    const updated = await prisma.academicRecord.update({
      where: { id: recordId },
      data: input,
    });
    await auditLog.record({
      userId: actorId,
      action: "academic_record.updated",
      entity: "AcademicRecord",
      entityId: recordId,
      oldValue: existing,
      newValue: input,
    });
    return updated;
  },

  async deleteAcademicRecord(studentId: string, recordId: string, actorId: string): Promise<void> {
    const existing = await prisma.academicRecord.findFirst({
      where: { id: recordId, studentId },
    });
    if (!existing) throw new HttpError(404, "NOT_FOUND", "Academic record not found");
    await prisma.academicRecord.delete({ where: { id: recordId } });
    await auditLog.record({
      userId: actorId,
      action: "academic_record.deleted",
      entity: "AcademicRecord",
      entityId: recordId,
      oldValue: existing,
    });
  },

  // ── English proficiency ──────────────────────────────────────────

  async addEnglishProficiency(
    studentId: string,
    input: {
      testType: string;
      overallScore?: number;
      readingScore?: number;
      writingScore?: number;
      listeningScore?: number;
      speakingScore?: number;
      testDate?: Date | null;
      expiryDate?: Date | null;
      certificateUrl?: string;
    },
    actorId: string,
  ): Promise<EnglishProficiency> {
    const rec = await prisma.englishProficiency.create({
      data: {
        studentId,
        testType: input.testType,
        overallScore: input.overallScore,
        readingScore: input.readingScore,
        writingScore: input.writingScore,
        listeningScore: input.listeningScore,
        speakingScore: input.speakingScore,
        testDate: input.testDate ?? undefined,
        expiryDate: input.expiryDate ?? undefined,
        certificateUrl: input.certificateUrl,
      },
    });
    await auditLog.record({
      userId: actorId,
      action: "english_proficiency.created",
      entity: "EnglishProficiency",
      entityId: rec.id,
      newValue: { studentId, testType: input.testType },
    });
    return rec;
  },

  async updateEnglishProficiency(
    studentId: string,
    recordId: string,
    input: Record<string, unknown>,
    actorId: string,
  ): Promise<EnglishProficiency> {
    const existing = await prisma.englishProficiency.findFirst({
      where: { id: recordId, studentId },
    });
    if (!existing) throw new HttpError(404, "NOT_FOUND", "English proficiency record not found");
    const updated = await prisma.englishProficiency.update({
      where: { id: recordId },
      data: input,
    });
    await auditLog.record({
      userId: actorId,
      action: "english_proficiency.updated",
      entity: "EnglishProficiency",
      entityId: recordId,
      oldValue: existing,
      newValue: input,
    });
    return updated;
  },

  async deleteEnglishProficiency(studentId: string, recordId: string, actorId: string): Promise<void> {
    const existing = await prisma.englishProficiency.findFirst({
      where: { id: recordId, studentId },
    });
    if (!existing) throw new HttpError(404, "NOT_FOUND", "English proficiency record not found");
    await prisma.englishProficiency.delete({ where: { id: recordId } });
    await auditLog.record({
      userId: actorId,
      action: "english_proficiency.deleted",
      entity: "EnglishProficiency",
      entityId: recordId,
      oldValue: existing,
    });
  },
};
