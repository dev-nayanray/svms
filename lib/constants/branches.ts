/**
 * Pure helpers for the Admin Branch Management module.
 *
 * No DB access — these functions feed the API routes, UI components, and
 * tests. The status enums, where-builder, and archive guard are the
 * single source of truth.
 *
 * Multi-branch access control architecture:
 * The Branch model already has an `organizationId` comment reserved for
 * future multi-tenancy. The current implementation is single-org but the
 * branch scoping is modeled via `branchId` on User/Student/Employee.
 * When multi-tenancy lands, `organizationId` can be added to Branch and
 * all business entities, and the where-builder below can filter by it.
 */

export const BRANCH_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type BranchStatus = (typeof BRANCH_STATUSES)[number];

export const BRANCH_STATUS_LABELS: Record<BranchStatus, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
};

/** Sort keys allowed for the admin branch list. */
export const BRANCH_SORT_KEYS = [
  "name",
  "code",
  "status",
  "createdAt",
] as const;

/**
 * Build a Prisma `where` fragment for the admin branch list. Enforces
 * the soft-delete filter (deletedAt null vs not-null based on the
 * `archived` toggle).
 */
export function buildAdminBranchWhere(filters: {
  search?: string;
  status?: string;
  archived?: boolean;
}): Record<string, unknown> {
  const search = filters.search?.trim();
  const andClauses: Record<string, unknown>[] = [
    { deletedAt: filters.archived ? { not: null } : null },
  ];

  if (filters.status) {
    andClauses.push({ status: filters.status });
  }

  if (search) {
    andClauses.push({
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { code: { contains: search, mode: "insensitive" } },
        { address: { contains: search, mode: "insensitive" } },
      ],
    });
  }

  return { AND: andClauses };
}

/**
 * Pure guard: returns a human-readable reason when a branch cannot be
 * archived, or null when archiving is allowed. Branches with active
 * employees or students block archiving — deactivate instead.
 */
export function branchArchiveBlockReason(branch: {
  deletedAt?: Date | string | null;
  _count?: { employees?: number; students?: number } | null;
}): string | null {
  if (branch.deletedAt) return "Branch is already archived";
  const employees = branch._count?.employees ?? 0;
  const students = branch._count?.students ?? 0;
  if (employees > 0 || students > 0) {
    return `${employees} employee(s) and ${students} student(s) are assigned to this branch — reassign them or deactivate the branch instead`;
  }
  return null;
}
