import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/api";
import bcrypt from "bcryptjs";
import type { JsonValue } from "@prisma/client/runtime/library";

/**
 * Employee Profile service — read + update the caller's own profile.
 *
 * ── IDOR closure ──────────────────────────────────────────────────────
 * Every read/write uses `userId = session.user.id` (resolved from the
 * session, never from the client). An employee cannot read or mutate
 * another employee's profile — only their own.
 *
 * ── Field-level permissions ──────────────────────────────────────────
 * Different fields have different editability rules:
 *   • Self-editable (employee themselves): name, phone, avatar,
 *     branch, designation, address, title
 *   • Admin-only: roleName, status, email (email is treated as
 *     identity and not self-editable — it's the login credential)
 *   • Never editable (computed/lifecycle): lastLoginAt, createdAt
 *   • Never returned: passwordHash (security)
 *
 * ── Audit ─────────────────────────────────────────────────────────────
 * Every update writes an AuditLog row with the old + new values so
 * security-sensitive changes (especially admin-driven role/status
 * changes) are traceable.
 */

// ─── Types ────────────────────────────────────────────────────────────

export type ProfileDetail = {
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  avatar: string | null;
  role: string;
  status: string;
  // Employee-specific (null for ADMIN callers without an Employee row)
  employeeId: string | null;
  title: string | null;
  branch: string | null;
  designation: string | null;
  address: string | null;
  // Lifecycle (read-only in UI)
  lastLoginAt: Date | null;
  emailVerifiedAt: Date | null;
  createdAt: Date;
  // Permissions summary (read-only display)
  permissions: { key: string; allowed: boolean }[];
};

export type ProfileUpdateInput = {
  name?: string;
  phone?: string | null;
  avatar?: string | null;
  title?: string | null;
  branch?: string | null;
  designation?: string | null;
  address?: string | null;
};

export type AdminProfileUpdateInput = ProfileUpdateInput & {
  roleName?: string;
  status?: string;
  email?: string;
};

// ─── Constants ────────────────────────────────────────────────────────

export const ALLOWED_ROLES = ["ADMIN", "EMPLOYEE", "STUDENT"] as const;
export const ALLOWED_STATUSES = ["ACTIVE", "INACTIVE", "SUSPENDED", "PENDING"] as const;

export const MAX_NAME = 200;
export const MAX_PHONE = 40;
export const MAX_AVATAR_URL = 2048;
export const MAX_TITLE = 200;
export const MAX_BRANCH = 200;
export const MAX_DESIGNATION = 200;
export const MAX_ADDRESS = 500;

// ─── Read ─────────────────────────────────────────────────────────────

/**
 * Fetch the caller's own profile. Always scoped by session userId.
 */
export async function getProfile(userId: string): Promise<ProfileDetail> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, name: true, email: true, phone: true, avatar: true,
      roleName: true, status: true,
      lastLoginAt: true, emailVerifiedAt: true, createdAt: true,
      employee: {
        select: {
          id: true, title: true, branch: true, designation: true, address: true,
        },
      },
      role: { select: { permissions: { select: { key: true } } } },
    },
  });
  if (!user) throw new HttpError(404, "NOT_FOUND", "User not found");

  const allPermissionKeys = [
    "students.read", "students.create", "students.update", "students.delete",
    "employees.read", "employees.manage",
    "leads.read", "leads.manage",
    "applications.read", "applications.update",
    "universities.read", "universities.manage",
    "courses.read", "courses.manage",
    "countries.read",
    "documents.read", "documents.review",
    "tasks.read", "tasks.manage",
    "visa.read", "visa.manage",
    "payments.read", "invoices.read",
    "messages.read", "messages.create",
    "reports.read", "audit.read", "settings.manage",
  ];
  const allowedKeys = new Set(user.role.permissions.map((p) => p.key));
  const permissions = allPermissionKeys.map((key) => ({
    key,
    allowed: allowedKeys.has(key),
  }));

  return {
    userId: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    avatar: user.avatar,
    role: user.roleName,
    status: user.status,
    employeeId: user.employee?.id ?? null,
    title: user.employee?.title ?? null,
    branch: user.employee?.branch ?? null,
    designation: user.employee?.designation ?? null,
    address: user.employee?.address ?? null,
    lastLoginAt: user.lastLoginAt,
    emailVerifiedAt: user.emailVerifiedAt,
    createdAt: user.createdAt,
    permissions,
  };
}

// ─── Update (self) ────────────────────────────────────────────────────

/**
 * Update the caller's own profile. Only self-editable fields are
 * accepted; admin-only fields (roleName, status, email) are silently
 * ignored if a non-admin tries to set them.
 *
 * Writes an AuditLog row capturing old + new values.
 */
export async function updateOwnProfile(
  userId: string,
  input: ProfileUpdateInput,
  actor: { id: string; ipAddress?: string; userAgent?: string },
): Promise<ProfileDetail> {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, name: true, phone: true, avatar: true,
      employee: { select: { id: true, title: true, branch: true, designation: true, address: true } },
    },
  });
  if (!existing) throw new HttpError(404, "NOT_FOUND", "User not found");

  // ── Validation ────────────────────────────────────────────────────
  const userData: Record<string, unknown> = {};
  if (input.name !== undefined) {
    const trimmed = input.name.trim();
    if (!trimmed) throw new HttpError(422, "VALIDATION_ERROR", "Name cannot be empty");
    if (trimmed.length > MAX_NAME) throw new HttpError(422, "VALIDATION_ERROR", `Name must be ≤ ${MAX_NAME} chars`);
    userData.name = trimmed;
  }
  if (input.phone !== undefined) {
    if (input.phone && input.phone.length > MAX_PHONE) {
      throw new HttpError(422, "VALIDATION_ERROR", `Phone must be ≤ ${MAX_PHONE} chars`);
    }
    userData.phone = input.phone || null;
  }
  if (input.avatar !== undefined) {
    if (input.avatar && input.avatar.length > MAX_AVATAR_URL) {
      throw new HttpError(422, "VALIDATION_ERROR", "Avatar URL too long");
    }
    userData.avatar = input.avatar || null;
  }

  // ── Employee fields ────────────────────────────────────────────────
  let employeeData: Record<string, unknown> | null = null;
  if (existing.employee) {
    employeeData = {};
    if (input.title !== undefined) {
      if (input.title && input.title.length > MAX_TITLE) {
        throw new HttpError(422, "VALIDATION_ERROR", `Title must be ≤ ${MAX_TITLE} chars`);
      }
      employeeData.title = input.title || null;
    }
    if (input.branch !== undefined) {
      if (input.branch && input.branch.length > MAX_BRANCH) {
        throw new HttpError(422, "VALIDATION_ERROR", `Branch must be ≤ ${MAX_BRANCH} chars`);
      }
      employeeData.branch = input.branch || null;
    }
    if (input.designation !== undefined) {
      if (input.designation && input.designation.length > MAX_DESIGNATION) {
        throw new HttpError(422, "VALIDATION_ERROR", `Designation must be ≤ ${MAX_DESIGNATION} chars`);
      }
      employeeData.designation = input.designation || null;
    }
    if (input.address !== undefined) {
      if (input.address && input.address.length > MAX_ADDRESS) {
        throw new HttpError(422, "VALIDATION_ERROR", `Address must be ≤ ${MAX_ADDRESS} chars`);
      }
      employeeData.address = input.address || null;
    }
    if (Object.keys(employeeData).length === 0) employeeData = null;
  }

  // Capture the "before" state for audit
  const oldValue: Record<string, unknown> = {
    name: existing.name,
    phone: existing.phone,
    avatar: existing.avatar,
    title: existing.employee?.title ?? null,
    branch: existing.employee?.branch ?? null,
    designation: existing.employee?.designation ?? null,
    address: existing.employee?.address ?? null,
  };

  // ── Persist ────────────────────────────────────────────────────────
  if (Object.keys(userData).length > 0) {
    await prisma.user.update({ where: { id: userId }, data: { ...userData, updatedAt: new Date() } });
  }
  if (employeeData && existing.employee) {
    await prisma.employee.update({
      where: { id: existing.employee.id },
      data: { ...employeeData, updatedAt: new Date() },
    });
  }

  const newValue = {
    ...userData,
    ...(employeeData ?? {}),
  };

  // ── Audit ──────────────────────────────────────────────────────────
  try {
    await prisma.auditLog.create({
      data: {
        userId: actor.id,
        action: "profile.updated",
        entity: "User",
        entityId: userId,
        oldValue: oldValue as unknown as JsonValue,
        newValue: newValue as unknown as JsonValue,
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
      },
    });
  } catch (err) {
    console.error("[profile-update] audit failed", err);
  }

  return getProfile(userId);
}

// ─── Update (admin) ──────────────────────────────────────────────────

/**
 * Admin-only profile update. Allows editing roleName, status, and email
 * in addition to the self-editable fields. Caller must have
 * `employees.manage` permission — verified by the route handler before
 * calling this function.
 */
export async function updateProfileAsAdmin(
  targetUserId: string,
  input: AdminProfileUpdateInput,
  actor: { id: string; ipAddress?: string; userAgent?: string },
): Promise<ProfileDetail> {
  const existing = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: {
      id: true, name: true, email: true, phone: true, avatar: true,
      roleName: true, status: true,
      employee: { select: { id: true, title: true, branch: true, designation: true, address: true } },
    },
  });
  if (!existing) throw new HttpError(404, "NOT_FOUND", "User not found");

  const userData: Record<string, unknown> = {};

  // Reuse the self-editable validation
  if (input.name !== undefined) {
    const trimmed = input.name.trim();
    if (!trimmed) throw new HttpError(422, "VALIDATION_ERROR", "Name cannot be empty");
    if (trimmed.length > MAX_NAME) throw new HttpError(422, "VALIDATION_ERROR", `Name must be ≤ ${MAX_NAME} chars`);
    userData.name = trimmed;
  }
  if (input.phone !== undefined) {
    if (input.phone && input.phone.length > MAX_PHONE) {
      throw new HttpError(422, "VALIDATION_ERROR", `Phone must be ≤ ${MAX_PHONE} chars`);
    }
    userData.phone = input.phone || null;
  }
  if (input.avatar !== undefined) {
    if (input.avatar && input.avatar.length > MAX_AVATAR_URL) {
      throw new HttpError(422, "VALIDATION_ERROR", "Avatar URL too long");
    }
    userData.avatar = input.avatar || null;
  }

  // Admin-only fields
  if (input.roleName !== undefined) {
    if (!ALLOWED_ROLES.includes(input.roleName as (typeof ALLOWED_ROLES)[number])) {
      throw new HttpError(400, "BAD_REQUEST", `Invalid role: ${input.roleName}`);
    }
    userData.roleName = input.roleName;
  }
  if (input.status !== undefined) {
    if (!ALLOWED_STATUSES.includes(input.status as (typeof ALLOWED_STATUSES)[number])) {
      throw new HttpError(400, "BAD_REQUEST", `Invalid status: ${input.status}`);
    }
    userData.status = input.status;
  }
  if (input.email !== undefined) {
    const email = input.email.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new HttpError(422, "VALIDATION_ERROR", "Invalid email format");
    }
    // Check for duplicate email
    const dupe = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (dupe && dupe.id !== targetUserId) {
      throw new HttpError(409, "CONFLICT", "Email already in use by another account");
    }
    userData.email = email;
  }

  // Employee fields (same as self-update)
  let employeeData: Record<string, unknown> | null = null;
  if (existing.employee) {
    employeeData = {};
    if (input.title !== undefined) {
      if (input.title && input.title.length > MAX_TITLE) {
        throw new HttpError(422, "VALIDATION_ERROR", `Title must be ≤ ${MAX_TITLE} chars`);
      }
      employeeData.title = input.title || null;
    }
    if (input.branch !== undefined) {
      if (input.branch && input.branch.length > MAX_BRANCH) {
        throw new HttpError(422, "VALIDATION_ERROR", `Branch must be ≤ ${MAX_BRANCH} chars`);
      }
      employeeData.branch = input.branch || null;
    }
    if (input.designation !== undefined) {
      if (input.designation && input.designation.length > MAX_DESIGNATION) {
        throw new HttpError(422, "VALIDATION_ERROR", `Designation must be ≤ ${MAX_DESIGNATION} chars`);
      }
      employeeData.designation = input.designation || null;
    }
    if (input.address !== undefined) {
      if (input.address && input.address.length > MAX_ADDRESS) {
        throw new HttpError(422, "VALIDATION_ERROR", `Address must be ≤ ${MAX_ADDRESS} chars`);
      }
      employeeData.address = input.address || null;
    }
    if (Object.keys(employeeData).length === 0) employeeData = null;
  }

  const oldValue: Record<string, unknown> = {
    name: existing.name,
    email: existing.email,
    phone: existing.phone,
    avatar: existing.avatar,
    roleName: existing.roleName,
    status: existing.status,
    title: existing.employee?.title ?? null,
    branch: existing.employee?.branch ?? null,
    designation: existing.employee?.designation ?? null,
    address: existing.employee?.address ?? null,
  };

  if (Object.keys(userData).length > 0) {
    await prisma.user.update({ where: { id: targetUserId }, data: { ...userData, updatedAt: new Date() } });
  }
  if (employeeData && existing.employee) {
    await prisma.employee.update({
      where: { id: existing.employee.id },
      data: { ...employeeData, updatedAt: new Date() },
    });
  }

  const newValue = { ...userData, ...(employeeData ?? {}) };

  try {
    await prisma.auditLog.create({
      data: {
        userId: actor.id,
        action: "profile.updated_by_admin",
        entity: "User",
        entityId: targetUserId,
        oldValue: oldValue as unknown as JsonValue,
        newValue: newValue as unknown as JsonValue,
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
      },
    });
  } catch (err) {
    console.error("[admin-profile-update] audit failed", err);
  }

  return getProfile(targetUserId);
}

// ─── Change password ─────────────────────────────────────────────────

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  actor: { id: string; ipAddress?: string; userAgent?: string },
): Promise<{ ok: true }> {
  if (!currentPassword) throw new HttpError(422, "VALIDATION_ERROR", "Current password is required");
  if (!newPassword) throw new HttpError(422, "VALIDATION_ERROR", "New password is required");
  if (newPassword.length < 8) throw new HttpError(422, "VALIDATION_ERROR", "Password must be ≥ 8 characters");
  if (newPassword.length > 200) throw new HttpError(422, "VALIDATION_ERROR", "Password too long");
  if (currentPassword === newPassword) {
    throw new HttpError(422, "VALIDATION_ERROR", "New password must differ from the current password");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, passwordHash: true },
  });
  if (!user) throw new HttpError(404, "NOT_FOUND", "User not found");

  const matches = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!matches) {
    throw new HttpError(422, "VALIDATION_ERROR", "Current password is incorrect");
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: newHash, updatedAt: new Date() },
  });

  // Audit — never log the password itself; only the fact that it changed.
  try {
    await prisma.auditLog.create({
      data: {
        userId: actor.id,
        action: "security.password_changed",
        entity: "User",
        entityId: userId,
        oldValue: { passwordChanged: false } as unknown as JsonValue,
        newValue: { passwordChanged: true, changedAt: new Date().toISOString() } as unknown as JsonValue,
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
      },
    });
  } catch (err) {
    console.error("[password-change] audit failed", err);
  }

  return { ok: true };
}

// ─── Sessions ─────────────────────────────────────────────────────────

/**
 * Auth.js v5 with JWT strategy is stateless — there are no server-side
 * session records to list or revoke. The "logout everywhere" action
 * works by rotating a per-user `tokenVersion` field: when the JWT's
 * embedded tokenVersion doesn't match the DB's, the session callback
 * invalidates the token.
 *
 * Until tokenVersion is added to the schema + auth callbacks, we
 * implement logout-everywhere as an audit-logged no-op that returns
 * the current session count (always 1 — the calling session). The
 * UI explains that JWT sessions expire on their own; full session
 * revocation requires the tokenVersion mechanism (next phase).
 *
 * For now this is honest about the limitation: we log the request,
 * return { revoked: 0, note: "..." }, and let the UI sign out the
 * current session.
 */
export async function listSessions(userId: string): Promise<{
  sessions: { id: string; device: string; lastActive: Date; current: boolean }[];
  note: string;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, lastLoginAt: true },
  });
  if (!user) throw new HttpError(404, "NOT_FOUND", "User not found");

  // Auth.js v5 JWT is stateless — we can only show the most-recent login
  // as the "current" session. We can't enumerate other sessions without
  // server-side session storage.
  return {
    sessions: [
      {
        id: "current",
        device: "This device",
        lastActive: user.lastLoginAt ?? new Date(),
        current: true,
      },
    ],
    note: "Auth.js v5 uses stateless JWT sessions. To revoke all sessions, change your password — existing tokens will continue to work until they expire, but the password change is logged for audit.",
  };
}

export async function revokeAllSessions(
  userId: string,
  actor: { id: string; ipAddress?: string; userAgent?: string },
): Promise<{ revoked: number; note: string }> {
  // Audit the request even though we can't physically revoke stateless
  // JWTs without the tokenVersion mechanism.
  try {
    await prisma.auditLog.create({
      data: {
        userId: actor.id,
        action: "security.sessions_revoked",
        entity: "User",
        entityId: userId,
        newValue: { requestedAt: new Date().toISOString() } as unknown as JsonValue,
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
      },
    });
  } catch (err) {
    console.error("[session-revoke] audit failed", err);
  }

  return {
    revoked: 0,
    note: "JWT sessions are stateless. Please sign out from each device, or change your password to invalidate credentials.",
  };
}
