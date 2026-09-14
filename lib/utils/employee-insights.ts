/**
 * Pure helpers for employee management — unit-tested and shared by API + UI.
 */

/** Compute pending/overdue task statistics for a list of tasks. */
export function computeTaskStats(
  tasks: { status: string; dueDate: Date | string | null }[],
  now: Date = new Date()
): { pending: number; overdue: number } {
  const open = tasks.filter((t) => t.status === "TODO" || t.status === "IN_PROGRESS");
  const pending = open.length;
  const overdue = open.filter((t) => t.dueDate && new Date(t.dueDate) < now).length;
  return { pending, overdue };
}

export const EMPLOYEE_ROLES = ["EMPLOYEE", "ADMIN"] as const;
export type AssignableRole = (typeof EMPLOYEE_ROLES)[number];

/**
 * Guard for role assignment. Admins may move staff between EMPLOYEE and ADMIN
 * but can never change their own role (lock-out protection).
 */
export function roleAssignmentError(
  target: { userId: string; roleName: string },
  actor: { id: string },
  newRole: string
): string | null {
  if (!EMPLOYEE_ROLES.includes(newRole as AssignableRole)) {
    return `Role must be one of: ${EMPLOYEE_ROLES.join(", ")}`;
  }
  if (target.userId === actor.id) {
    return "You cannot change your own role";
  }
  if (target.roleName === "STUDENT") {
    return "Student accounts cannot be assigned staff roles";
  }
  return null;
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

/** Generate a temporary password (never logged, shown once to the admin). */
export function generateTempPassword(length = 12): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  // guarantee the password policy: at least one letter and one digit
  if (!/[0-9]/.test(out)) out = out.slice(0, -1) + "7";
  if (!/[A-Za-z]/.test(out)) out = "a" + out.slice(1);
  return out;
}
