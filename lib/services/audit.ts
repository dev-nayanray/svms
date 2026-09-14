import { prisma } from "@/lib/db";
import type { NextRequest } from "next/server";

type AuditInput = {
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  /**
   * Source IP and user agent. Callers should pass these from the
   * NextRequest so that security incidents can be traced back to a
   * client. If omitted, the audit row is recorded without them
   * (backwards-compatible).
   *
   * Use `auditLog.fromRequest(req)` to extract both from a single
   * NextRequest.
   */
  ipAddress?: string | null;
  userAgent?: string | null;
};

/**
 * Extract { ipAddress, userAgent } from a NextRequest so callers
 * don't have to repeat the header-reading logic at every call site.
 *
 * - `x-forwarded-for` is preferred (set by upstream proxies / load
 *   balancers / Vercel edge), with the left-most non-empty hop.
 * - Falls back to the connection-level `x-real-ip` if present.
 */
export function fromRequest(req: NextRequest): {
  ipAddress: string | undefined;
  userAgent: string | undefined;
} {
  const xff = req.headers.get("x-forwarded-for");
  let ipAddress: string | undefined;
  if (xff) {
    // XFF can be a comma-separated list of proxies. The left-most
    // entry is the original client IP.
    const first = xff.split(",")[0]?.trim();
    if (first) ipAddress = first;
  }
  if (!ipAddress) {
    const realIp = req.headers.get("x-real-ip");
    if (realIp) ipAddress = realIp.trim();
  }
  const userAgent = req.headers.get("user-agent") ?? undefined;
  return { ipAddress, userAgent };
}

export const auditLog = {
  /**
   * Extract client IP + UA from a NextRequest. Exposed as a method
   * on the auditLog object so callers can do:
   *
   *   const ctx = auditLog.fromRequest(req);
   *   await auditLog.record({ ..., ...ctx });
   */
  fromRequest,

  async record(input: AuditInput) {
    try {
      await prisma.auditLog.create({
        data: {
          userId: input.userId ?? undefined,
          action: input.action,
          entity: input.entity,
          entityId: input.entityId ?? undefined,
          oldValue:
            input.oldValue === undefined ? undefined : (input.oldValue as object),
          newValue:
            input.newValue === undefined ? undefined : (input.newValue as object),
          ipAddress: input.ipAddress ?? undefined,
          userAgent: input.userAgent ?? undefined,
        },
      });
    } catch (err) {
      // Audit logging must never break the business operation.
      // Use console.error (server-side only) — never expose to client.
      console.error("[audit] failed to record", input.action, err);
    }
  },
};
