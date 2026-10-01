import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────
// Mocks: prisma + auth + bcrypt are stubbed so we can drive every auth
// branch without touching the database. vi.hoisted lets the mock factories
// close over the mock objects without breaking hoisting order.
// ─────────────────────────────────────────────

const { prismaMock, bcryptMock } = vi.hoisted(() => {
  const userFindUnique = vi.fn();
  const userUpdate = vi.fn();
  const employeeFindFirst = vi.fn();
  return {
    prismaMock: {
      user: { findUnique: userFindUnique, update: userUpdate },
      employee: { findFirst: employeeFindFirst },
    },
    bcryptMock: { compare: vi.fn(), hash: vi.fn() },
  };
});

const authMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("bcryptjs", () => ({ default: bcryptMock, compare: bcryptMock.compare, hash: bcryptMock.hash }));

import { requireEmployee } from "@/lib/auth/guards";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("requireEmployee — IDOR closure on identity resolution", () => {
  it("rejects unauthenticated callers with 401", async () => {
    authMock.mockResolvedValue(null);
    const r = await requireEmployee();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.status).toBe(401);
  });

  it("rejects STUDENT role even when authenticated — /employee is for employees only", async () => {
    authMock.mockResolvedValue({ user: { id: "u-1", role: "STUDENT", name: "S", email: "s@x.com" } });
    const r = await requireEmployee();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.status).toBe(403);
  });

  it("rejects EMPLOYEE users with no linked Employee record (no case ownership possible)", async () => {
    authMock.mockResolvedValue({ user: { id: "u-1", role: "EMPLOYEE", name: "E", email: "e@x.com" } });
    prismaMock.employee.findFirst.mockResolvedValue(null);
    const r = await requireEmployee();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.status).toBe(403);
    // The lookup MUST be by the session user's id, never by a client-supplied id.
    expect(prismaMock.employee.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "u-1" } }));
  });

  it("returns the employeeId derived from the session — never from the client", async () => {
    authMock.mockResolvedValue({ user: { id: "u-1", role: "EMPLOYEE", name: "E", email: "e@x.com" } });
    prismaMock.employee.findFirst.mockResolvedValue({ id: "emp-9" });
    const r = await requireEmployee();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.employeeId).toBe("emp-9");
  });

  it("ADMIN bypasses the employee lookup (full scope — sees all records)", async () => {
    authMock.mockResolvedValue({ user: { id: "u-admin", role: "ADMIN", name: "A", email: "a@x.com" } });
    const r = await requireEmployee();
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.employeeId).toBe("");
      expect(prismaMock.employee.findFirst).not.toHaveBeenCalled();
    }
  });
});
