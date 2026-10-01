import { prisma } from "@/lib/db";
import { logSystemEvent } from "@/lib/system/logs";

/**
 * Counselor Assignment Engine
 * ============================
 *
 * Automatically assigns a counselor to an approved lead based on
 * configurable rules:
 *
 * 1. Counselor must be ACTIVE (status = "ACTIVE")
 * 2. Counselor must have the `leads.manage` permission (EMPLOYEE role)
 * 3. Prefer counselors with fewer active leads (load balancing)
 * 4. Optional: match by program specialization (if the lead has
 *    interestedProgram and the counselor has a matching specialization)
 *
 * Assignment strategies:
 *  - ROUND_ROBIN: cycle through eligible counselors in order
 *  - LEAST_LOAD: assign to the counselor with the fewest active leads
 *  - PROGRAM_MATCH: prefer counselors whose specialization matches
 *
 * Default: LEAST_LOAD (most balanced workload)
 *
 * If no counselor is available, the lead stays in APPROVED status and
 * an admin notification is created.
 */

export type AssignmentStrategy = "ROUND_ROBIN" | "LEAST_LOAD" | "PROGRAM_MATCH";

export type AssignmentResult = {
  assigned: boolean;
  counselorId: string | null;
  counselorName: string | null;
  reason?: string;
  activeLeadCount?: number;
};

/**
 * Find eligible counselors — ACTIVE employees with the EMPLOYEE role.
 * Returns their active lead count for load balancing.
 */
async function getEligibleCounselors(program?: string | null) {
  // Find all active employees (they're all potential counselors).
  // Active = the User's status is ACTIVE (not the Employee, which has no status field).
  const employees = await prisma.employee.findMany({
    where: { deletedAt: null, user: { status: "ACTIVE", deletedAt: null, roleName: "EMPLOYEE" } },
    include: {
      user: { select: { id: true, name: true, email: true } },
      branch: { select: { id: true, name: true } },
    },
  });

  if (employees.length === 0) return [];

  // Count active leads per employee (leads in ASSIGNED, CONTACTED, FOLLOW_UP status)
  const leadCounts = await prisma.lead.groupBy({
    by: ["assignedEmployeeId"],
    where: {
      assignedEmployeeId: { in: employees.map((e) => e.id) },
      status: { in: ["ASSIGNED", "CONTACTED", "FOLLOW_UP", "QUALIFIED"] },
      deletedAt: null,
    },
    _count: { id: true },
  });

  const countMap = new Map(
    leadCounts.map((c) => [c.assignedEmployeeId, c._count.id]),
  );

  return employees.map((e) => ({
    id: e.id,
    name: e.user.name,
    email: e.user.email,
    branchName: e.branch?.name ?? null,
    activeLeadCount: countMap.get(e.id) ?? 0,
    // Specialization matching is optional — we use the employee's
    // title as a proxy for specialization if available
    specialization: e.title ?? null,
  }));
}

/**
 * Assign a counselor to a lead using the configured strategy.
 *
 * @param leadId The lead to assign
 * @param strategy Assignment strategy (default: LEAST_LOAD)
 * @param program Optional program to match (e.g. "CSE")
 * @param forcedCounselorId Optional — for manual assignment override
 * @returns AssignmentResult with the assigned counselor's ID + name
 */
export async function assignCounselor(params: {
  leadId: string;
  strategy?: AssignmentStrategy;
  program?: string | null;
  forcedCounselorId?: string;
}): Promise<AssignmentResult> {
  const { leadId, strategy = "LEAST_LOAD", program = null, forcedCounselorId } = params;

  // Manual override — if a specific counselor is forced, assign directly
  if (forcedCounselorId) {
    const counselor = await prisma.employee.findFirst({
      where: { id: forcedCounselorId, deletedAt: null, user: { status: "ACTIVE" } },
      include: { user: { select: { name: true } } },
    });
    if (!counselor) {
      return {
        assigned: false,
        counselorId: null,
        counselorName: null,
        reason: "Specified counselor not found or inactive",
      };
    }
    return {
      assigned: true,
      counselorId: counselor.id,
      counselorName: counselor.user.name,
    };
  }

  // Get eligible counselors with their load counts
  const counselors = await getEligibleCounselors(program);
  if (counselors.length === 0) {
    await logSystemEvent(
      "WARNING",
      "system",
      `No eligible counselor for lead ${leadId} — staying in APPROVED status`,
      { leadId, program },
    );
    return {
      assigned: false,
      counselorId: null,
      counselorName: null,
      reason: "No eligible counselor available",
    };
  }

  // Apply the assignment strategy
  let selected = counselors[0];

  if (strategy === "LEAST_LOAD") {
    // Pick the counselor with the fewest active leads
    selected = counselors.reduce((min, c) =>
      c.activeLeadCount < min.activeLeadCount ? c : min,
    );
  } else if (strategy === "ROUND_ROBIN") {
    // Find the counselor who was assigned least recently
    const lastAssigned = await prisma.lead.findFirst({
      where: {
        assignedEmployeeId: { in: counselors.map((c) => c.id) },
        assignedAt: { not: null },
      },
      orderBy: { assignedAt: "desc" },
      select: { assignedEmployeeId: true },
    });
    if (lastAssigned) {
      const lastIdx = counselors.findIndex((c) => c.id === lastAssigned.assignedEmployeeId);
      if (lastIdx >= 0 && lastIdx + 1 < counselors.length) {
        selected = counselors[lastIdx + 1];
      }
    }
  } else if (strategy === "PROGRAM_MATCH" && program) {
    // Prefer counselors whose specialization contains the program keyword
    const match = counselors.find((c) => {
      const spec = (c.specialization ?? "").toLowerCase();
      return spec.includes(program.toLowerCase());
    });
    if (match) selected = match;
    // If no match, fall through to LEAST_LOAD behavior (first by sort)
    else {
      selected = counselors.reduce((min, c) =>
        c.activeLeadCount < min.activeLeadCount ? c : min,
      );
    }
  }

  return {
    assigned: true,
    counselorId: selected.id,
    counselorName: selected.name,
    activeLeadCount: selected.activeLeadCount,
  };
}

/**
 * Get the current workload for each counselor — used by the admin panel
 * to show counselor availability before manual assignment.
 */
export async function getCounselorWorkload(): Promise<
  Array<{
    id: string;
    name: string;
    email: string;
    branchName: string | null;
    activeLeads: number;
    totalLeads: number;
    status: string;
  }>
> {
  const employees = await prisma.employee.findMany({
    where: { deletedAt: null },
    include: {
      user: { select: { name: true, email: true, status: true } },
      branch: { select: { name: true } },
    },
  });

  if (employees.length === 0) return [];

  const counts = await prisma.lead.groupBy({
    by: ["assignedEmployeeId"],
    where: {
      assignedEmployeeId: { in: employees.map((e) => e.id) },
      deletedAt: null,
    },
    _count: { id: true },
  });

  const activeCounts = await prisma.lead.groupBy({
    by: ["assignedEmployeeId"],
    where: {
      assignedEmployeeId: { in: employees.map((e) => e.id) },
      status: { in: ["ASSIGNED", "CONTACTED", "FOLLOW_UP", "QUALIFIED"] },
      deletedAt: null,
    },
    _count: { id: true },
  });

  const totalMap = new Map(counts.map((c) => [c.assignedEmployeeId, c._count.id]));
  const activeMap = new Map(activeCounts.map((c) => [c.assignedEmployeeId, c._count.id]));

  return employees.map((e) => ({
    id: e.id,
    name: e.user.name,
    email: e.user.email,
    branchName: e.branch?.name ?? null,
    activeLeads: activeMap.get(e.id) ?? 0,
    totalLeads: totalMap.get(e.id) ?? 0,
    status: e.user.status,
  }));
}
