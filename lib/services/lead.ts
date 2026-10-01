import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/api";
import type { AuthUser } from "@/lib/auth/guards";
import { auditLog } from "./audit";
import { conversionBlockReason, isValidTransition } from "@/lib/constants/leads";
import { assignCounselor, type AssignmentStrategy } from "./counselor-assignment";
import { logSystemEvent } from "@/lib/system/logs";

export type LeadListParams = {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  source?: string;
  countryId?: string;
  intake?: string;
  employeeId?: string;
  priority?: string;
  createdFrom?: Date;
  createdTo?: Date;
  archived?: boolean;
  sortBy?: Record<string, "asc" | "desc">[];
};

export type CreateLeadInput = {
  name: string;
  phone?: string;
  email?: string;
  interestedCountry?: string;
  preferredIntake?: string;
  educationLevel?: string;
  englishScore?: string;
  interestedProgram?: string;
  location?: string;
  source?: string;
  sourcePlatformId?: string;
  sourceConversationId?: string;
  sourceMessageId?: string;
  priority?: string;
  notes?: string;
};

export type DedupResult = {
  isDuplicate: boolean;
  existingLeadId?: string;
  confidence: "EXACT" | "HIGH" | "LOW" | "NONE";
  reason?: string;
};

/**
 * Check for duplicate leads using phone, email, and external platform IDs.
 * Returns the existing lead ID + confidence level if a duplicate is found.
 */
export async function checkDuplicate(input: {
  phone?: string;
  email?: string;
  sourcePlatformId?: string;
  sourceConversationId?: string;
}): Promise<DedupResult> {
  const { phone, email, sourcePlatformId, sourceConversationId } = input;

  // Check by external platform ID (highest confidence)
  if (sourcePlatformId) {
    const existing = await prisma.lead.findFirst({
      where: { sourcePlatformId, deletedAt: null },
      select: { id: true, name: true, source: true },
    });
    if (existing) {
      return {
        isDuplicate: true,
        existingLeadId: existing.id,
        confidence: "EXACT",
        reason: `Same platform ID as "${existing.name}"`,
      };
    }
  }

  // Check by conversation ID
  if (sourceConversationId) {
    const existing = await prisma.lead.findFirst({
      where: { sourceConversationId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (existing) {
      return {
        isDuplicate: true,
        existingLeadId: existing.id,
        confidence: "EXACT",
        reason: `Same conversation as "${existing.name}"`,
      };
    }
  }

  // Check by email (high confidence)
  if (email && email.trim().length > 0) {
    const existing = await prisma.lead.findFirst({
      where: { email: email.toLowerCase(), deletedAt: null },
      select: { id: true, name: true },
    });
    if (existing) {
      return {
        isDuplicate: true,
        existingLeadId: existing.id,
        confidence: "HIGH",
        reason: `Same email as "${existing.name}"`,
      };
    }
  }

  // Check by phone (high confidence)
  if (phone && phone.replace(/\D/g, "").length >= 8) {
    const normalizedPhone = phone.replace(/\D/g, "");
    const existing = await prisma.lead.findFirst({
      where: { phone: { contains: normalizedPhone.slice(-8) }, deletedAt: null },
      select: { id: true, name: true, phone: true },
    });
    if (existing) {
      return {
        isDuplicate: true,
        existingLeadId: existing.id,
        confidence: "HIGH",
        reason: `Similar phone number as "${existing.name}"`,
      };
    }
  }

  return { isDuplicate: false, confidence: "NONE" };
}

/**
 * Record an activity on the lead timeline.
 */
async function recordActivity(params: {
  leadId: string;
  type: string;
  description: string;
  oldValue?: string | null;
  newValue?: string | null;
  actorId?: string;
  actorName?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.leadActivity.create({
      data: {
        leadId: params.leadId,
        type: params.type,
        description: params.description,
        oldValue: params.oldValue ?? undefined,
        newValue: params.newValue ?? undefined,
        actorId: params.actorId,
        actorName: params.actorName ?? undefined,
        metadata: (params.metadata ?? {}) as never,
      },
    });
  } catch {
    // best-effort — don't fail the operation if timeline recording fails
  }
}

export const leadService = {
  async list(params: LeadListParams) {
    const where = {
      deletedAt: null,
      ...(params.archived === undefined ? { archivedAt: null } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(params.source ? { source: params.source } : {}),
      ...(params.countryId ? { interestedCountry: params.countryId } : {}),
      ...(params.intake ? { preferredIntake: params.intake } : {}),
      ...(params.employeeId ? { assignedEmployeeId: params.employeeId } : {}),
      ...(params.priority ? { priority: params.priority } : {}),
      ...(params.createdFrom || params.createdTo
        ? {
            createdAt: {
              ...(params.createdFrom ? { gte: params.createdFrom } : {}),
              ...(params.createdTo ? { lte: params.createdTo } : {}),
            },
          }
        : {}),
      ...(params.search
        ? {
            OR: [
              { name: { contains: params.search, mode: "insensitive" as const } },
              { email: { contains: params.search, mode: "insensitive" as const } },
              { phone: { contains: params.search } },
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        include: { employee: { include: { user: true } } },
        orderBy: params.sortBy ?? [{ createdAt: "desc" }],
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      prisma.lead.count({ where }),
    ]);
    return { data, total };
  },

  async byId(id: string) {
    const lead = await prisma.lead.findFirst({
      where: { id, deletedAt: null },
      include: {
        employee: { include: { user: true, branch: true } },
        activities: { orderBy: { createdAt: "desc" }, take: 50 },
      },
    });
    if (!lead) throw new HttpError(404, "NOT_FOUND", "Lead not found");
    return lead;
  },

  /**
   * Create a new lead with deduplication check.
   * If a duplicate is found with EXACT or HIGH confidence, returns the
   * existing lead ID instead of creating a new one.
   */
  async create(input: CreateLeadInput, actor?: AuthUser): Promise<{
    lead: { id: string; name: string; status: string; source: string | null };
    created: boolean;
    duplicateOf?: string;
    duplicateConfidence?: string;
  }> {
    // Check for duplicates
    const dup = await checkDuplicate({
      phone: input.phone,
      email: input.email,
      sourcePlatformId: input.sourcePlatformId,
      sourceConversationId: input.sourceConversationId,
    });

    if (dup.isDuplicate && dup.existingLeadId && (dup.confidence === "EXACT" || dup.confidence === "HIGH")) {
      // Return existing lead — don't create a duplicate
      const existing = await prisma.lead.findUnique({
        where: { id: dup.existingLeadId },
        select: { id: true, name: true, status: true, source: true },
      });
      if (existing) {
        await recordActivity({
          leadId: existing.id,
          type: "DUPLICATE_DETECTED",
          description: `Duplicate lead detected from ${input.source ?? "unknown"} source`,
          metadata: { reason: dup.reason, newSource: input.source },
        });
        return { lead: existing, created: false, duplicateOf: dup.existingLeadId, duplicateConfidence: dup.confidence };
      }
    }

    // Create the new lead
    const lead = await prisma.lead.create({
      data: {
        name: input.name,
        phone: input.phone ?? null,
        email: input.email ?? null,
        interestedCountry: input.interestedCountry ?? null,
        preferredIntake: input.preferredIntake ?? null,
        educationLevel: input.educationLevel ?? null,
        englishScore: input.englishScore ?? null,
        interestedProgram: input.interestedProgram ?? null,
        location: input.location ?? null,
        source: input.source ?? "WEBSITE",
        sourcePlatformId: input.sourcePlatformId ?? null,
        sourceConversationId: input.sourceConversationId ?? null,
        sourceMessageId: input.sourceMessageId ?? null,
        priority: input.priority ?? "MEDIUM",
        notes: input.notes ?? null,
        status: "NEW",
      },
    });

    await recordActivity({
      leadId: lead.id,
      type: "CREATED",
      description: `Lead created from ${input.source ?? "WEBSITE"} source`,
      actorId: actor?.id,
      actorName: actor?.name,
      metadata: { source: input.source, sourcePlatformId: input.sourcePlatformId },
    });

    if (actor) {
      await auditLog.record({
        userId: actor.id,
        action: "lead.created",
        entity: "Lead",
        entityId: lead.id,
        newValue: { name: input.name, source: input.source, status: "NEW" },
      });
    }

    return { lead: { id: lead.id, name: lead.name, status: lead.status, source: lead.source }, created: true };
  },

  async update(
    id: string,
    input: Partial<{
      name: string;
      phone: string;
      email: string;
      interestedCountry: string;
      preferredIntake: string;
      educationLevel: string;
      englishScore: string;
      interestedProgram: string;
      location: string;
      source: string;
      status: string;
      priority: string;
      assignedEmployeeId: string;
      notes: string;
      nextFollowUpAt: Date;
    }>,
    actor: AuthUser
  ) {
    const lead = await prisma.lead.findFirst({ where: { id, deletedAt: null } });
    if (!lead) throw new HttpError(404, "NOT_FOUND", "Lead not found");

    // Converted leads are read-only except for notes
    if (lead.convertedStudentId) {
      const keys = Object.keys(input).filter((k) => k !== "notes" && input[k as keyof typeof input] !== undefined);
      if (keys.length > 0) {
        throw new HttpError(409, "CONFLICT", "Converted leads cannot be modified (notes only)");
      }
    }

    // Validate status transitions
    if (input.status && input.status !== lead.status) {
      if (!isValidTransition(lead.status, input.status)) {
        throw new HttpError(
          409,
          "CONFLICT",
          `Cannot transition from ${lead.status} to ${input.status}`,
        );
      }
    }

    const updated = await prisma.lead.update({
      where: { id },
      data: { ...input, email: input.email || undefined },
    });

    const tracked: (keyof typeof input)[] = ["status", "source", "assignedEmployeeId", "name", "priority"];
    await auditLog.record({
      userId: actor.id,
      action: "lead.updated",
      entity: "Lead",
      entityId: id,
      oldValue: Object.fromEntries(tracked.map((k) => [k, (lead as Record<string, unknown>)[k as string]])),
      newValue: Object.fromEntries(tracked.map((k) => [k, (input as Record<string, unknown>)[k as string]])),
    });

    // Record activity for status changes
    if (input.status && input.status !== lead.status) {
      await recordActivity({
        leadId: id,
        type: "STATUS_CHANGED",
        description: `Status changed from ${lead.status} to ${input.status}`,
        oldValue: lead.status,
        newValue: input.status,
        actorId: actor.id,
        actorName: actor.name,
      });
    }

    // Record activity for assignment changes
    if (input.assignedEmployeeId && input.assignedEmployeeId !== lead.assignedEmployeeId) {
      const counselor = await prisma.employee.findUnique({
        where: { id: input.assignedEmployeeId },
        include: { user: { select: { name: true } } },
      });
      await recordActivity({
        leadId: id,
        type: "ASSIGNED",
        description: `Assigned to ${counselor?.user.name ?? "counselor"}`,
        oldValue: lead.assignedEmployeeId ?? "unassigned",
        newValue: input.assignedEmployeeId,
        actorId: actor.id,
        actorName: actor.name,
        metadata: { counselorName: counselor?.user.name },
      });
    }

    return updated;
  },

  /**
   * Approve a lead — transitions PENDING_REVIEW → APPROVED.
   * Optionally auto-assigns a counselor after approval.
   */
  async approve(
    id: string,
    actor: AuthUser,
    options?: { autoAssign?: boolean; strategy?: AssignmentStrategy; counselorId?: string },
  ) {
    const lead = await prisma.lead.findFirst({ where: { id, deletedAt: null } });
    if (!lead) throw new HttpError(404, "NOT_FOUND", "Lead not found");

    if (!isValidTransition(lead.status, "APPROVED")) {
      throw new HttpError(409, "CONFLICT", `Cannot approve a lead in ${lead.status} status`);
    }

    const now = new Date();
    await prisma.lead.update({
      where: { id },
      data: {
        status: "APPROVED",
        approvedAt: now,
        approvedById: actor.id,
      },
    });

    await auditLog.record({
      userId: actor.id,
      action: "lead.approved",
      entity: "Lead",
      entityId: id,
      oldValue: { status: lead.status },
      newValue: { status: "APPROVED" },
    });

    await recordActivity({
      leadId: id,
      type: "APPROVED",
      description: `Lead approved by ${actor.name}`,
      oldValue: lead.status,
      newValue: "APPROVED",
      actorId: actor.id,
      actorName: actor.name,
    });

    // Auto-assign counselor if requested
    if (options?.autoAssign) {
      const assignment = await assignCounselor({
        leadId: id,
        strategy: options.strategy ?? "LEAST_LOAD",
        program: lead.interestedProgram,
        forcedCounselorId: options.counselorId,
      });

      if (assignment.assigned && assignment.counselorId) {
        await this.assign(id, assignment.counselorId, actor);
      } else {
        // No counselor available — log + notify
        await logSystemEvent(
          "WARNING",
          "system",
          `No counselor available for lead ${id} — staying in APPROVED status`,
          { leadId: id, reason: assignment.reason },
        );
      }
    }

    return { id, status: "APPROVED" };
  },

  /**
   * Reject a lead — transitions PENDING_REVIEW → REJECTED.
   */
  async reject(id: string, actor: AuthUser, reason?: string) {
    const lead = await prisma.lead.findFirst({ where: { id, deletedAt: null } });
    if (!lead) throw new HttpError(404, "NOT_FOUND", "Lead not found");

    if (!isValidTransition(lead.status, "REJECTED")) {
      throw new HttpError(409, "CONFLICT", `Cannot reject a lead in ${lead.status} status`);
    }

    await prisma.lead.update({
      where: { id },
      data: { status: "REJECTED" },
    });

    await auditLog.record({
      userId: actor.id,
      action: "lead.rejected",
      entity: "Lead",
      entityId: id,
      oldValue: { status: lead.status },
      newValue: { status: "REJECTED", reason },
    });

    await recordActivity({
      leadId: id,
      type: "REJECTED",
      description: `Lead rejected by ${actor.name}${reason ? `: ${reason}` : ""}`,
      oldValue: lead.status,
      newValue: "REJECTED",
      actorId: actor.id,
      actorName: actor.name,
      metadata: { reason },
    });

    return { id, status: "REJECTED" };
  },

  /**
   * Assign a counselor to a lead — transitions APPROVED → ASSIGNED.
   */
  async assign(id: string, counselorId: string, actor: AuthUser) {
    const lead = await prisma.lead.findFirst({ where: { id, deletedAt: null } });
    if (!lead) throw new HttpError(404, "NOT_FOUND", "Lead not found");

    const counselor = await prisma.employee.findFirst({
      where: { id: counselorId, deletedAt: null, user: { status: "ACTIVE" } },
      include: { user: { select: { name: true, id: true } } },
    });
    if (!counselor) throw new HttpError(404, "NOT_FOUND", "Counselor not found or inactive");

    const now = new Date();
    const newStatus = lead.status === "APPROVED" ? "ASSIGNED" : lead.status;

    await prisma.lead.update({
      where: { id },
      data: {
        assignedEmployeeId: counselorId,
        assignedAt: now,
        status: newStatus,
      },
    });

    await auditLog.record({
      userId: actor.id,
      action: "lead.assigned",
      entity: "Lead",
      entityId: id,
      newValue: { counselorId, counselorName: counselor.user.name },
    });

    await recordActivity({
      leadId: id,
      type: "ASSIGNED",
      description: `Assigned to ${counselor.user.name}`,
      oldValue: lead.assignedEmployeeId ?? "unassigned",
      newValue: counselorId,
      actorId: actor.id,
      actorName: actor.name,
      metadata: { counselorName: counselor.user.name },
    });

    // Create a notification for the counselor
    try {
      await prisma.notification.create({
        data: {
          userId: counselor.userId,
          title: "New Lead Assigned",
          message: `You've been assigned a new lead: ${lead.name}${lead.interestedProgram ? ` (${lead.interestedProgram})` : ""}`,
          type: "INFO",
          link: `/employee/leads/${id}`,
        },
      });
    } catch {
      // best-effort
    }

    return { id, status: newStatus, assignedTo: counselor.user.name };
  },

  /**
   * Get the activity timeline for a lead.
   */
  async getTimeline(id: string) {
    return prisma.leadActivity.findMany({
      where: { leadId: id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  },

  /**
   * Add a note to a lead + record it in the activity timeline.
   */
  async addNote(id: string, note: string, actor: AuthUser) {
    const lead = await prisma.lead.findFirst({ where: { id, deletedAt: null } });
    if (!lead) throw new HttpError(404, "NOT_FOUND", "Lead not found");

    const existingNotes = lead.notes ?? "";
    const updatedNotes = existingNotes
      ? `${existingNotes}\n\n[${new Date().toISOString()}] ${actor.name}: ${note}`
      : `[${new Date().toISOString()}] ${actor.name}: ${note}`;

    await prisma.lead.update({
      where: { id },
      data: { notes: updatedNotes },
    });

    await recordActivity({
      leadId: id,
      type: "NOTE_ADDED",
      description: `Note added by ${actor.name}`,
      actorId: actor.id,
      actorName: actor.name,
      metadata: { note },
    });

    return { id, notes: updatedNotes };
  },

  async setArchived(id: string, archived: boolean, actor: AuthUser) {
    const lead = await prisma.lead.findFirst({ where: { id, deletedAt: null } });
    if (!lead) throw new HttpError(404, "NOT_FOUND", "Lead not found");
    if (archived && lead.convertedStudentId) {
      throw new HttpError(409, "CONFLICT", "Converted leads cannot be archived");
    }

    const updated = await prisma.lead.update({
      where: { id },
      data: { archivedAt: archived ? new Date() : null },
    });
    await auditLog.record({
      userId: actor.id,
      action: archived ? "lead.archived" : "lead.unarchived",
      entity: "Lead",
      entityId: id,
    });
    return updated;
  },

  /** Convert to Student: creates the student, links back, prevents duplicates. */
  async convertToStudent(id: string, actor: AuthUser) {
    const lead = await prisma.lead.findFirst({ where: { id, deletedAt: null } });
    if (!lead) throw new HttpError(404, "NOT_FOUND", "Lead not found");

    const reason = conversionBlockReason(lead);
    if (reason) throw new HttpError(409, "CONFLICT", reason);

    // Extra duplicate protection at the database level (email is unique on User)
    const existingUser = await prisma.user.findUnique({
      where: { email: lead.email!.toLowerCase() },
    });
    const existingStudent = existingUser
      ? await prisma.student.findUnique({ where: { userId: existingUser.id } })
      : null;
    if (existingStudent) {
      // Link instead of duplicating, and keep history
      await prisma.lead.update({
        where: { id },
        data: { status: "CONVERTED", convertedStudentId: existingStudent.id, convertedAt: new Date() },
      });
      await auditLog.record({
        userId: actor.id,
        action: "lead.converted_existing_student",
        entity: "Lead",
        entityId: id,
        newValue: { studentId: existingStudent.id },
      });
      await recordActivity({
        leadId: id,
        type: "CONVERTED",
        description: `Lead converted to existing student`,
        actorId: actor.id,
        actorName: actor.name,
        metadata: { studentId: existingStudent.id },
      });
      return existingStudent;
    }

    const { studentService } = await import("./student");
    const student = await studentService.create(
      {
        firstName: lead.name.split(" ")[0],
        lastName: lead.name.split(" ").slice(1).join(" ") || "-",
        email: lead.email!,
        phone: lead.phone ?? undefined,
        assignedEmployeeId: lead.assignedEmployeeId ?? undefined,
      },
      actor
    );

    await prisma.lead.update({
      where: { id },
      data: { status: "CONVERTED", convertedStudentId: student.id, convertedAt: new Date() },
    });
    await auditLog.record({
      userId: actor.id,
      action: "lead.converted",
      entity: "Lead",
      entityId: id,
      newValue: { studentId: student.id, name: lead.name },
    });
    await recordActivity({
      leadId: id,
      type: "CONVERTED",
      description: `Lead converted to student`,
      actorId: actor.id,
      actorName: actor.name,
      metadata: { studentId: student.id },
    });
    return student;
  },
};
