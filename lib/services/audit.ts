import { prisma } from "@/lib/db";

type AuditInput = {
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export const auditLog = {
  async record(input: AuditInput) {
    try {
      await prisma.auditLog.create({
        data: {
          userId: input.userId ?? undefined,
          action: input.action,
          entity: input.entity,
          entityId: input.entityId ?? undefined,
          oldValue: input.oldValue === undefined ? undefined : (input.oldValue as object),
          newValue: input.newValue === undefined ? undefined : (input.newValue as object),
          ipAddress: input.ipAddress ?? undefined,
          userAgent: input.userAgent ?? undefined,
        },
      });
    } catch (err) {
      // Audit logging must never break the business operation.
      console.error("[audit] failed to record", input.action, err);
    }
  },
};
