import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/api";
import type { AuthUser } from "@/lib/auth/guards";
import { auditLog } from "./audit";
import { notifications } from "./notification";
import {
  canTransition,
  isDecisionStatus,
  isSubmissionStatus,
  isBiometricsStatus,
  isInterviewStatus,
  type VisaStatus,
} from "@/lib/constants/visa";

export const visaService = {
  /**
   * Change the stage of a visa application. Enforces the transition
   * rules from `lib/constants/visa.ts`, writes an
   * `ApplicationStatusHistory` entry (so the visa timeline is the same
   * as the application timeline), syncs the linked application's
   * `stageKey`, notifies the student, and audit-logs the change.
   *
   * Date fields (submittedAt, biometricsAt, interviewAt, decisionAt)
   * are set automatically based on the target stage — only when they're
   * not already set, so a visa that goes back to BIOMETRICS after an
   * interview doesn't overwrite the original biometrics date.
   */
  async changeStage(
    id: string,
    targetStage: VisaStatus,
    note: string | undefined,
    actor: AuthUser,
  ) {
    const visa = await prisma.visaApplication.findFirst({
      where: { id, deletedAt: null },
      include: { application: { include: { student: true } } },
    });
    if (!visa) throw new HttpError(404, "NOT_FOUND", "Visa application not found");

    if (!canTransition(visa.stage, targetStage)) {
      throw new HttpError(
        409,
        "CONFLICT",
        `Cannot transition from ${visa.stage} to ${targetStage}. Terminal statuses (APPROVED, REFUSED, WITHDRAWN, COMPLETED) cannot transition out.`,
      );
    }

    // Compute the date-field updates based on the target stage. Only set
    // a date if it's not already populated — this preserves the original
    // "first time we hit this stage" timestamp when a visa moves back
    // and forth in the flow.
    const data: Record<string, unknown> = { stage: targetStage };
    if (isSubmissionStatus(targetStage) && !visa.submittedAt) {
      data.submittedAt = new Date();
    }
    if (isBiometricsStatus(targetStage) && !visa.biometricsAt) {
      data.biometricsAt = new Date();
    }
    if (isInterviewStatus(targetStage) && !visa.interviewAt) {
      data.interviewAt = new Date();
    }
    if (isDecisionStatus(targetStage) && !visa.decisionAt) {
      data.decisionAt = new Date();
    }
    if (note !== undefined) {
      data.notes = note;
    }

    const updated = await prisma.visaApplication.update({
      where: { id },
      data,
    });

    // Write an ApplicationStatusHistory entry so the visa timeline is
    // queryable via the same history table as the application timeline.
    await prisma.applicationStatusHistory.create({
      data: {
        applicationId: visa.applicationId,
        fromStage: visa.stage,
        toStage: targetStage,
        changedById: actor.id,
        note: note ?? `Visa stage: ${visa.stage} → ${targetStage}`,
      },
    });

    // Keep the linked application's stageKey in sync so the dashboard
    // and application list reflect the visa progress.
    await prisma.application.update({
      where: { id: visa.applicationId },
      data: { stageKey: targetStage },
    });

    // Notify the student about the stage change.
    if (visa.application.student) {
      await notifications.push({
        userId: visa.application.student.userId,
        type: "VISA_STAGE_CHANGED",
        title: "Visa status updated",
        message: `Your visa application is now in ${targetStage} stage. ${
          note ? `Note: ${note}` : ""
        }`,
        link: `/student/applications/${visa.applicationId}`,
      });
    }

    await auditLog.record({
      userId: actor.id,
      action: "visa_application.stage_changed",
      entity: "VisaApplication",
      entityId: id,
      oldValue: { stage: visa.stage },
      newValue: { stage: targetStage, note },
    });

    return updated;
  },

  /**
   * Update editable fields on a visa application (visaType, dates, notes).
   * Stage changes go through `changeStage` so they can be audit-logged
   * distinctly from field edits.
   */
  async update(
    id: string,
    input: {
      visaType?: string;
      submittedAt?: Date | null;
      biometricsAt?: Date | null;
      interviewAt?: Date | null;
      decisionAt?: Date | null;
      notes?: string;
    },
    actor: AuthUser,
  ) {
    const visa = await prisma.visaApplication.findFirst({
      where: { id, deletedAt: null },
    });
    if (!visa) throw new HttpError(404, "NOT_FOUND", "Visa application not found");

    const updated = await prisma.visaApplication.update({
      where: { id },
      data: input,
    });

    await auditLog.record({
      userId: actor.id,
      action: "visa_application.updated",
      entity: "VisaApplication",
      entityId: id,
      oldValue: {
        visaType: visa.visaType,
        submittedAt: visa.submittedAt,
        biometricsAt: visa.biometricsAt,
        interviewAt: visa.interviewAt,
        decisionAt: visa.decisionAt,
        notes: visa.notes,
      },
      newValue: input,
    });

    return updated;
  },

  /**
   * Archive (soft-delete) a visa application. Retains the record for
   * audit trails. The linked application's stageKey is NOT changed —
   * archiving the visa record doesn't affect the application's pipeline
   * position.
   */
  async archive(id: string, actor: AuthUser) {
    const visa = await prisma.visaApplication.findFirst({ where: { id, deletedAt: null } });
    if (!visa) throw new HttpError(404, "NOT_FOUND", "Visa application not found");

    const updated = await prisma.visaApplication.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: actor.id },
    });

    await auditLog.record({
      userId: actor.id,
      action: "visa_application.archived",
      entity: "VisaApplication",
      entityId: id,
      oldValue: { stage: visa.stage },
    });

    return updated;
  },
};
