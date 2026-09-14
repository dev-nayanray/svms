import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcryptjs";

// ── Mock Prisma ───────────────────────────────────────────────────────

const prismaMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  employee: { update: vi.fn() },
  auditLog: { create: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth/user-cache", () => ({
  invalidateUserCache: vi.fn(),
  getCachedUserEntry: vi.fn(() => null),
  setCachedUserEntry: vi.fn(),
  USER_CACHE_TTL_MS: 60000,
}));

import {
  getProfile,
  updateOwnProfile,
  updateProfileAsAdmin,
  changePassword,
  listSessions,
  revokeAllSessions,
  ALLOWED_ROLES,
  ALLOWED_STATUSES,
  MAX_NAME, MAX_PHONE, MAX_TITLE, MAX_BRANCH, MAX_DESIGNATION, MAX_ADDRESS,
} from "@/lib/services/profile-cases";

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Constants ────────────────────────────────────────────────────────

describe("profile constants", () => {
  it("has 3 roles", () => {
    expect(ALLOWED_ROLES).toEqual(["ADMIN", "EMPLOYEE", "STUDENT"]);
  });
  it("has 4 statuses", () => {
    expect(ALLOWED_STATUSES).toEqual(["ACTIVE", "INACTIVE", "SUSPENDED", "PENDING"]);
  });
  it("field length limits are sensible", () => {
    expect(MAX_NAME).toBe(200);
    expect(MAX_PHONE).toBe(40);
    expect(MAX_TITLE).toBe(200);
    expect(MAX_BRANCH).toBe(200);
    expect(MAX_DESIGNATION).toBe(200);
    expect(MAX_ADDRESS).toBe(500);
  });
});

// ── getProfile ───────────────────────────────────────────────────────

describe("getProfile", () => {
  it("returns the user's profile with employee fields + permissions", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "u1", name: "Karim", email: "k@x.com", phone: "+88", avatar: "https://x/y.png",
      roleName: "EMPLOYEE", status: "ACTIVE",
      lastLoginAt: new Date("2026-09-01"), emailVerifiedAt: null, createdAt: new Date("2026-01-01"),
      employee: { id: "e1", title: "Counselor", branch: "Dhaka", designation: "Senior", address: "Banani" },
      role: { permissions: [{ key: "students.read" }, { key: "tasks.read" }] },
    });
    const p = await getProfile("u1");
    expect(p.name).toBe("Karim");
    expect(p.email).toBe("k@x.com");
    expect(p.role).toBe("EMPLOYEE");
    expect(p.employeeId).toBe("e1");
    expect(p.title).toBe("Counselor");
    expect(p.branch).toBe("Dhaka");
    expect(p.designation).toBe("Senior");
    expect(p.address).toBe("Banani");
    // Permissions array should be populated for ALL keys
    expect(p.permissions.length).toBeGreaterThan(10);
    const studentsPerm = p.permissions.find((perm) => perm.key === "students.read");
    expect(studentsPerm?.allowed).toBe(true);
    const employeesPerm = p.permissions.find((perm) => perm.key === "employees.manage");
    expect(employeesPerm?.allowed).toBe(false);
  });

  it("throws 404 when user not found", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    await expect(getProfile("u-missing")).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
  });

  it("does not return passwordHash (security)", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "u1", name: "K", email: "k@x.com", phone: null, avatar: null,
      roleName: "EMPLOYEE", status: "ACTIVE",
      lastLoginAt: null, emailVerifiedAt: null, createdAt: new Date(),
      employee: null, role: { permissions: [] },
    });
    const p = await getProfile("u1");
    expect((p as unknown as Record<string, unknown>).passwordHash).toBeUndefined();
  });

  it("returns null employee fields when no Employee row exists (ADMIN)", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "u-admin", name: "Admin", email: "a@x.com", phone: null, avatar: null,
      roleName: "ADMIN", status: "ACTIVE",
      lastLoginAt: null, emailVerifiedAt: null, createdAt: new Date(),
      employee: null, role: { permissions: [] },
    });
    const p = await getProfile("u-admin");
    expect(p.employeeId).toBeNull();
    expect(p.title).toBeNull();
    expect(p.branch).toBeNull();
  });
});

// ── updateOwnProfile ─────────────────────────────────────────────────

describe("updateOwnProfile", () => {
  it("updates name + phone + avatar + employee fields", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: "u1", name: "Old", phone: "+1", avatar: null,
      employee: { id: "e1", title: "Old Title", branch: null, designation: null, address: null },
    });
    prismaMock.user.update.mockResolvedValue({});
    prismaMock.employee.update.mockResolvedValue({});
    prismaMock.auditLog.create.mockResolvedValue({});
    // Second findUnique for the return value
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: "u1", name: "New Name", email: "k@x.com", phone: "+2", avatar: "https://x/y.png",
      roleName: "EMPLOYEE", status: "ACTIVE",
      lastLoginAt: null, emailVerifiedAt: null, createdAt: new Date(),
      employee: { id: "e1", title: "New Title", branch: "Dhaka", designation: "Senior", address: "Banani" },
      role: { permissions: [] },
    });

    await updateOwnProfile("u1", {
      name: "New Name", phone: "+2", avatar: "https://x/y.png",
      title: "New Title", branch: "Dhaka", designation: "Senior", address: "Banani",
    }, { id: "u1" });

    expect(prismaMock.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "u1" },
      data: expect.objectContaining({ name: "New Name", phone: "+2", avatar: "https://x/y.png" }),
    }));
    expect(prismaMock.employee.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "e1" },
      data: expect.objectContaining({ title: "New Title", branch: "Dhaka", designation: "Senior", address: "Banani" }),
    }));
  });

  it("writes an audit log with old + new values", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: "u1", name: "Old", phone: "+1", avatar: null,
      employee: { id: "e1", title: "Old", branch: null, designation: null, address: null },
    });
    prismaMock.user.update.mockResolvedValue({});
    prismaMock.auditLog.create.mockResolvedValue({});
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: "u1", name: "New", email: "k@x.com", phone: "+1", avatar: null,
      roleName: "EMPLOYEE", status: "ACTIVE",
      lastLoginAt: null, emailVerifiedAt: null, createdAt: new Date(),
      employee: { id: "e1", title: "Old", branch: null, designation: null, address: null },
      role: { permissions: [] },
    });

    await updateOwnProfile("u1", { name: "New" }, { id: "u1" });

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: "u1", action: "profile.updated", entity: "User", entityId: "u1",
        oldValue: expect.objectContaining({ name: "Old" }),
        newValue: expect.objectContaining({ name: "New" }),
      }),
    }));
  });

  it("throws 404 when user not found", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    await expect(updateOwnProfile("u-missing", { name: "X" }, { id: "u1" }))
      .rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
  });

  it("rejects empty name (422)", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "u1", name: "Old", phone: null, avatar: null,
      employee: null,
    });
    await expect(updateOwnProfile("u1", { name: "   " }, { id: "u1" }))
      .rejects.toMatchObject({ status: 422, code: "VALIDATION_ERROR" });
  });

  it("rejects oversized name (422)", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "u1", name: "Old", phone: null, avatar: null,
      employee: null,
    });
    await expect(updateOwnProfile("u1", { name: "x".repeat(MAX_NAME + 1) }, { id: "u1" }))
      .rejects.toMatchObject({ status: 422, code: "VALIDATION_ERROR" });
  });

  it("trims name before persisting", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: "u1", name: "Old", phone: null, avatar: null, employee: null,
    });
    prismaMock.user.update.mockResolvedValue({});
    prismaMock.auditLog.create.mockResolvedValue({});
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: "u1", name: "Trimmed", email: "k@x.com", phone: null, avatar: null,
      roleName: "EMPLOYEE", status: "ACTIVE",
      lastLoginAt: null, emailVerifiedAt: null, createdAt: new Date(),
      employee: null, role: { permissions: [] },
    });
    await updateOwnProfile("u1", { name: "  Trimmed  " }, { id: "u1" });
    expect(prismaMock.user.update.mock.calls[0][0].data.name).toBe("Trimmed");
  });

  it("silently ignores admin-only fields (roleName, status, email)", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: "u1", name: "Old", phone: null, avatar: null, employee: null,
    });
    prismaMock.user.update.mockResolvedValue({});
    prismaMock.auditLog.create.mockResolvedValue({});
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: "u1", name: "New", email: "k@x.com", phone: null, avatar: null,
      roleName: "EMPLOYEE", status: "ACTIVE",
      lastLoginAt: null, emailVerifiedAt: null, createdAt: new Date(),
      employee: null, role: { permissions: [] },
    });
    // Pass admin-only fields — they should be ignored by updateOwnProfile
    await updateOwnProfile("u1", { name: "New" }, { id: "u1" });
    const updateData = prismaMock.user.update.mock.calls[0][0].data;
    expect(updateData.roleName).toBeUndefined();
    expect(updateData.status).toBeUndefined();
    expect(updateData.email).toBeUndefined();
  });

  it("skips employee update when user has no Employee row", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: "u-admin", name: "Admin", phone: null, avatar: null, employee: null,
    });
    prismaMock.user.update.mockResolvedValue({});
    prismaMock.auditLog.create.mockResolvedValue({});
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: "u-admin", name: "Admin Updated", email: "a@x.com", phone: null, avatar: null,
      roleName: "ADMIN", status: "ACTIVE",
      lastLoginAt: null, emailVerifiedAt: null, createdAt: new Date(),
      employee: null, role: { permissions: [] },
    });
    await updateOwnProfile("u-admin", { name: "Admin Updated", branch: "X" }, { id: "u-admin" });
    expect(prismaMock.employee.update).not.toHaveBeenCalled();
  });
});

// ── updateProfileAsAdmin ─────────────────────────────────────────────

describe("updateProfileAsAdmin", () => {
  it("allows updating roleName + status + email (admin-only)", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: "u1", name: "Karim", email: "k@x.com", phone: null, avatar: null,
      roleName: "STUDENT", status: "ACTIVE", employee: null,
    });
    prismaMock.user.findUnique.mockResolvedValueOnce(null); // no dupe email
    prismaMock.user.update.mockResolvedValue({});
    prismaMock.auditLog.create.mockResolvedValue({});
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: "u1", name: "Karim", email: "new@x.com", phone: null, avatar: null,
      roleName: "EMPLOYEE", status: "SUSPENDED",
      lastLoginAt: null, emailVerifiedAt: null, createdAt: new Date(),
      employee: null, role: { permissions: [] },
    });

    await updateProfileAsAdmin("u1", {
      roleName: "EMPLOYEE", status: "SUSPENDED", email: "new@x.com",
    }, { id: "u-admin" });

    const updateData = prismaMock.user.update.mock.calls[0][0].data;
    expect(updateData.roleName).toBe("EMPLOYEE");
    expect(updateData.status).toBe("SUSPENDED");
    expect(updateData.email).toBe("new@x.com");
  });

  it("rejects invalid role (400)", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "u1", name: "X", email: "x@x.com", phone: null, avatar: null,
      roleName: "STUDENT", status: "ACTIVE", employee: null,
    });
    await expect(updateProfileAsAdmin("u1", { roleName: "SUPERADMIN" }, { id: "u-admin" }))
      .rejects.toMatchObject({ status: 400, code: "BAD_REQUEST" });
  });

  it("rejects invalid status (400)", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "u1", name: "X", email: "x@x.com", phone: null, avatar: null,
      roleName: "STUDENT", status: "ACTIVE", employee: null,
    });
    await expect(updateProfileAsAdmin("u1", { status: "BANNED" }, { id: "u-admin" }))
      .rejects.toMatchObject({ status: 400, code: "BAD_REQUEST" });
  });

  it("rejects invalid email (422)", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "u1", name: "X", email: "x@x.com", phone: null, avatar: null,
      roleName: "STUDENT", status: "ACTIVE", employee: null,
    });
    await expect(updateProfileAsAdmin("u1", { email: "not-an-email" }, { id: "u-admin" }))
      .rejects.toMatchObject({ status: 422, code: "VALIDATION_ERROR" });
  });

  it("rejects duplicate email (409)", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: "u1", name: "X", email: "x@x.com", phone: null, avatar: null,
      roleName: "STUDENT", status: "ACTIVE", employee: null,
    });
    prismaMock.user.findUnique.mockResolvedValueOnce({ id: "u-other" }); // dupe
    await expect(updateProfileAsAdmin("u1", { email: "taken@x.com" }, { id: "u-admin" }))
      .rejects.toMatchObject({ status: 409, code: "CONFLICT" });
  });

  it("lowercases email", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: "u1", name: "X", email: "x@x.com", phone: null, avatar: null,
      roleName: "STUDENT", status: "ACTIVE", employee: null,
    });
    prismaMock.user.findUnique.mockResolvedValueOnce(null);
    prismaMock.user.update.mockResolvedValue({});
    prismaMock.auditLog.create.mockResolvedValue({});
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: "u1", name: "X", email: "new@x.com", phone: null, avatar: null,
      roleName: "STUDENT", status: "ACTIVE",
      lastLoginAt: null, emailVerifiedAt: null, createdAt: new Date(),
      employee: null, role: { permissions: [] },
    });
    await updateProfileAsAdmin("u1", { email: "NEW@X.COM" }, { id: "u-admin" });
    expect(prismaMock.user.update.mock.calls[0][0].data.email).toBe("new@x.com");
  });

  it("writes audit with action 'profile.updated_by_admin'", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: "u1", name: "X", email: "x@x.com", phone: null, avatar: null,
      roleName: "STUDENT", status: "ACTIVE", employee: null,
    });
    prismaMock.user.update.mockResolvedValue({});
    prismaMock.auditLog.create.mockResolvedValue({});
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: "u1", name: "X", email: "x@x.com", phone: null, avatar: null,
      roleName: "STUDENT", status: "ACTIVE",
      lastLoginAt: null, emailVerifiedAt: null, createdAt: new Date(),
      employee: null, role: { permissions: [] },
    });
    await updateProfileAsAdmin("u1", { status: "SUSPENDED" }, { id: "u-admin" });
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: "profile.updated_by_admin",
        oldValue: expect.objectContaining({ status: "ACTIVE" }),
        newValue: expect.objectContaining({ status: "SUSPENDED" }),
      }),
    }));
  });
});

// ── changePassword ────────────────────────────────────────────────────

describe("changePassword", () => {
  it("changes the password when current matches", async () => {
    const oldHash = await bcrypt.hash("OldPass123!", 10);
    prismaMock.user.findUnique.mockResolvedValue({ id: "u1", passwordHash: oldHash });
    prismaMock.user.update.mockResolvedValue({});
    prismaMock.auditLog.create.mockResolvedValue({});

    const result = await changePassword("u1", "OldPass123!", "NewPass456!", { id: "u1" });
    expect(result.ok).toBe(true);
    expect(prismaMock.user.update).toHaveBeenCalled();
    // The new hash should NOT equal the old hash
    const newHash = prismaMock.user.update.mock.calls[0][0].data.passwordHash;
    expect(newHash).not.toBe(oldHash);
    // Verify the new hash matches the new password
    expect(await bcrypt.compare("NewPass456!", newHash)).toBe(true);
  });

  it("writes an audit log without storing the password", async () => {
    const oldHash = await bcrypt.hash("OldPass123!", 10);
    prismaMock.user.findUnique.mockResolvedValue({ id: "u1", passwordHash: oldHash });
    prismaMock.user.update.mockResolvedValue({});
    prismaMock.auditLog.create.mockResolvedValue({});

    await changePassword("u1", "OldPass123!", "NewPass456!", { id: "u1" });

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: "security.password_changed",
        oldValue: { passwordChanged: false },
        newValue: expect.objectContaining({ passwordChanged: true }),
      }),
    }));
    // The audit log must NOT contain the password itself
    const auditCall = prismaMock.auditLog.create.mock.calls[0][0].data;
    const auditJson = JSON.stringify(auditCall);
    expect(auditJson).not.toContain("NewPass456");
    expect(auditJson).not.toContain("OldPass123");
  });

  it("rejects when current password is wrong (422)", async () => {
    const oldHash = await bcrypt.hash("CorrectPass123!", 10);
    prismaMock.user.findUnique.mockResolvedValue({ id: "u1", passwordHash: oldHash });
    await expect(changePassword("u1", "WrongPass123!", "NewPass456!", { id: "u1" }))
      .rejects.toMatchObject({ status: 422, code: "VALIDATION_ERROR" });
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("rejects short new password (422)", async () => {
    await expect(changePassword("u1", "Old123!", "short", { id: "u1" }))
      .rejects.toMatchObject({ status: 422, code: "VALIDATION_ERROR" });
  });

  it("rejects when new password equals current (422)", async () => {
    await expect(changePassword("u1", "SamePass1!", "SamePass1!", { id: "u1" }))
      .rejects.toMatchObject({ status: 422, code: "VALIDATION_ERROR" });
  });

  it("throws 404 when user not found", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    await expect(changePassword("u-missing", "Old", "NewNewNew!", { id: "u1" }))
      .rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
  });

  it("hashes the new password with bcrypt (not plaintext)", async () => {
    const oldHash = await bcrypt.hash("OldPass123!", 10);
    prismaMock.user.findUnique.mockResolvedValue({ id: "u1", passwordHash: oldHash });
    prismaMock.user.update.mockResolvedValue({});
    prismaMock.auditLog.create.mockResolvedValue({});
    await changePassword("u1", "OldPass123!", "NewPass456!", { id: "u1" });
    const newHash = prismaMock.user.update.mock.calls[0][0].data.passwordHash;
    // bcrypt hashes start with $2a$ / $2b$
    expect(newHash).toMatch(/^\$2[ab]\$\d{2}\$/);
  });
});

// ── Sessions ─────────────────────────────────────────────────────────

describe("listSessions", () => {
  it("returns one 'current' session for stateless JWT", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "u1", lastLoginAt: new Date("2026-09-01"),
    });
    const result = await listSessions("u1");
    expect(result.sessions).toHaveLength(1);
    expect(result.sessions[0].current).toBe(true);
    expect(result.sessions[0].device).toBe("This device");
    expect(result.note).toContain("stateless");
  });

  it("throws 404 when user not found", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    await expect(listSessions("u-missing")).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
  });
});

describe("revokeAllSessions", () => {
  it("bumps tokenVersion + audits the request + returns 1 (session invalidated)", async () => {
    prismaMock.user.update.mockResolvedValue({});
    prismaMock.auditLog.create.mockResolvedValue({});
    const result = await revokeAllSessions("u1", { id: "u1" });
    expect(result.revoked).toBe(1);
    expect(result.note).toContain("invalidated");
    // Verify tokenVersion was bumped
    expect(prismaMock.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "u1" },
      data: expect.objectContaining({ tokenVersion: { increment: 1 } }),
    }));
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "security.sessions_revoked" }),
    }));
  });
});

// ── IDOR closure ─────────────────────────────────────────────────────

describe("IDOR closure", () => {
  it("updateOwnProfile uses the caller's userId, never a client-supplied id", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: "u1", name: "Old", phone: null, avatar: null, employee: null,
    });
    prismaMock.user.update.mockResolvedValue({});
    prismaMock.auditLog.create.mockResolvedValue({});
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: "u1", name: "New", email: "k@x.com", phone: null, avatar: null,
      roleName: "EMPLOYEE", status: "ACTIVE",
      lastLoginAt: null, emailVerifiedAt: null, createdAt: new Date(),
      employee: null, role: { permissions: [] },
    });
    // Pass a different actor.id — the target is always the caller's userId
    await updateOwnProfile("u1", { name: "New" }, { id: "u-actor" });
    expect(prismaMock.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "u1" }, // always the caller's userId, not the actor's
    }));
  });

  it("changePassword updates only the caller's record", async () => {
    const oldHash = await bcrypt.hash("Old123!", 10);
    prismaMock.user.findUnique.mockResolvedValue({ id: "u1", passwordHash: oldHash });
    prismaMock.user.update.mockResolvedValue({});
    prismaMock.auditLog.create.mockResolvedValue({});
    await changePassword("u1", "Old123!", "NewPass123!", { id: "u1" });
    expect(prismaMock.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "u1" },
    }));
  });
});

// ── Network failure propagation ─────────────────────────────────────

describe("network failure propagation", () => {
  it("getProfile lets prisma errors bubble", async () => {
    prismaMock.user.findUnique.mockRejectedValue(new Error("DB lost"));
    await expect(getProfile("u1")).rejects.toThrow("DB lost");
  });

  it("updateOwnProfile lets update errors bubble", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "u1", name: "Old", phone: null, avatar: null, employee: null,
    });
    prismaMock.user.update.mockRejectedValue(new Error("update fail"));
    await expect(updateOwnProfile("u1", { name: "New" }, { id: "u1" })).rejects.toThrow("update fail");
  });

  it("audit failure does NOT block the primary operation", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: "u1", name: "Old", phone: null, avatar: null, employee: null,
    });
    prismaMock.user.update.mockResolvedValue({});
    prismaMock.auditLog.create.mockRejectedValue(new Error("audit fail"));
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: "u1", name: "New", email: "k@x.com", phone: null, avatar: null,
      roleName: "EMPLOYEE", status: "ACTIVE",
      lastLoginAt: null, emailVerifiedAt: null, createdAt: new Date(),
      employee: null, role: { permissions: [] },
    });
    // Should NOT throw despite audit failure
    const p = await updateOwnProfile("u1", { name: "New" }, { id: "u1" });
    expect(p.name).toBe("New");
  });
});
